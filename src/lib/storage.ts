import type { AppData, Coupon, Product, Register, Sale, Store } from '../types'
import { MAX_PRICE, isValidCouponValue, isValidName, isValidPrice } from './format'
import { DEFAULT_REGISTER_NAME, storeWith } from './registers'

/**
 * 保存先のキー。形式を変えたらキー名のバージョンを上げる
 * - dayresi:v3：レジの一覧（次の段階、#127）
 * - dayresi:v2：MVP の形式（商品と会計だけ）。v3 がないときだけ読んでマイレジに引き継ぎ、消さずに残す
 * - dayresi:v1：作り直す前の公開版。読まず、消さずに残す（ADR 0025）
 */
const KEY = 'dayresi:v3'
const MVP_KEY = 'dayresi:v2'

// 全データ消去は、reducer の resetAll が今のレジの商品と会計を空にし、自動保存（useAppData）が書き込むことで行う

export const emptyData = (): AppData => ({ products: [], coupons: [], sales: [] })

/** 商品は、壊れたもの（id が文字列でない、名前や価格がルールに合わない）だけ捨てる。会計が商品名と価格を持つので記録は失われない */
function isProduct(p: unknown): p is Product {
  const x = p as Product
  return typeof x === 'object' && x !== null && typeof x.id === 'string' && isValidName(x.name) && isValidPrice(x.price)
}

/**
 * 会計は記録を優先して捨てない（#64）。番号や合計などの値が壊れていても、計算が合わなくても、そのまま残す
 * 画面が止まるほど壊れたもの（会計がオブジェクトでない、明細が一覧でない、明細がオブジェクトでない）だけ捨てる
 */
function isSale(s: unknown): s is Sale {
  const isObject = (x: unknown) => typeof x === 'object' && x !== null
  return isObject(s) && Array.isArray((s as Sale).items) && (s as Sale).items.every(isObject)
}

function isCoupon(c: unknown): c is Coupon {
  const x = c as Coupon
  return typeof x === 'object' && x !== null && typeof x.id === 'string' && isValidName(x.name) && isValidCouponValue(x.kind, x.value)
}

/**
 * マイナスの価格の商品を、同じ ID・名前・金額の金額引きの割引券に移す（ADR 0034）
 * MVP と、割引券を作る前の次の段階では、割引をマイナスの価格の商品で代用していた（ADR 0011）
 */
function toCoupon(p: unknown): Coupon | null {
  const x = p as Product
  if (typeof x !== 'object' || x === null || typeof x.id !== 'string' || !isValidName(x.name)) return null
  if (typeof x.price !== 'number' || !Number.isInteger(x.price) || x.price >= 0 || x.price < -MAX_PRICE) return null
  return { id: x.id, name: x.name, kind: 'amount', value: -x.price }
}

/**
 * レジの中身（MVP の保存データ dayresi:v2 も）を読む。JSON として読めないときは例外を投げる
 * マイナスの価格の商品は、割引券に移す。過去の会計の明細はそのまま残す
 */
export function parseData(raw: string | null): AppData {
  if (!raw) return emptyData()
  const data = JSON.parse(raw) as Partial<AppData>
  const products: unknown[] = Array.isArray(data?.products) ? data.products : []
  const moved = products.map(toCoupon).filter((c) => c !== null)
  const coupons = [...(Array.isArray(data?.coupons) ? data.coupons.filter(isCoupon) : []), ...moved]
  return {
    products: products.filter(isProduct),
    coupons: coupons.filter((c, i) => coupons.findIndex((d) => d.id === c.id) === i),
    sales: Array.isArray(data?.sales) ? data.sales.filter(isSale) : [],
  }
}

/**
 * レジを 1 つ読む。オブジェクトでないものは捨てる。会計を失わないよう、ほかの値が壊れていても既定の値で補って残す
 * （ID と店の印がなければ振り直し、名前が壊れていればマイレジ、役割が分からなければ代表者、自分の名前が壊れていれば空）
 */
function parseRegister(x: unknown): Register | null {
  if (typeof x !== 'object' || x === null) return null
  const r = x as Partial<Register>
  return {
    ...parseData(JSON.stringify({ products: r.products, coupons: r.coupons, sales: r.sales })),
    id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
    storeId: typeof r.storeId === 'string' && r.storeId ? r.storeId : crypto.randomUUID(),
    name: isValidName(r.name) ? r.name : DEFAULT_REGISTER_NAME,
    role: r.role === 'member' ? 'member' : 'owner',
    myName: isValidName(r.myName) ? r.myName : '',
  }
}

/**
 * 保存データ（dayresi:v3）を読む。JSON として読めないときは例外を投げる
 * レジが 1 つもなければマイレジを作り、currentId がどのレジとも合わなければ最初のレジにする
 */
export function parseStore(raw: string | null): Store {
  if (!raw) return storeWith()
  const data = JSON.parse(raw) as Partial<Store> | null
  const registers = Array.isArray(data?.registers) ? data.registers.map(parseRegister).filter((r) => r !== null) : []
  if (registers.length === 0) return storeWith()
  const currentId = registers.some((r) => r.id === data?.currentId) ? (data!.currentId as string) : registers[0].id
  return { registers, currentId }
}

/** MVP の保存データしかないときは、マイレジに引き継ぐ。どちらも読めないときは、マイレジだけで始める */
export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) return parseStore(raw)
    return storeWith(parseData(localStorage.getItem(MVP_KEY)))
  } catch {
    // 壊れたデータは捨てて始める（次の保存で上書きされる）
    return storeWith()
  }
}

/** 保存に失敗しても知らせず、会計を続けられるようにする */
export function saveStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* 容量不足やプライベートブラウズでは保存できない */ }
}
