import type { Product } from '../types'
import { isValidName, isValidPrice, newId } from './format'

const APP = 'dayresi'
const TYPE = 'products'
const VERSION = 1

/** 商品設定ファイルの中身。売上データは含めない */
export function productsToFile(products: Product[]): string {
  const data = {
    app: APP,
    type: TYPE,
    version: VERSION,
    products: products.map(({ name, price }) => ({ name, price })),
  }
  return JSON.stringify(data, null, 2) + '\n'
}

export class ProductFileError extends Error {}

export function parseProductFile(text: string): Product[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ProductFileError('ファイルを読み込めませんでした。Dayresi の商品設定ファイルを選んでください。')
  }
  if (
    typeof data !== 'object' || data === null ||
    (data as { app?: unknown }).app !== APP ||
    (data as { type?: unknown }).type !== TYPE
  ) {
    throw new ProductFileError('Dayresi の商品設定ファイルではありません。')
  }
  const { version, products } = data as { version?: unknown; products?: unknown }
  if (typeof version !== 'number' || version > VERSION) {
    throw new ProductFileError('このファイルは新しいバージョンの Dayresi で作られています。ページを再読み込みしてからお試しください。')
  }
  if (!Array.isArray(products)) {
    throw new ProductFileError('商品の一覧が見つかりません。')
  }
  return products.map((p: unknown, i) => {
    const { name, price } = (p ?? {}) as { name?: unknown; price?: unknown }
    if (!isValidName(name) || !isValidPrice(price)) {
      throw new ProductFileError(`${i + 1} 番目の商品の内容が正しくありません。`)
    }
    return { id: newId(), name: name.trim(), price }
  })
}
