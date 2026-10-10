import type { Cart, Product, SaleItem } from '../types'
import { formatYen } from '../lib/format'

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
        <div className="cart-actions">
          <button className="secondary" onClick={onClear} disabled={items.length === 0}>クリア</button>
          <button className="primary" onClick={onCheckout} disabled={items.length === 0}>会計</button>
        </div>
      </aside>
    </section>
  )
}
