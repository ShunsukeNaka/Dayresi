import { useRef, useState, type Dispatch, type FormEvent } from 'react'
import type { AppData } from '../types'
import type { Action } from '../state'
import { MAX_NAME_LENGTH, MAX_PRICE, MIN_PRICE, formatYen, isValidName, parsePrice } from '../lib/format'
import { ExportCsvButton } from './ExportCsvButton'

type Props = {
  data: AppData
  dispatch: Dispatch<Action>
}

export function SettingsView({ data, dispatch }: Props) {
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [addError, setAddError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <section className="tab">
      <div className="container">
        <div className="panel">
          <h2>商品</h2>
          <p className="hint">価格は税込で入力してください。割引券は「割引」「-50」のように、マイナスの価格の商品として登録できます。</p>
          {data.products.length > 0 && (
            <ul className="product-list">
              {data.products.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className="price">{formatYen(p.price)}</span>
                </li>
              ))}
            </ul>
          )}
          <form className="add-product" onSubmit={addProduct}>
            <input
              ref={nameInputRef}
              placeholder="商品名"
              aria-label="新しい商品名"
              value={newName}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              placeholder="価格"
              aria-label="新しい商品の価格"
              inputMode="numeric"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            <button className="primary" type="submit">追加</button>
          </form>
          {addError && <p className="error">{addError}</p>}
        </div>

        <div className="panel">
          <h2>データ</h2>
          {/* 売上 CSV の保存（会計がないときは押せない）と全データ消去（商品も会計もないときは押せない） */}
          <div className="row-actions">
            <ExportCsvButton sales={data.sales} />
            <button className="danger" onClick={resetAll} disabled={data.products.length === 0 && data.sales.length === 0}>
              全データを消去
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
