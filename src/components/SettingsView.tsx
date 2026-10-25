import { useRef, useState, type Dispatch, type FormEvent } from 'react'
import type { Register } from '../types'
import type { Action } from '../state'
import { MAX_NAME_LENGTH, MAX_PRICE, MIN_PRICE, formatYen, isValidName, parsePrice } from '../lib/format'
import { ExportCsvButton } from './ExportCsvButton'
import { encodeProductsShare, shareUrl } from '../lib/share'
import { ShareDialog } from './ShareDialog'
import { MyNameDialog } from './MyNameDialog'

type Props = {
  data: Register
  dispatch: Dispatch<Action>
}

export function SettingsView({ data, dispatch }: Props) {
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [addError, setAddError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  // 商品を配る手順。自分の名前がまだなければ先に入れてもらい、それから QR とリンクを出す
  const [shareStep, setShareStep] = useState<'name' | 'share' | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)

  const startShare = () => {
    setShareLink(null)
    setShareStep('share')
    void encodeProductsShare({ storeId: data.storeId, name: data.name, products: data.products }).then((f) => setShareLink(shareUrl(f)))
  }

  /**
   * 商品を登録する。入力が正しくなければ理由を出して登録しない（商品名が長すぎるときは入力欄の maxLength で止める）
   * 登録したら入力欄を空にし、続けて次の商品を入力できるよう商品名の欄に戻る
   */
  const addProduct = (e: FormEvent) => {
    e.preventDefault()
    const price = parsePrice(newPrice)
    if (!isValidName(newName)) return setAddError('商品名を入力してください。')
    if (price === null) return setAddError(`価格は ${MIN_PRICE.toLocaleString('ja-JP')}〜${MAX_PRICE.toLocaleString('ja-JP')} の整数で入力してください。`)
    dispatch({ type: 'addProduct', name: newName, price })
    setNewName('')
    setNewPrice('')
    setAddError('')
    nameInputRef.current?.focus()
  }

  /** 全データ消去。商品と会計をすべて消す。消す前にブラウザの確認ダイアログを出す */
  const resetAll = () => {
    const warning = data.sales.length > 0 ? '\n売上CSVを保存していない場合、売上データは復元できません。' : ''
    if (confirm(`商品と売上をすべて消去しますか？${warning}`)) dispatch({ type: 'resetAll' })
  }

  // 会計する人のレジでは、配られた商品を編集できない（spec-next.md「会計する人のレジ」、docs/design/dayresi.pen の N-09）
  const isMember = data.role === 'member'

  return (
    <section className="tab">
      <div className="container page">
        <div className="settings-section">
          <h2 className="page-title">{isMember ? '配られた商品' : '商品'}</h2>
          {isMember ? (
            <p className="hint">代表者が配った商品です。このレジでは編集できません。商品が変わったときは、代表者に配り直してもらいます。</p>
          ) : (
            <p className="hint">価格は税込で入力してください。割引券は「割引」「-50」のように、マイナスの価格の商品として登録できます。</p>
          )}
          {/* 登録フォームを一覧の上に置き、続けて登録しやすくする */}
          {!isMember && <form className="add-product" onSubmit={addProduct}>
            <label className="field">
              <span className="field-label">商品名</span>
              <input
                ref={nameInputRef}
                placeholder="例：焼きそば"
                value={newName}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="field price-field">
              <span className="field-label">価格（税込）</span>
              <input
                placeholder="例：400"
                inputMode="numeric"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </label>
            <button className="primary" type="submit">追加</button>
          </form>}
          {addError && <p className="error">{addError}</p>}
          {/* 登録した商品は、登録順に番号・商品名・価格を文字だけで並べる。編集・削除・並べ替えはしない */}
          {data.products.length > 0 && (
            <ol className="product-list">
              {data.products.map((p, i) => (
                <li key={p.id}>
                  <span className="index">{i + 1}</span>
                  <span className="name">{p.name}</span>
                  <span className={p.price < 0 ? 'price minus' : 'price'}>{formatYen(p.price)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 商品を配る（spec-next.md「商品を配る」、docs/design/dayresi.pen の N-07）。代表者のレジだけ */}
        {data.role === 'owner' && (
          <div className="settings-section">
            <h2 className="page-title">商品を配る</h2>
            <div className="share-section">
              <p className="hint">会計する人に商品を配ります。QR をスマホのカメラで読んでもらうか、リンクを送ります。商品を足したときは、配り直してください。</p>
              <button className="primary" onClick={() => (data.myName ? startShare() : setShareStep('name'))} disabled={data.products.length === 0}>
                商品を配る
              </button>
            </div>
          </div>
        )}

        {!isMember && <div className="settings-section">
          <h2 className="page-title">データ</h2>
          {/* 売上 CSV の保存（会計がないときは押せない）と全データ消去（商品も会計もないときは押せない）。消す前に確認する */}
          <div className="data-actions">
            <div className="data-action">
              <p className="hint">売上明細を CSV ファイルに保存します。Excel でそのまま開けます。</p>
              <ExportCsvButton sales={data.sales} />
            </div>
            <div className="data-action">
              <p className="hint">商品と売上をすべて消します。元には戻せません。</p>
              <button className="danger" onClick={resetAll} disabled={data.products.length === 0 && data.sales.length === 0}>
                全データを消去
              </button>
            </div>
          </div>
        </div>}
      </div>

      {shareStep === 'name' && (
        <MyNameDialog
          hint="履歴や売上 CSV で、誰の会計かを見分けるのに使います。"
          onSubmit={(name) => {
            dispatch({ type: 'setMyName', name })
            startShare()
          }}
          onClose={() => setShareStep(null)}
        />
      )}
      {shareStep === 'share' && (
        <ShareDialog
          title="商品を配る"
          heading={data.name}
          sub={`商品 ${data.products.length} つ`}
          hint="会計する人に、スマホのカメラで読んでもらいます。離れている人には、リンクを送ります。"
          url={shareLink}
          onClose={() => setShareStep(null)}
        />
      )}
    </section>
  )
}
