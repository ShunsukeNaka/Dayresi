/**
 * 商品。登録するのは商品名と税込価格だけ（SPEC「商品」）
 * 並び順は配列の順（登録した順）。編集・削除・並べ替えはしない
 */
export type Product = {
  /** crypto.randomUUID() で振る */
  id: string
  /** 入力したまま保存する（前後の空白も残す）。空白だけは不可。最大 MAX_NAME_LENGTH 文字。同じ名前も登録できる */
  name: string
  /** 税込価格（円）。整数で MIN_PRICE〜MAX_PRICE。割引券の代わりにマイナスにもできる（ADR 0011） */
  price: number
}

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
  paid: number
  change: number
  voided: boolean
}

export type AppData = {
  products: Product[]
  sales: Sale[]
}

/**
 * 会計を確定する前のカート。商品ID → 数量（1〜MAX_QTY）
 * localStorage には保存せず、画面の state だけで持つ。再読み込みすると消える
 */
export type Cart = Record<string, number>
