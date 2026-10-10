import type { Cart, PaymentMethod, Product, Sale, SaleItem } from '../types'
import { newId } from './format'

export function cartItems(cart: Cart, products: Product[]): SaleItem[] {
  return products
    .filter((p) => (cart[p.id] ?? 0) > 0)
    .map((p) => ({ productId: p.id, name: p.name, price: p.price, qty: cart[p.id] }))
}

export function itemsTotal(items: SaleItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0)
}

export function createSale(
  items: SaleItem[],
  method: PaymentMethod,
  paid: number,
  prevSales: Sale[],
  now = new Date(),
): Sale {
  const total = itemsTotal(items)
  const actualPaid = method === 'cash' ? paid : total
  return {
    id: newId(),
    no: prevSales.reduce((max, s) => Math.max(max, s.no), 0) + 1,
    at: now.toISOString(),
    items,
    total,
    method,
    paid: actualPaid,
    change: actualPaid - total,
    voided: false,
  }
}

export type ProductSummary = { key: string; name: string; qty: number; amount: number }

export type Summary = {
  total: number
  count: number
  voidedCount: number
  byProduct: ProductSummary[]
}

/** 取消済みの会計を除いて集計する。商品は「商品ID＋会計時の名前＋価格」ごとにまとめる */
export function summarize(sales: Sale[], products: Product[]): Summary {
  const active = sales.filter((s) => !s.voided)
  const map = new Map<string, ProductSummary>()
  for (const sale of active) {
    for (const item of sale.items) {
      const key = `${item.productId}\u0000${item.name}\u0000${item.price}`
      const row = map.get(key) ?? { key, name: item.name, qty: 0, amount: 0 }
      row.qty += item.qty
      row.amount += item.price * item.qty
      map.set(key, row)
    }
  }
  // 現在の商品の並び順に合わせ、削除済み商品は末尾に置く
  const order = new Map(products.map((p, i) => [p.id, i]))
  const byProduct = [...map.values()].sort((a, b) => {
    const ia = order.get(a.key.split('\u0000')[0]) ?? Infinity
    const ib = order.get(b.key.split('\u0000')[0]) ?? Infinity
    return ia - ib
  })
  return {
    total: active.reduce((sum, s) => sum + s.total, 0),
    count: active.length,
    voidedCount: sales.length - active.length,
    byProduct,
  }
}
