import type { Product } from '../types'
import { isValidName, isValidPrice } from './format'

/**
 * 商品を末尾に足した新しい配列を返す。ID は crypto.randomUUID() で振る
 * 商品名は入力したまま保存する。名前か価格がルールに合わないときは、受け取った配列をそのまま返す
 */
export function addProduct(products: Product[], name: string, price: number): Product[] {
  if (!isValidName(name) || !isValidPrice(price)) return products
  return [...products, { id: crypto.randomUUID(), name, price }]
}
