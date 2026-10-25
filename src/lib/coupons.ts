import type { Coupon, SaleDiscount } from '../types'
import { formatYen, isValidCouponValue, isValidName } from './format'

/** カートで選んだ割引券。割引券ID → 枚数（% 引きは 1） */
export type CartCoupons = Record<string, number>

/**
 * 割引を計算する（spec-next.md「割引券」）
 * - % 引きは 1 枚まで。商品の合計にかけ、引く金額の 1 円未満は切り捨てる。% 引きを 2 つ以上選んでいれば、割引券の並びで最初のものだけを使う
 * - そのあとで、金額引きを割引券の並びの順に引く。金額引きは何枚でも使える
 * - 割引が合計より大きいときは、合計を 0 円で止める。引いた金額は、実際に引けた分にする
 * 返す discounts には、選んだ割引券のうち使ったものだけが、割引券の並びの順に入る
 */
export function applyCoupons(subtotal: number, coupons: Coupon[], selected: CartCoupons): { discounts: SaleDiscount[]; total: number } {
  let rest = Math.max(0, subtotal)
  const used = coupons.filter((c) => (selected[c.id] ?? 0) > 0)
  const percent = used.find((c) => c.kind === 'percent')
  const discounts: SaleDiscount[] = []
  const record = (c: Coupon, qty: number, want: number) => {
    const amount = Math.min(want, rest)
    rest -= amount
    discounts.push({ couponId: c.id, name: c.name, kind: c.kind, value: c.value, qty, amount })
  }
  if (percent) record(percent, 1, Math.floor((rest * percent.value) / 100))
  for (const c of used) {
    if (c.kind === 'amount') record(c, Math.floor(selected[c.id]), c.value * Math.floor(selected[c.id]))
  }
  // 並びを割引券の登録順にそろえる（% 引きを先に計算したので、並べ直す）
  discounts.sort((a, b) => used.findIndex((c) => c.id === a.couponId) - used.findIndex((c) => c.id === b.couponId))
  return { discounts, total: rest }
}

/**
 * 割引券を末尾に足した新しい配列を返す。ID は crypto.randomUUID() で振る
 * 名前か値がルールに合わないときは、受け取った配列をそのまま返す（商品の addProduct と同じ）
 */
export function addCoupon(coupons: Coupon[], name: string, kind: Coupon['kind'], value: number): Coupon[] {
  if (!isValidName(name) || !isValidCouponValue(kind, value)) return coupons
  return [...coupons, { id: crypto.randomUUID(), name, kind, value }]
}

/** 割引券の値の表示。金額引きは −¥50、% 引きは 10%引き */
export function couponLabel(c: Pick<Coupon, 'kind' | 'value'>): string {
  return c.kind === 'amount' ? formatYen(-c.value) : `${c.value}%引き`
}

/**
 * 割引券のボタンを押したとき（spec-next.md「割引券」、docs/design/dayresi.pen の K-01）
 * - 金額引き：1 枚増やす（上限 MAX_COUPON_QTY）
 * - % 引き：使っていれば外し、使っていなければ使う。% 引きは 1 枚までなので、ほかの % 引きは外す
 */
export function toggleCartCoupon(cart: CartCoupons, coupons: Coupon[], id: string): CartCoupons {
  const coupon = coupons.find((c) => c.id === id)
  if (!coupon) return cart
  if (coupon.kind === 'amount') return { ...cart, [id]: Math.min((cart[id] ?? 0) + 1, MAX_COUPON_QTY) }
  if (cart[id]) return removeKey(cart, id)
  const percentIds = new Set(coupons.filter((c) => c.kind === 'percent').map((c) => c.id))
  const next = Object.fromEntries(Object.entries(cart).filter(([k]) => !percentIds.has(k)))
  return { ...next, [id]: 1 }
}

/** 金額引きの枚数を delta だけ変える。0 以下になったら外し、MAX_COUPON_QTY で止まる */
export function changeCartCouponQty(cart: CartCoupons, id: string, delta: number): CartCoupons {
  const qty = Math.min((cart[id] ?? 0) + delta, MAX_COUPON_QTY)
  return qty > 0 ? { ...cart, [id]: qty } : removeKey(cart, id)
}

/** 割引券をカートから外す（% 引きの × ボタン） */
export function removeCartCoupon(cart: CartCoupons, id: string): CartCoupons {
  return id in cart ? removeKey(cart, id) : cart
}

/** 1 回の会計で使える、金額引きの割引券の枚数の上限（商品の数量と同じ） */
export const MAX_COUPON_QTY = 999

function removeKey(cart: CartCoupons, id: string): CartCoupons {
  const next = { ...cart }
  delete next[id]
  return next
}
