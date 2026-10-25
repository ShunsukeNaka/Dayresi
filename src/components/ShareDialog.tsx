import { useEffect, useMemo, useRef, useState } from 'react'
import { qrModules } from '../lib/qr'
import { QrCode } from './QrCode'

type Props = {
  title: string
  /** 何を渡すか（例：研究室の模擬店／田中 の会計） */
  heading: string
  /** 数など（例：商品 6 つ） */
  sub: string
  /** QR の読み方の説明 */
  hint: string
  /** 渡すリンク。作っている途中は null */
  url: string | null
  onClose: () => void
}

/**
 * QR とリンクで渡すダイアログ（docs/design/dayresi.pen の N-08・N-10・N-11、P-07〜P-09）
 * リンクは共有機能（navigator.share）で送る。共有機能がない PC では、リンクをコピーする
 * QR に入らないほど大きいときは、QR を出さずにリンクで送るよう案内する
 */
export function ShareDialog({ title, heading, sub, hint, url, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  const modules = useMemo(() => (url ? qrModules(url) : null), [url])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const sendLink = async () => {
    if (!url) return
    if (navigator.share) {
      try {
        await navigator.share({ title: `Dayresi：${heading}`, url })
      } catch { /* 共有をやめたとき */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch { /* コピーできないブラウザ */ }
  }

  const tooLarge = url !== null && modules === null

  return (
    <dialog
      ref={dialogRef}
      className="modal share-modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2 className="modal-title">{title}</h2>
        <button className="modal-close only-narrow" aria-label="閉じる" onClick={onClose}>×</button>
      </div>
      <div className={tooLarge ? 'share-body too-large' : 'share-body'}>
        {!tooLarge && (
          <div className="qr-frame">
            {modules ? <QrCode modules={modules} label={`${heading}の QR コード`} /> : <div className="qr-placeholder" />}
          </div>
        )}
        <div className="share-info">
          <div className="share-summary">
            <div className="share-heading">{heading}</div>
            <div className="share-sub">{sub}</div>
          </div>
          {tooLarge ? (
            <p className="share-warning">QR コードに入りきりません。リンクを LINE などで送ってください。</p>
          ) : (
            <p className="hint">{hint}</p>
          )}
          <button className={tooLarge ? 'primary share-link' : 'secondary share-link'} onClick={sendLink} disabled={!url}>
            リンクを送る
          </button>
          {copied && <p className="hint" role="status">リンクをコピーしました。LINE などに貼り付けて送ってください。</p>}
        </div>
      </div>
      <div className="modal-actions only-wide">
        <button className="secondary" onClick={onClose}>閉じる</button>
      </div>
    </dialog>
  )
}
