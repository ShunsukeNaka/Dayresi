import type { Coupon, CouponKind, Product, Sale, SaleDiscount, SaleItem } from '../types'
import { MAX_PRICE, isValidCouponValue, isValidName, isValidPrice } from './format'

/**
 * 端末のあいだで渡すデータ（spec-next.md「商品を配る」「データ」）
 * URL の # 以降に「種類=データ」の形で入れる。# 以降はサーバー（GitHub Pages）に送られない
 * データは JSON を deflate-raw で縮めて base64url にする
 */

/** 代表者が配る商品。会計する人のレジに取り込む */
export type ProductsShare = {
  kind: 'products'
  /** 店ごとの印。同じ店のレジかどうかを見分ける */
  storeId: string
  /** レジの名前（代表者が付けたもの） */
  name: string
  products: Product[]
  /** 割引券（spec-next.md「割引券」）。版 1 のデータにはない */
  coupons: Coupon[]
}

/** 会計する人が代表者に送る会計。代表者のレジで合算する（spec-next.md「会計を送る」） */
export type SalesShare = {
  kind: 'sales'
  storeId: string
  /** 送った人（会計した人）の名前 */
  by: string
  /**
   * そのレジの会計すべて（取消済も含む）。会計の ID は「送った人のレジの ID-会計番号」にしてある
   * 会計する人のレジでは会計番号が重ならない（全データ消去ができず、取り消しても番号を詰めない）ので、送り直しても同じ会計は同じ ID になる
   */
  sales: Sale[]
}

export type Share = ProductsShare | SalesShare

/**
 * データの形の版。形を変えたら上げる
 * - 1：商品と会計だけ（#129・#131）
 * - 2：商品に割引券を、会計に割引を足した（#169）。版 1 のデータも、割引のないデータとして読む
 */
const VERSION = 2
const READABLE_VERSIONS = [1, 2]
/** 割引券の種類を短く書く */
const KIND_CODE: Record<CouponKind, string> = { amount: 'a', percent: 'p' }
const toKind = (code: unknown): CouponKind | null => (code === 'a' ? 'amount' : code === 'p' ? 'percent' : null)
/** # 以降の種類 */
const PRODUCTS_KEY = 'p'
const SALES_KEY = 's'

async function compress(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompress(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** 商品を配るデータを、URL の # 以降に入れる文字列（# は含まない）にする */
export async function encodeProductsShare(share: Omit<ProductsShare, 'kind'>): Promise<string> {
  const body = [
    VERSION, share.storeId, share.name,
    share.products.map((p) => [p.id, p.name, p.price]),
    share.coupons.map((c) => [c.id, c.name, KIND_CODE[c.kind], c.value]),
  ]
  return `${PRODUCTS_KEY}=${toBase64Url(await compress(JSON.stringify(body)))}`
}

/**
 * 会計を送るデータを、URL の # 以降に入れる文字列（# は含まない）にする
 * QR に多く入るよう、会計の ID・合計・おつりは送らない（受け取った側で、レジの ID と会計番号・明細・お預かりから作り直す）
 * 全体は [版, 店の印, 送った人の名前, 会計, レジの ID, 最初の時刻（秒）]、会計 1 件は [番号, 最初の時刻からの秒, 明細, お預かり, 取消済, 割引]
 * 明細は [商品ID, 商品名, 価格, 数量]、割引は [割引券ID, 名前, 種類, 値, 枚数, 引いた金額]（割引のない会計では省く）
 */
export async function encodeSalesShare(share: { storeId: string; by: string; registerId: string; sales: Sale[] }): Promise<string> {
  const seconds = share.sales.map((s) => Math.round(Date.parse(s.at) / 1000) || 0)
  const base = seconds.length > 0 ? Math.min(...seconds) : 0
  const sales = share.sales.map((s, i) => [
    s.no, seconds[i] - base,
    s.items.map((it) => [it.productId, it.name, it.price, it.qty]),
    s.paid, s.voided ? 1 : 0,
    ...(s.discounts && s.discounts.length > 0 ? [s.discounts.map((d) => [d.couponId, d.name, KIND_CODE[d.kind], d.value, d.qty, d.amount])] : []),
  ])
  const body = [VERSION, share.storeId, share.by, sales, share.registerId, base]
  return `${SALES_KEY}=${toBase64Url(await compress(JSON.stringify(body)))}`
}

/** 送られた会計の明細を 1 つ読む */
function toSaleItem(x: unknown): SaleItem | null {
  if (!Array.isArray(x)) return null
  const [productId, name, price, qty] = x as unknown[]
  return typeof productId === 'string' && typeof name === 'string' && typeof price === 'number' && typeof qty === 'number'
    ? { productId, name, price, qty }
    : null
}

/** 送られた会計の割引を 1 つ読む */
function toSaleDiscount(x: unknown): SaleDiscount | null {
  if (!Array.isArray(x)) return null
  const [couponId, name, code, value, qty, amount] = x as unknown[]
  const kind = toKind(code)
  return typeof couponId === 'string' && typeof name === 'string' && kind && typeof value === 'number' && typeof qty === 'number' && typeof amount === 'number'
    ? { couponId, name, kind, value, qty, amount }
    : null
}

/**
 * 送られた会計を 1 つ読む。番号・時刻・明細・割引が読めない会計は捨てる（ID は番号から作るので、番号は欠かせない）
 * 合計は「明細の合計 − 引いた金額」（0 円未満にはしない）、おつりは「お預かり − 合計」で作り直す
 */
function toSale(x: unknown, registerId: string, base: number): Sale | null {
  if (!Array.isArray(x)) return null
  const [no, dt, items, paid, voided, discounts] = x as unknown[]
  if (!Number.isInteger(no) || typeof dt !== 'number' || !Array.isArray(items) || typeof paid !== 'number') return null
  const parsed = items.map(toSaleItem)
  if (parsed.some((i) => i === null)) return null
  const parsedDiscounts = Array.isArray(discounts) ? discounts.map(toSaleDiscount) : []
  if (parsedDiscounts.some((d) => d === null)) return null
  const subtotal = (parsed as SaleItem[]).reduce((sum, i) => sum + i.price * i.qty, 0)
  const total = Math.max(0, subtotal - (parsedDiscounts as SaleDiscount[]).reduce((sum, d) => sum + d.amount, 0))
  return {
    id: `${registerId}-${no}`, no: no as number, at: new Date((base + dt) * 1000).toISOString(), items: parsed as SaleItem[],
    total, paid, change: paid - total, voided: voided === 1,
    ...(parsedDiscounts.length > 0 ? { discounts: parsedDiscounts as SaleDiscount[] } : {}),
  }
}

/** 配られた割引券を 1 つ読む。ルールに合わない割引券は捨てる */
function toCoupon(x: unknown): Coupon | null {
  if (!Array.isArray(x)) return null
  const [id, name, code, value] = x as unknown[]
  const kind = toKind(code)
  return typeof id === 'string' && id && isValidName(name) && kind && isValidCouponValue(kind, value) ? { id, name, kind, value: value as number } : null
}

/** 版 1 のデータのマイナスの価格の商品を、同じ ID・名前・金額の金額引きの割引券にする（保存データと同じ、ADR 0034） */
function negativeProductToCoupon(x: unknown): Coupon | null {
  if (!Array.isArray(x)) return null
  const [id, name, price] = x as unknown[]
  return typeof id === 'string' && id && isValidName(name) && typeof price === 'number' && Number.isInteger(price) && price < 0 && price >= -MAX_PRICE
    ? { id, name, kind: 'amount', value: -price }
    : null
}

/** 配られた商品を 1 つ読む。ルールに合わない商品は捨てる */
function toProduct(x: unknown): Product | null {
  if (!Array.isArray(x)) return null
  const [id, name, price] = x as unknown[]
  return typeof id === 'string' && id && isValidName(name) && isValidPrice(price) ? { id, name, price } : null
}

/**
 * URL の # 以降を読む。引き渡しのデータでない・壊れている・読めない版のときは null
 * hash は location.hash のように先頭の # があってもなくてもよい
 */
export async function decodeShare(hash: string): Promise<Share | null> {
  const [key, data] = hash.replace(/^#/, '').split('=', 2)
  if ((key !== PRODUCTS_KEY && key !== SALES_KEY) || !data) return null
  try {
    const body = JSON.parse(await decompress(fromBase64Url(data))) as unknown
    if (!Array.isArray(body)) return null
    const [version, storeId, name, list, registerId, base] = body as unknown[]
    if (!READABLE_VERSIONS.includes(version as number) || typeof storeId !== 'string' || !storeId || !isValidName(name) || !Array.isArray(list)) return null
    if (key === SALES_KEY) {
      if (typeof registerId !== 'string' || !registerId || typeof base !== 'number') return null
      return { kind: 'sales', storeId, by: name, sales: list.map((x) => toSale(x, registerId, base)).filter((s) => s !== null) }
    }
    // 商品のデータでは、5 番目の値が割引券
    const coupons = Array.isArray(registerId) ? registerId.map(toCoupon).filter((c) => c !== null) : []
    const moved = list.map(negativeProductToCoupon).filter((c) => c !== null)
    return { kind: 'products', storeId, name, products: list.map(toProduct).filter((p) => p !== null), coupons: [...coupons, ...moved] }
  } catch {
    return null
  }
}

/** 今のページの URL（# より前）に、引き渡しのデータを付けたリンク */
export function shareUrl(fragment: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}#${fragment}`
}
