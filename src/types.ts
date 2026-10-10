export type Product = {
  id: string
  name: string
  /** 税込価格（円） */
  price: number
}

export type PaymentMethod = 'cash' | 'other'

/** 会計時点の商品名・価格を保持する（後で商品を編集・削除しても履歴は変わらない） */
export type SaleItem = {
  productId: string
  name: string
  price: number
  qty: number
}

export type Sale = {
  id: string
  /** 1 から始まる会計番号 */
  no: number
  /** ISO 8601 */
  at: string
  items: SaleItem[]
  total: number
  method: PaymentMethod
  paid: number
  change: number
  voided: boolean
}

export type AppData = {
  products: Product[]
  sales: Sale[]
}

/** productId → 数量 */
export type Cart = Record<string, number>
