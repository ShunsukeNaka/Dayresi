import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Register } from '../types'
import type { ProductsShare } from '../lib/share'
import { MAX_NAME_LENGTH, formatYen, isValidName } from '../lib/format'

/** 確認に出す商品の数。残りは「ほか n つ」にまとめる */
const PREVIEW = 3

type Props = {
  share: ProductsShare
  /** 同じ店のレジがこの端末にあれば、そのレジ */
  existing: Register | undefined
  /** 取り込む。新しく足すときは自分の名前を渡す */
  onImport: (myName: string) => void
  onClose: () => void
}

/**
 * 配られた商品の取り込みの確認（docs/design/dayresi.pen の N-06・P-05、spec-next.md「商品を配る」）
 * - 同じ店のレジがない：自分の名前を入れて、会計する人のレジとして足す
 * - 同じ店の会計する人のレジがある：商品を新しくする
 * - 同じ店の代表者のレジがある（自分で配ったリンクを開いた）：取り込まない
 */
export function ImportProductsDialog({ share, existing, onImport, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [myName, setMyName] = useState('')
  const [error, setError] = useState('')
  const mode = existing === undefined ? 'add' : existing.role === 'member' ? 'update' : 'own'

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'add' && !isValidName(myName)) return setError('自分の名前を入力してください。')
    onImport(myName)
  }

  const rest = share.products.length - PREVIEW

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label="レジを追加"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2 className="modal-title">{mode === 'add' ? 'レジを追加' : mode === 'update' ? '商品を新しくする' : '自分が配った商品です'}</h2>
        <button className="modal-close only-narrow" aria-label="閉じる" onClick={onClose}>×</button>
      </div>
      {mode === 'own' ? (
        <>
          <p className="modal-lead">「{share.name}」は、この端末で代表者として作ったレジです。会計する人のスマホで読んでもらってください。</p>
          <div className="modal-actions">
            <button className="secondary" onClick={onClose}>閉じる</button>
          </div>
        </>
      ) : (
        <form className="modal-form" onSubmit={submit}>
          <p className="modal-lead">
            {mode === 'add'
              ? `「${share.name}」から商品が配られました。会計する人としてレジを追加します。`
              : `「${share.name}」から新しい商品が配られました。このレジの商品を新しくします。これまでの会計は残ります。`}
          </p>
          <div className="preview-list">
            <div className="preview-head">配られた商品（{share.products.length}）</div>
            <ul>
              {share.products.slice(0, PREVIEW).map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className={p.price < 0 ? 'price minus' : 'price'}>{formatYen(p.price)}</span>
                </li>
              ))}
              {rest > 0 && <li className="preview-rest">…ほか {rest} つ</li>}
            </ul>
          </div>
          {mode === 'add' && (
            <label className="field">
              <span className="field-label">自分の名前</span>
              <input autoFocus placeholder="例：田中" value={myName} maxLength={MAX_NAME_LENGTH} onChange={(e) => { setMyName(e.target.value); setError('') }} />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <p className="hint">配られた商品は、このレジでは編集できません。商品が変わったときは、代表者に配り直してもらいます。</p>
          <div className="modal-actions">
            <button type="button" className="secondary only-wide" onClick={onClose}>やめる</button>
            <button type="submit" className="primary">{mode === 'add' ? '追加する' : '新しくする'}</button>
          </div>
        </form>
      )}
    </dialog>
  )
}
