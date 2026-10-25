import type { Cart, Product, SaleItem } from '../types'
import { formatYen } from '../lib/format'
import { canCheckout } from '../lib/sales'

type Props = {
  products: Product[]
  cart: Cart
  items: SaleItem[]
  total: number
  onChangeQty: (id: string, delta: number) => void
  onClear: () => void
  onCheckout: () => void
  onGoSettings: () => void
}

export function RegisterView({ products, cart, items, total, onChangeQty, onClear, onCheckout, onGoSettings }: Props) {
  return (
    <section className="tab register">
      <div className="product-grid">
        {products.length === 0 && (
          <div className="empty">
            <p>商品がまだ登録されていません。</p>
            <button className="primary" onClick={onGoSettings}>設定で商品を登録する</button>
          </div>
        )}
        {products.map((p) => (
          <button key={p.id} className="product-btn" onClick={() => onChangeQty(p.id, 1)}>
            {(cart[p.id] ?? 0) > 0 && <span className="badge">{cart[p.id]}</span>}
            <span className="name">{p.name}</span>
            <span className="price">{formatYen(p.price)}</span>
          </button>
        ))}
      </div>

      {/*
        カート。明細（商品名・数量・小計）は商品の登録順に並べ、合計を出す
        数量は「−」「＋」で変え、0 にするとカートから消える（999 で止まる）。消すときは一括の「クリア」だけで、行ごとの削除はしない（ADR 0016）
        合計が 0 円未満のときは会計に進めず、理由を出す（ADR 0011）
      */}
      <aside className="cart">
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
          <button className="secondary" onClick={onClear} disabled={items.length === 0}>クリア</button>
          <button className="primary" onClick={onCheckout} disabled={!canCheckout(items)}>会計</button>
        </div>
      </aside>
    </section>
  )
}
