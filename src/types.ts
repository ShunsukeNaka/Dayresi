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

/**
 * 会計の明細。会計した時点の商品名と価格も持つので、
 * 履歴・集計・売上 CSV を会計のデータだけで作れる
 */
export type SaleItem = {
  productId: string
  /** 会計した時点の商品名 */
  name: string
  /** 会計した時点の税込価格（円）。マイナスもある（ADR 0011） */
  price: number
  qty: number
}

/** 確定した会計。支払方法は持たない（ADR 0018） */
export type Sale = {
  /** crypto.randomUUID() で振る */
  id: string
  /** 会計番号。1 から連番で、今ある会計の最大値＋1。取り消しても番号を詰めない。全データ消去で 1 に戻る */
  no: number
  /** 会計した日時。ISO 8601 の文字列（例 2026-10-25T09:15:16.025Z）。表示は PC の時刻に直す */
  at: string
  items: SaleItem[]
  /** 確定したときの合計（円）。明細から使うたびに計算し直さない */
  total: number
  /** お預かり金額（円）。未入力で確定したときは合計と同じ（「ちょうど」） */
  paid: number
  /** 確定したときのおつり（円）＝ paid − total */
  change: number
  /** 取り消したか。取り消した会計は消さずに残し、集計からは除く（ADR 0012） */
  voided: boolean
}

/**
 * 保存するデータ。その PC のブラウザの localStorage（キー dayresi:v2）にだけ保存し、サーバーには送らない
 * 中身は商品と会計だけで、カートは保存しない（#52）
 */
export type AppData = {
  products: Product[]
  sales: Sale[]
}

/**
 * 会計を確定する前のカート。商品ID → 数量（1〜MAX_QTY）
 * localStorage には保存せず、画面の state だけで持つ。再読み込みすると消える
 */
export type Cart = Record<string, number>
