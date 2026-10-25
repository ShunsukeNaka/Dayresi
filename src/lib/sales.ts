import type { Product, Sale, SaleItem } from '../types'

/** 合計。明細の「価格×数量」の和で、マイナス価格の商品も含める。明細が空なら 0 */
export function itemsTotal(items: SaleItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0)
}

/** 商品が1つ以上あり、合計が0円以上なら会計できる。0円ちょうどは会計でき、0円未満は確定できない（ADR 0011） */
export function canCheckout(items: SaleItem[]): boolean {
  return items.length > 0 && itemsTotal(items) >= 0
}

/** 会計を確定できるか。canCheckout が真で、お預かり（未入力の null は「ちょうど」）が合計以上なら確定できる */
export function canConfirmSale(items: SaleItem[], paid: number | null): boolean {
  return canCheckout(items) && (paid ?? itemsTotal(items)) >= itemsTotal(items)
}

/**
 * 会計を確定する。お預かりが未入力（null）なら「ちょうど」として、お預かり＝合計にする
 * 確定できないとき（canConfirmSale が偽）は会計を作らず null を返す
 * 支払方法は分けない。キャッシュレスで受け取った分も、お預かり金額を入れて（または「ちょうど」で）記録する（ADR 0018）
 */
export function createSale(items: SaleItem[], paid: number | null, prevSales: Sale[], now = new Date()): Sale | null {
  if (!canConfirmSale(items, paid)) return null
  const total = itemsTotal(items)
  const received = paid ?? total
  return {
    id: crypto.randomUUID(),
    no: nextSaleNo(prevSales),
    at: now.toISOString(),
    items,
    total,
    paid: received,
    change: received - total,
    voided: false,
  }
}

/**
 * 次の会計番号。今ある会計の番号の最大値＋1 で、取り消した会計も数える（番号を詰めない）。会計がなければ 1
 * 保存データの壊れた会計は捨てずに残す（#64）ので、整数でない番号は数えない
 */
function nextSaleNo(sales: Sale[]): number {
  return sales.reduce((max, s) => (Number.isInteger(s.no) ? Math.max(max, s.no) : max), 0) + 1
}

/**
 * 会計を取り消す。消さずに取消済みとして残し、集計からは除く（ADR 0012）。元に戻す処理は持たない
 * すでに取消済みの会計や、ない ID を指定したときは、受け取った配列をそのまま返す
 */
export function voidSale(sales: Sale[], id: string): Sale[] {
  if (!sales.some((s) => s.id === id && !s.voided)) return sales
  return sales.map((s) => (s.id === id ? { ...s, voided: true } : s))
}

/**
 * 取消ボタンを出せる会計の ID。取消済みでなく、ID が文字列で、ほかの会計と重ならないものだけ
 * 保存データの壊れた会計は捨てずに残す（#64）ので、ID がない・重なる会計を取り消すと、選んでいない会計まで取り消されてしまう（#73）
 */
export function voidableSaleIds(sales: Sale[]): Set<string> {
  const count = new Map<unknown, number>()
  for (const s of sales) count.set(s.id, (count.get(s.id) ?? 0) + 1)
  return new Set(sales.filter((s) => !s.voided && typeof s.id === 'string' && count.get(s.id) === 1).map((s) => s.id))
}

export type ProductSummary = { key: string; name: string; qty: number; amount: number }

export type Summary = {
  total: number
  count: number
  byProduct: ProductSummary[]
}

/**
 * 売上を集計する（SPEC「集計」）
 * - 売上合計と会計件数。取り消した会計は入れない（ADR 0012）
 * - 商品ごとの数量と金額を、商品の登録順に出す。マイナス価格の商品（「割引 −50円」など）も同じように出る
 * - 商品は「商品ID＋会計時の名前＋価格」ごとにまとめる
 */
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
  // 商品の登録順に並べる。商品の編集・削除はないので会計の商品は一覧に必ずあるが、
  // 一覧にない商品があっても集計から落とさないよう末尾に置く
  const order = new Map(products.map((p, i) => [p.id, i]))
  const byProduct = [...map.values()].sort((a, b) => {
    const ia = order.get(a.key.split('\u0000')[0]) ?? Infinity
    const ib = order.get(b.key.split('\u0000')[0]) ?? Infinity
    return ia - ib
  })
  return {
    total: active.reduce((sum, s) => sum + s.total, 0),
    count: active.length,
    byProduct,
  }
}
