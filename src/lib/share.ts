import type { Product, Sale, SaleItem } from '../types'
import { isValidName, isValidPrice } from './format'

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

/** データの形の版。形を変えたら上げ、読めない版は取り込まない */
const VERSION = 1
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
  const body = [VERSION, share.storeId, share.name, share.products.map((p) => [p.id, p.name, p.price])]
  return `${PRODUCTS_KEY}=${toBase64Url(await compress(JSON.stringify(body)))}`
}

/**
 * 会計を送るデータを、URL の # 以降に入れる文字列（# は含まない）にする
 * QR に多く入るよう、会計の ID・合計・おつりは送らない（受け取った側で、レジの ID と会計番号・明細・お預かりから作り直す）
 * 全体は [版, 店の印, 送った人の名前, 会計, レジの ID, 最初の時刻（秒）]、会計 1 件は [番号, 最初の時刻からの秒, 明細, お預かり, 取消済]、明細は [商品ID, 商品名, 価格, 数量]
 */
export async function encodeSalesShare(share: { storeId: string; by: string; registerId: string; sales: Sale[] }): Promise<string> {
  const seconds = share.sales.map((s) => Math.round(Date.parse(s.at) / 1000) || 0)
  const base = seconds.length > 0 ? Math.min(...seconds) : 0
  const sales = share.sales.map((s, i) => [
    s.no, seconds[i] - base,
    s.items.map((it) => [it.productId, it.name, it.price, it.qty]),
    s.paid, s.voided ? 1 : 0,
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

/** 送られた会計を 1 つ読む。番号・時刻・明細が読めない会計は捨てる（ID は番号から作るので、番号は欠かせない） */
function toSale(x: unknown, registerId: string, base: number): Sale | null {
  if (!Array.isArray(x)) return null
  const [no, dt, items, paid, voided] = x as unknown[]
  if (!Number.isInteger(no) || typeof dt !== 'number' || !Array.isArray(items) || typeof paid !== 'number') return null
  const parsed = items.map(toSaleItem)
  if (parsed.some((i) => i === null)) return null
  const total = (parsed as SaleItem[]).reduce((sum, i) => sum + i.price * i.qty, 0)
  return {
    id: `${registerId}-${no}`, no: no as number, at: new Date((base + dt) * 1000).toISOString(), items: parsed as SaleItem[],
    total, paid, change: paid - total, voided: voided === 1,
  }
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
    if (version !== VERSION || typeof storeId !== 'string' || !storeId || !isValidName(name) || !Array.isArray(list)) return null
    if (key === SALES_KEY) {
      if (typeof registerId !== 'string' || !registerId || typeof base !== 'number') return null
      return { kind: 'sales', storeId, by: name, sales: list.map((x) => toSale(x, registerId, base)).filter((s) => s !== null) }
    }
    return { kind: 'products', storeId, name, products: list.map(toProduct).filter((p) => p !== null) }
  } catch {
    return null
  }
}

/** 今のページの URL（# より前）に、引き渡しのデータを付けたリンク */
export function shareUrl(fragment: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}#${fragment}`
}
