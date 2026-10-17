import type { AppData, Product, Sale } from '../types'
import { isValidName, isValidPrice } from './format'

const KEY = 'dayresi:v1'

export const emptyData = (): AppData => ({ products: [], sales: [] })

function isProduct(p: unknown): p is Product {
  const x = p as Product
  return typeof x === 'object' && x !== null && typeof x.id === 'string' && isValidName(x.name) && isValidPrice(x.price)
}

function isSale(s: unknown): s is Sale {
  const x = s as Sale
  return (
    typeof x === 'object' && x !== null &&
    typeof x.id === 'string' && typeof x.no === 'number' && typeof x.at === 'string' &&
    Array.isArray(x.items) && typeof x.total === 'number' &&
    typeof x.paid === 'number' && typeof x.change === 'number' && typeof x.voided === 'boolean'
  )
}

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
    // 壊れたデータは退避してから空で始める
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) localStorage.setItem(`${KEY}:broken:${Date.now()}`, raw)
    } catch { /* 保存できない環境では諦める */ }
    return emptyData()
  }
}

/** 保存できたら true */
export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
