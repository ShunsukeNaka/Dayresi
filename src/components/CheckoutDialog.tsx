import { useEffect, useRef, useState } from 'react'
import { formatYen } from '../lib/format'

/** お預かり金額の入力の上限の桁数（¥9,999,999） */
const MAX_DIGITS = 7
/** 金額ボタン。合計より少ない金額は押せない */
const QUICK_BILLS = [1000, 5000, 10000]

type Props = {
  total: number
  /** お預かり金額。未入力（「ちょうど」）なら null */
  onConfirm: (paid: number | null) => void
  onCancel: () => void
}

/**
 * 会計ダイアログ。合計・お預かり・おつりを出す
 * お預かりは金額ボタンとテンキーで入れる（操作はマウスで、キーボードのショートカットは作らない）
 * 「会計確定」で会計を記録し、「戻る」（または Esc）でカートに戻る
 */
export function CheckoutDialog({ total, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  // お預かり金額の入力（数字の文字列）。空のときは「ちょうど」として扱う
  const [input, setInput] = useState('')

  const paid = input === '' ? total : Number(input)
  const change = paid - total
  // canConfirmSale（src/lib/sales.ts）と同じ判定。ダイアログには明細を渡さず合計だけを渡しており、
  // 商品が 1 つ以上あることは開く前に canCheckout で確かめているので、ここではお預かりが合計以上かだけを見る。
  // 確定するときは App が canConfirmSale で確かめ直す
  const canConfirm = total >= 0 && change >= 0

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const appendDigits = (digits: string) => {
    setInput((prev) => {
      const next = (prev + digits).replace(/^0+(?=\d)/, '')
      return next.length > MAX_DIGITS ? prev : next
    })
  }

  return (
    <dialog
      ref={dialogRef}
      className="checkout"
      aria-label="会計"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="checkout-head">
        <h2 className="checkout-title">会計</h2>
        {/* スマホでは全画面のページになり、「戻る」の代わりに × で戻る（docs/design/dayresi.pen の M-02） */}
        <button className="modal-close only-narrow" aria-label="戻る" onClick={onCancel}>×</button>
      </div>
      {/* 左に金額（合計・お預かり・おつり）、右に金額ボタンとテンキーを並べる */}
      <div className="checkout-body">
        <div className="pay-col">
          <dl className="pay-rows">
            <div className="pay-row">
              <dt>合計</dt>
              <dd>{formatYen(total)}</dd>
            </div>
            <div className="pay-row paid">
              <dt>お預かり</dt>
              <dd className={input === '' ? 'placeholder' : ''}>
                {input === '' ? `ちょうど（${formatYen(total)}）` : formatYen(paid)}
              </dd>
            </div>
            <div className="pay-row">
              <dt>おつり</dt>
              <dd className={`change${change >= 0 ? '' : ' short'}`}>
                {change >= 0 ? formatYen(change) : `${formatYen(-change)} 不足`}
              </dd>
            </div>
          </dl>
        </div>

        <div className="cash-pad">
          <div className="quick">
            {QUICK_BILLS.map((bill) => (
              <button key={bill} className="secondary" onClick={() => setInput(String(bill))} disabled={bill < total}>
                {formatYen(bill)}
              </button>
            ))}
            <button className="secondary" onClick={() => setInput('')}>ちょうど</button>
          </div>
          <div className="keypad">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00'].map((k) => (
              <button key={k} onClick={() => appendDigits(k)}>{k}</button>
            ))}
            <button onClick={() => setInput((prev) => prev.slice(0, -1))} aria-label="1桁削除">⌫</button>
          </div>
        </div>
      </div>

      <div className="dialog-actions">
        <button className="secondary only-wide" onClick={onCancel}>戻る</button>
        <button className="primary" onClick={() => onConfirm(input === '' ? null : paid)} disabled={!canConfirm}>会計確定</button>
      </div>
    </dialog>
  )
}
