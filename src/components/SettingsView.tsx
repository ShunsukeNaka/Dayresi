import { useRef, useState, type Dispatch, type FormEvent } from 'react'
import type { AppData, Product } from '../types'
import type { Action } from '../state'
import { MAX_NAME_LENGTH, MAX_PRICE, fileStamp, isValidName, isValidPrice, newId } from '../lib/format'
import { ProductFileError, parseProductFile, productsToFile } from '../lib/productFile'
import { downloadFile } from '../lib/download'
import { ExportCsvButton } from './ExportCsvButton'

type Props = {
  data: AppData
  dispatch: Dispatch<Action>
  onToast: (message: string) => void
}

/** 入力中の文字列を価格に変換する。不正なら null */
function parsePrice(s: string): number | null {
  if (!/^\d+$/.test(s.trim())) return null
  const n = Number(s.trim())
  return isValidPrice(n) ? n : null
}

function ProductRow({ product, index, count, dispatch }: { product: Product; index: number; count: number; dispatch: Dispatch<Action> }) {
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))

  const commit = () => {
    const p = parsePrice(price)
    if (isValidName(name) && p !== null) {
      if (name.trim() !== product.name || p !== product.price) {
        dispatch({ type: 'updateProduct', product: { ...product, name: name.trim(), price: p } })
      }
    } else {
      // 不正な入力は元に戻す
      setName(product.name)
      setPrice(String(product.price))
    }
  }

  return (
    <li>
      <input
        aria-label="商品名"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <input
        aria-label="価格"
        inputMode="numeric"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="ops">
        <button aria-label="上へ" disabled={index === 0} onClick={() => dispatch({ type: 'moveProduct', id: product.id, delta: -1 })}>↑</button>
        <button aria-label="下へ" disabled={index === count - 1} onClick={() => dispatch({ type: 'moveProduct', id: product.id, delta: 1 })}>↓</button>
        <button
          className="danger"
          aria-label="削除"
          onClick={() => {
            if (confirm(`「${product.name}」を削除しますか？\n（これまでの売上記録は残ります）`)) dispatch({ type: 'removeProduct', id: product.id })
          }}
        >
          削除
        </button>
      </span>
    </li>
  )
}

export function SettingsView({ data, dispatch, onToast }: Props) {
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [addError, setAddError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addProduct = (e: FormEvent) => {
    e.preventDefault()
    const price = parsePrice(newPrice)
    if (!isValidName(newName)) return setAddError('商品名を入力してください。')
    if (price === null) return setAddError(`価格は 0〜${MAX_PRICE.toLocaleString('ja-JP')} の整数で入力してください。`)
    dispatch({ type: 'addProduct', product: { id: newId(), name: newName.trim(), price } })
    setNewName('')
    setNewPrice('')
    setAddError('')
    nameInputRef.current?.focus()
  }

  const exportProducts = () => {
    downloadFile(`dayresi-products-${fileStamp()}.json`, productsToFile(data.products), 'application/json')
  }

  const importProducts = async (file: File) => {
    try {
      const products = parseProductFile(await file.text())
      const message = data.products.length > 0
        ? `${products.length} 件の商品を読み込みます。\n今の商品設定（${data.products.length} 件）は置き換えられます。よろしいですか？`
        : `${products.length} 件の商品を読み込みますか？`
      if (!confirm(message)) return
      dispatch({ type: 'replaceProducts', products })
      onToast(`${products.length} 件の商品を読み込みました`)
    } catch (err) {
      alert(err instanceof ProductFileError ? err.message : 'ファイルの読み込みに失敗しました。')
    }
  }

  const resetAll = () => {
    const warning = data.sales.length > 0 ? '\n売上CSVを保存していない場合、売上データは復元できません。' : ''
    if (confirm(`商品と売上をすべて消去しますか？${warning}`)) {
      dispatch({ type: 'resetAll' })
      onToast('すべてのデータを消去しました')
    }
  }

  return (
    <section className="tab">
      <div className="container">
        <div className="panel">
          <h2>商品</h2>
          <p className="hint">価格は税込で入力してください。</p>
          {data.products.length > 0 && (
            <ul className="product-editor">
              {data.products.map((p, i) => (
                <ProductRow key={p.id} product={p} index={i} count={data.products.length} dispatch={dispatch} />
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
          <h2>商品設定ファイル</h2>
          <p className="hint">
            別の端末で作った商品設定を、ファイルでこの端末に移せます。ファイルには売上データは含まれません。
          </p>
          <div className="row-actions">
            <button className="secondary" onClick={exportProducts} disabled={data.products.length === 0}>
              ファイルに書き出す
            </button>
            <button className="secondary" onClick={() => fileInputRef.current?.click()}>
              ファイルを読み込む
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void importProducts(file)
              }}
            />
          </div>
        </div>

        <div className="panel">
          <h2>データ</h2>
          <p className="hint">
            データはこの端末のブラウザの中だけに保存され、サーバーには送信されません。
            ブラウザのデータを消したり、プライベートブラウズで使ったりすると消えるため、終了時には売上CSVを保存してください。
          </p>
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
