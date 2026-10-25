import type { Cart, Product, SaleItem } from '../types'

/** カートに入れられる 1 つの商品の数量の上限 */
export const MAX_QTY = 999

/** 商品を 1 つカートに入れる（商品ボタン）。上限 MAX_QTY で止まる */
export function addToCart(cart: Cart, productId: string): Cart {
  return changeQty(cart, productId, 1)
}

/** 数量を delta だけ変える。0 以下になったらカートから消し、MAX_QTY で止まる */
export function changeQty(cart: Cart, productId: string, delta: number): Cart {
  const qty = Math.max(0, Math.min(MAX_QTY, (cart[productId] ?? 0) + delta))
  const next = { ...cart }
  if (qty === 0) delete next[productId]
  else next[productId] = qty
  return next
}

/** カートを空にする。行ごとの削除はせず、一括のクリアだけ（ADR 0016） */
export function clearCart(): Cart {
  return {}
}

/** カートの中身を、商品の登録順で明細にする。カートに残っていても商品にないものは除く */
export function cartItems(cart: Cart, products: Product[]): SaleItem[] {
  return products
    .filter((p) => (cart[p.id] ?? 0) > 0)
    .map((p) => ({ productId: p.id, name: p.name, price: p.price, qty: cart[p.id] }))
}
