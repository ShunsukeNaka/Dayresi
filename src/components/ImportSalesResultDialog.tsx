import { useEffect, useRef } from 'react'
import type { ImportSalesResult } from '../lib/registers'

type Props = {
  /** 送った人（会計した人）の名前 */
  by: string
  /** 取り込んだ代表者のレジの名前 */
  registerName: string
  result: ImportSalesResult
  onClose: () => void
}

/** 会計を取り込んだ結果（docs/design/dayresi.pen の N-12・P-10、spec-next.md「会計を送る」） */
export function ImportSalesResultDialog({ by, registerName, result, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const merged = result.kind === 'merged'
  const title = merged ? `${by} の会計を取り込みました` : '会計を取り込めませんでした'

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2 className="modal-title result-title">
          {merged && <span className="result-ok" aria-hidden="true">✓</span>}
          {title}
        </h2>
        <button className="modal-close only-narrow" aria-label="閉じる" onClick={onClose}>×</button>
      </div>
      {result.kind === 'merged' ? (
        <>
          <table className="result-table">
            <tbody>
              <tr className="strong"><th>新しく足した会計</th><td>{result.counts.added} 件</td></tr>
              <tr><th>取消済にした会計</th><td>{result.counts.voided} 件</td></tr>
              <tr><th>もう取り込んであった会計</th><td>{result.counts.existing} 件</td></tr>
            </tbody>
          </table>
          <p className="hint result-note">{registerName}の売上に合算しました。集計と履歴で確かめられます。</p>
        </>
      ) : (
        <p className="modal-lead">
          {result.kind === 'member'
            ? 'このレジは会計する人のレジなので、会計を取り込めません。代表者の端末で開いてください。'
            : 'この会計の店の代表者のレジが、この端末にありません。代表者の端末で開いてください。'}
        </p>
      )}
      <div className="modal-actions">
        <button className="primary result-ok-button" onClick={onClose}>OK</button>
      </div>
    </dialog>
  )
}
