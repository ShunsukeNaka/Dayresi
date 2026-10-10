import { useEffect, useRef, useState } from 'react'
import type { PaymentMethod } from '../types'
import { formatYen } from '../lib/format'

const MAX_DIGITS = 7
const QUICK_BILLS = [1000, 5000, 10000]

type Props = {
  total: number
  onConfirm: (method: PaymentMethod, paid: number) => void
  onCancel: () => void
}

export function CheckoutDialog({ total, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  // お預かり金額の入力（数字の文字列）。空のときは「ちょうど」として扱う
  const [input, setInput] = useState('')

  const paid = method === 'cash' ? (input === '' ? total : Number(input)) : total
  const change = paid - total
  const canConfirm = change >= 0

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
      <div className="pay-method">
        <button className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>現金</button>
        <button className={method === 'other' ? 'active' : ''} onClick={() => setMethod('other')}>
          その他（キャッシュレス等）
        </button>
      </div>

      <dl className="pay-rows">
        <dt>合計</dt>
        <dd>{formatYen(total)}</dd>
        {method === 'cash' && (
          <>
            <dt>お預かり</dt>
            <dd className={input === '' ? 'placeholder' : ''}>
              {input === '' ? `ちょうど（${formatYen(total)}）` : formatYen(paid)}
            </dd>
            <dt>おつり</dt>
            <dd className={`change${canConfirm ? '' : ' short'}`}>
              {canConfirm ? formatYen(change) : `${formatYen(-change)} 不足`}
            </dd>
          </>
        )}
      </dl>

      {method === 'cash' && (
        <div className="cash-pad">
          <div className="quick">
            {QUICK_BILLS.map((bill) => (
              <button key={bill} onClick={() => setInput(String(bill))} disabled={bill < total}>
                {formatYen(bill)}
              </button>
            ))}
            <button onClick={() => setInput('')}>ちょうど</button>
          </div>
          <div className="keypad">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00'].map((k) => (
              <button key={k} onClick={() => appendDigits(k)}>{k}</button>
            ))}
            <button onClick={() => setInput((prev) => prev.slice(0, -1))} aria-label="1桁削除">⌫</button>
          </div>
        </div>
      )}

      <div className="dialog-actions">
        <button className="secondary" onClick={onCancel}>戻る</button>
        <button className="primary" onClick={() => onConfirm(method, paid)} disabled={!canConfirm}>会計確定</button>
      </div>
    </dialog>
  )
}
