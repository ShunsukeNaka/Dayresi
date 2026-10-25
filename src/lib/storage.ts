import type { AppData, Product, Sale } from '../types'
import { isValidName, isValidPrice } from './format'

/**
 * 保存先のキー。形式を変えたらキー名のバージョンを上げる
 * 作り直す前の公開版が使っていた dayresi:v1 は読まず、消さずに残す（ADR 0025）
 */
const KEY = 'dayresi:v2'

// 全データ消去は、reducer の resetAll が空のデータを返し、自動保存（useAppData）が空のデータを書き込むことで行う

export const emptyData = (): AppData => ({ products: [], sales: [] })

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

/** 保存データを読む。JSON として読めないときは例外を投げる（loadData が空で始める） */
export function parseData(raw: string | null): AppData {
  if (!raw) return emptyData()
  const data = JSON.parse(raw) as Partial<AppData>
  return {
    products: Array.isArray(data.products) ? data.products.filter(isProduct) : [],
    sales: Array.isArray(data.sales) ? data.sales.filter(isSale) : [],
  }
}

export function loadData(): AppData {
  try {
    return parseData(localStorage.getItem(KEY))
  } catch {
    // 壊れたデータは捨てて空で始める（次の保存で上書きされる）
    return emptyData()
  }
}

/** 保存に失敗しても知らせず、会計を続けられるようにする */
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch { /* 容量不足やプライベートブラウズでは保存できない */ }
}
