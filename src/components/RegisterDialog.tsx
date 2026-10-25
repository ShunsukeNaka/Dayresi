import { useEffect, useRef, useState, type Dispatch, type FormEvent } from 'react'
import type { Store } from '../types'
import type { Action } from '../state'
import { MAX_NAME_LENGTH, isValidName } from '../lib/format'
import { ROLE_LABEL } from '../lib/registers'

type View = 'list' | 'add' | 'create' | 'import'

const TITLES: Record<View, string> = {
  list: 'レジ',
  add: 'レジを追加',
  create: '新しいレジを作る',
  import: 'データを取り込んで追加',
}

type Props = {
  store: Store
  dispatch: Dispatch<Action>
  /** レジを切り替えた・作ったとき。カートを空にするのに使う */
  onRegisterChange: () => void
  /** 新しいレジを作ったとき。商品を登録できるよう設定画面に移るのに使う */
  onCreated: () => void
  onClose: () => void
}

/**
 * レジのダイアログ（docs/design/dayresi.pen の N-02〜N-05・P-01〜P-04）
 * レジの一覧 →「レジを追加」→「新しいレジを作る」か「データを取り込んで追加」（手順の案内）と、中の表示を切り替える
 * 狭い画面では全画面のページになり、右上の × で閉じる
 */
export function RegisterDialog({ store, dispatch, onRegisterChange, onCreated, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [view, setView] = useState<View>('list')
  const [name, setName] = useState('')
  const [myName, setMyName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const back = () => {
    setError('')
    setView(view === 'create' || view === 'import' ? 'add' : 'list')
  }

  const switchTo = (id: string) => {
    if (id !== store.currentId) {
      dispatch({ type: 'switchRegister', id })
      onRegisterChange()
    }
    onClose()
  }

  const remove = (id: string, label: string, sales: number) => {
    const warning = sales > 0 ? '\n売上CSVを保存していない場合、売上データは復元できません。' : ''
    if (!confirm(`「${label}」を削除しますか？\nこのレジの商品と売上はすべて消え、元に戻せません。${warning}`)) return
    if (id === store.currentId) onRegisterChange()
    dispatch({ type: 'deleteRegister', id })
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidName(name)) return setError('レジの名前を入力してください。')
    if (!isValidName(myName)) return setError('自分の名前を入力してください。')
    dispatch({ type: 'createRegister', name, myName })
    onRegisterChange()
    onCreated()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label={TITLES[view]}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2 className="modal-title">{TITLES[view]}</h2>
        <button className="modal-close only-narrow" aria-label="閉じる" onClick={onClose}>×</button>
      </div>

      {view === 'list' && (
        <>
          <ul className="register-list">
            {store.registers.map((r) => (
              <li key={r.id} className={r.id === store.currentId ? 'current' : ''}>
                <button className="register-pick" onClick={() => switchTo(r.id)} aria-current={r.id === store.currentId}>
                  <span className="register-mark" aria-hidden="true">{r.id === store.currentId ? '✓' : ''}</span>
                  <span className="register-name">{r.name}</span>
                  <span className={`role-tag ${r.role}`}>{ROLE_LABEL[r.role]}</span>
                </button>
                <button className="register-delete" aria-label={`${r.name}を削除`} onClick={() => remove(r.id, r.name, r.sales.length)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </li>
            ))}
          </ul>
          <button className="secondary add-register" onClick={() => setView('add')}>＋ レジを追加</button>
          <div className="modal-actions only-wide">
            <button className="secondary" onClick={onClose}>閉じる</button>
          </div>
        </>
      )}

      {view === 'add' && (
        <>
          <div className="choice-list">
            <button className="choice" onClick={() => setView('create')}>
              <span className="choice-icon" aria-hidden="true">＋</span>
              <span className="choice-title">新しいレジを作る</span>
            </button>
            <button className="choice" onClick={() => setView('import')}>
              <span className="choice-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" fill="currentColor" /></svg>
              </span>
              <span className="choice-title">データを取り込んで追加</span>
            </button>
          </div>
          <div className="modal-actions only-wide">
            <button className="secondary" onClick={back}>戻る</button>
          </div>
        </>
      )}

      {view === 'create' && (
        <form className="modal-form" onSubmit={create}>
          <label className="field">
            <span className="field-label">レジの名前</span>
            <input placeholder="例：研究室の模擬店" value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => { setName(e.target.value); setError('') }} />
          </label>
          <label className="field">
            <span className="field-label">自分の名前</span>
            <input placeholder="例：田中" value={myName} maxLength={MAX_NAME_LENGTH} onChange={(e) => { setMyName(e.target.value); setError('') }} />
          </label>
          {error && <p className="error">{error}</p>}
          <p className="hint">自分がこのレジの代表者になります。作ったら、設定で商品を登録して配ります。</p>
          <div className="modal-actions">
            <button type="button" className="secondary only-wide" onClick={back}>戻る</button>
            <button type="submit" className="primary">作る</button>
          </div>
        </form>
      )}

      {view === 'import' && (
        <>
          <ol className="steps">
            <li>代表者に、設定の「商品を配る」で QR を出してもらいます</li>
            <li>スマホのカメラで QR を読みます。リンクを受け取ったときは、そのリンクを開きます</li>
            <li>Dayresi が開いたら、自分の名前を入れて追加します</li>
          </ol>
          <div className="modal-actions only-wide">
            <button className="secondary" onClick={onClose}>閉じる</button>
          </div>
        </>
      )}
    </dialog>
  )
}
