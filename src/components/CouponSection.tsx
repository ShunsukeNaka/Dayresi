import { useRef, useState, type Dispatch, type FormEvent } from 'react'
import type { CouponKind, Register } from '../types'
import type { Action } from '../state'
import { MAX_NAME_LENGTH, MAX_PERCENT, MAX_PRICE, isValidName, parseCouponValue } from '../lib/format'
import { couponLabel } from '../lib/coupons'

type Props = {
  data: Register
  dispatch: Dispatch<Action>
}

const KINDS: { kind: CouponKind; label: string; unit: string; max: number }[] = [
  { kind: 'amount', label: '金額引き', unit: '円', max: MAX_PRICE },
  { kind: 'percent', label: '% 引き', unit: '%', max: MAX_PERCENT },
]

/**
 * 設定の「割引券」の区画（docs/design/dayresi.pen の K-03・K-13、spec-next.md「割引券」）
 * 代表者のレジでは、名前・金額引きか % 引きか・値を入れて登録し、一覧を出す。編集・削除・並べ替えはしない
 * 会計する人のレジでは、配られた割引券の一覧だけを出す（編集できない）。割引券がなければ区画を出さない
 */
export function CouponSection({ data, dispatch }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CouponKind>('amount')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const isMember = data.role === 'member'
  const current = KINDS.find((k) => k.kind === kind)!

  if (isMember && data.coupons.length === 0) return null

  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = parseCouponValue(kind, value)
    if (!isValidName(name)) return setError('割引券の名前を入力してください。')
    if (n === null) return setError(`${current.label}は 1〜${current.max.toLocaleString('ja-JP')} の整数で入力してください。`)
    dispatch({ type: 'addCoupon', name, kind, value: n })
    setName('')
    setValue('')
    setError('')
    nameRef.current?.focus()
  }

  return (
    <div className="settings-section">
      <h2 className="page-title">{isMember ? '配られた割引券' : '割引券'}</h2>
      {!isMember && (
        <form className="add-coupon" onSubmit={add}>
          <label className="field coupon-name">
            <span className="field-label">名前</span>
            <input ref={nameRef} placeholder="例：50円引き券" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => { setName(e.target.value); setError('') }} />
          </label>
          <div className="field">
            <span className="field-label">種類</span>
            <div className="kind-toggle" role="radiogroup" aria-label="種類">
              {KINDS.map((k) => (
                <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} className={kind === k.kind ? 'on' : ''} onClick={() => { setKind(k.kind); setError('') }}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field coupon-value">
            <span className="field-label">{kind === 'amount' ? '引く金額' : '引く割合'}</span>
            <span className="unit-input">
              <input placeholder={kind === 'amount' ? '例：50' : '例：10'} inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value); setError('') }} />
              <span className="unit">{current.unit}</span>
            </span>
          </label>
          <button className="primary" type="submit">追加</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {data.coupons.length > 0 && (
        <ol className="product-list coupon-list">
          {data.coupons.map((c, i) => (
            <li key={c.id}>
              <span className="index">{i + 1}</span>
              <span className="name">{c.name}</span>
              <span className="price minus">{couponLabel(c)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
