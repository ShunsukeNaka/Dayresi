import { useState } from 'react'
import type { Product, SaleItem } from '../types'
import { formatYen } from '../lib/format'
import { canCheckout } from '../lib/sales'

type Props = {
  products: Product[]
  items: SaleItem[]
  total: number
  /** 商品ボタンを押したとき。カートに 1 つ入れる */
  onAddItem: (id: string) => void
  onChangeQty: (id: string, delta: number) => void
  onClear: () => void
  onCheckout: () => void
  onGoSettings: () => void
}

export function RegisterView({ products, items, total, onAddItem, onChangeQty, onClear, onCheckout, onGoSettings }: Props) {
  // 商品ID → カート内の数量。カートに入っている商品のボタンに数量を出す
  const qtyById = new Map(items.map((i) => [i.productId, i.qty]))
  // スマホでは、カートを下の帯にたたみ、「カートを見る」で下から開く（docs/design/dayresi.pen の M-01・M-01b）。PC では使わない
  const [cartOpen, setCartOpen] = useState(false)
  const checkout = () => {
    setCartOpen(false)
    onCheckout()
  }

  return (
    <section className="tab register">
      {/* 商品ボタン。登録順に並べ、商品名と価格を出す。押すとカートに 1 つ入る。カートに入っている商品は、色を変えて左上に数量を出す */}
      <div className="product-grid">
        {products.length === 0 && (
          <div className="empty">
            <p>商品がまだ登録されていません。</p>
            <button className="primary" onClick={onGoSettings}>設定で商品を登録する</button>
          </div>
        )}
        {products.map((p) => {
          const qty = qtyById.get(p.id) ?? 0
          return (
            <button key={p.id} className={qty > 0 ? 'product-btn in-cart' : 'product-btn'} onClick={() => onAddItem(p.id)}>
              {qty > 0 && (
                <>
                  <span className="qty-badge" aria-hidden="true">{qty}</span>
                  <span className="sr-only">カートに{qty}個</span>
                </>
              )}
              <span className="name">{p.name}</span>
              <span className={p.price < 0 ? 'price minus' : 'price'}>{formatYen(p.price)}</span>
            </button>
          )
        })}
      </div>

      {/*
        カート。明細（商品名・数量・小計）は商品の登録順に並べ、合計を出す
        数量は「−」「＋」で変え、0 にするとカートから消える（999 で止まる）。消すときは一括の「クリア」だけで、行ごとの削除はしない（ADR 0016）
        合計が 0 円未満のときは会計に進めず、理由を出す（ADR 0011）
      */}
      <aside className={cartOpen ? 'cart open' : 'cart'}>
        <div className="cart-head">
          <button className="cart-close only-narrow" aria-label="カートを閉じる" onClick={() => setCartOpen(false)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <h2>カート</h2>
          <button className="secondary cart-clear only-narrow" onClick={onClear} disabled={items.length === 0}>クリア</button>
        </div>
        <ul className="cart-list">
          {items.length === 0 && <li className="cart-empty">商品を選んでください</li>}
          {items.map((item) => (
            <li key={item.productId}>
              <span className="cart-name">{item.name}</span>
              <span className="qty">
                <button aria-label={`${item.name}を1つ減らす`} onClick={() => onChangeQty(item.productId, -1)}>−</button>
                <span className="qty-num">{item.qty}</span>
                <button aria-label={`${item.name}を1つ増やす`} onClick={() => onChangeQty(item.productId, 1)}>＋</button>
              </span>
              <span className="sub">{formatYen(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="cart-total">
          <span>合計</span>
          <strong>{formatYen(total)}</strong>
        </div>
        {total < 0 && <p className="cart-warning">合計が0円未満のため、会計できません</p>}
        <div className="cart-actions">
          <button className="secondary only-wide" onClick={onClear} disabled={items.length === 0}>クリア</button>
          <button className="primary" onClick={checkout} disabled={!canCheckout(items)}>会計</button>
        </div>
      </aside>

      {/* スマホの、たたんだカート。合計と会計だけを出す */}
      {cartOpen && <div className="cart-backdrop only-narrow" onClick={() => setCartOpen(false)} />}
      <div className="cart-bar only-narrow">
        <div className="cart-bar-row">
          <button className="cart-open" onClick={() => setCartOpen(true)} aria-expanded={cartOpen}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            カートを見る
          </button>
          <strong className="cart-bar-total">{formatYen(total)}</strong>
        </div>
        {total < 0 && <p className="cart-warning">合計が0円未満のため、会計できません</p>}
        <button className="primary cart-bar-checkout" onClick={checkout} disabled={!canCheckout(items)}>会計</button>
      </div>
    </section>
  )
}
