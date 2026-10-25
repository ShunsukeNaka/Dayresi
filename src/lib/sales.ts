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
 * 次の会計番号。自分の会計の番号の最大値＋1 で、取り消した会計も数える（番号を詰めない）。会計がなければ 1
 * 代表者のレジに取り込んだ、ほかの人の会計（by がある）は数えない。会計番号は会計する人ごとに 1 から振る（spec-next.md「自分の名前」）
 * 保存データの壊れた会計は捨てずに残す（#64）ので、整数でない番号は数えない
 */
function nextSaleNo(sales: Sale[]): number {
  return sales.reduce((max, s) => (s.by === undefined && Number.isInteger(s.no) ? Math.max(max, s.no) : max), 0) + 1
}

/** 会計を取り込んだ結果の件数 */
export type MergeCounts = {
  /** 新しく足した会計 */
  added: number
  /** 取消済にした会計（もう取り込んであって、送った人が取り消したもの） */
  voided: number
  /** もう取り込んであった会計（取消の変化もなかったもの） */
  existing: number
}

/**
 * 送られた会計を、代表者のレジの会計に合算する（spec-next.md「会計を送る」）
 * - 会計の ID で同じ会計を見分け、まだない会計だけを、会計した人の名前（by）を付けて足す
 * - もう取り込んであって、送った人が取り消していれば取消済にする。取消済を取り消し前に戻すことはない
 * - 合算した会計は、時刻の順に並べ直す
 * 何も変わらなければ、受け取った会計の配列をそのまま返す
 */
export function mergeSales(sales: Sale[], incoming: Sale[], by: string): { sales: Sale[]; counts: MergeCounts } {
  const counts: MergeCounts = { added: 0, voided: 0, existing: 0 }
  const index = new Map(sales.map((s, i) => [s.id, i]))
  const next = [...sales]
  for (const sale of incoming) {
    const i = index.get(sale.id)
    if (i === undefined) {
      index.set(sale.id, next.length)
      next.push({ ...sale, by })
      counts.added++
    } else if (sale.voided && !next[i].voided) {
      next[i] = { ...next[i], voided: true }
      counts.voided++
    } else {
      counts.existing++
    }
  }
  if (counts.added === 0 && counts.voided === 0) return { sales, counts }
  // 時刻が読めない会計は、もとの位置のまま残るよう、並べ直しは安定な sort に任せる
  const time = (s: Sale) => Date.parse(s.at)
  next.sort((a, b) => (Number.isNaN(time(a)) || Number.isNaN(time(b)) ? 0 : time(a) - time(b)))
  return { sales: next, counts }
}

/**
 * 会計を取り消す。消さずに取消済みとして残し、集計からは除く（ADR 0012）。元に戻す処理は持たない
 * すでに取消済みの会計や、ない ID を指定したときは、受け取った配列をそのまま返す
 */
export function voidSale(sales: Sale[], id: string): Sale[] {
  // 代表者のレジに取り込んだ、ほかの人の会計は取り消せない。取消は会計した人のレジで行う（spec-next.md「会計の取消」）
  if (!sales.some((s) => s.id === id && !s.voided && s.by === undefined)) return sales
  return sales.map((s) => (s.id === id ? { ...s, voided: true } : s))
}

/**
 * 取消ボタンを出せる会計の ID。取消済みでなく、ほかの人から受け取った会計でなく、ID が文字列で、ほかの会計と重ならないものだけ
 * 保存データの壊れた会計は捨てずに残す（#64）ので、ID がない・重なる会計を取り消すと、選んでいない会計まで取り消されてしまう（#73）
 */
export function voidableSaleIds(sales: Sale[]): Set<string> {
  const count = new Map<unknown, number>()
  for (const s of sales) count.set(s.id, (count.get(s.id) ?? 0) + 1)
  return new Set(sales.filter((s) => !s.voided && s.by === undefined && typeof s.id === 'string' && count.get(s.id) === 1).map((s) => s.id))
}

export type ProductSummary = {
  key: string
  name: string
  qty: number
  amount: number
  /** 売上に占める割合（0〜1）。金額がプラスの商品だけにあり、0 円以下の商品は null */
  share: number | null
}

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
 * - 割合は、商品の金額 ÷ 金額がプラスの商品の金額の合計。マイナスの商品を入れると合計が 100% を超えるので、プラスの商品だけで割る
 */
export function summarize(sales: Sale[], products: Product[]): Summary {
  const active = sales.filter((s) => !s.voided)
  const map = new Map<string, ProductSummary>()
  for (const sale of active) {
    for (const item of sale.items) {
      const key = `${item.productId}\u0000${item.name}\u0000${item.price}`
      const row = map.get(key) ?? { key, name: item.name, qty: 0, amount: 0, share: null }
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
  const plusTotal = byProduct.reduce((sum, r) => (r.amount > 0 ? sum + r.amount : sum), 0)
  for (const r of byProduct) r.share = r.amount > 0 ? r.amount / plusTotal : null
  return {
    total: active.reduce((sum, s) => sum + s.total, 0),
    count: active.length,
    byProduct,
  }
}
