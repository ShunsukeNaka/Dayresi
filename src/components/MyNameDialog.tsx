import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MAX_NAME_LENGTH, isValidName } from '../lib/format'

type Props = {
  onSubmit: (name: string) => void
  onClose: () => void
}

/** 自分の名前を入れるダイアログ。自動で作ったマイレジで、商品を配る前に入れてもらう（spec-next.md「自分の名前」） */
export function MyNameDialog({ onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidName(name)) return setError('自分の名前を入力してください。')
    onSubmit(name)
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label="自分の名前"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2 className="modal-title">自分の名前</h2>
        <button className="modal-close only-narrow" aria-label="閉じる" onClick={onClose}>×</button>
      </div>
      <form className="modal-form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">自分の名前</span>
          <input placeholder="例：田中" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => { setName(e.target.value); setError('') }} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary only-wide" onClick={onClose}>やめる</button>
          <button type="submit" className="primary">次へ</button>
        </div>
      </form>
    </dialog>
  )
}
