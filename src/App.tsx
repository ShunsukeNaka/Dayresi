import { useCallback, useState } from 'react'
import type { Cart } from './types'
import { useAppData } from './state'
import { canCheckout, canConfirmSale, itemsTotal } from './lib/sales'
import { addToCart, cartItems, changeQty as changeCartQty, clearCart } from './lib/cart'
import { RegisterView } from './components/RegisterView'
import { CheckoutDialog } from './components/CheckoutDialog'
import { HistoryView } from './components/HistoryView'
import { SummaryView } from './components/SummaryView'
import { SettingsView } from './components/SettingsView'

/** 画面はレジ・履歴・集計・設定の 4 つで、上のタブで切り替える */
type Tab = 'register' | 'history' | 'summary' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'register', label: 'レジ' },
  { id: 'history', label: '履歴' },
  { id: 'summary', label: '集計' },
  { id: 'settings', label: '設定' },
]

export default function App() {
  const [data, dispatch] = useAppData()
  // 商品がないときは、まず商品を登録できるよう設定画面から始める
  const [tab, setTab] = useState<Tab>(data.products.length > 0 ? 'register' : 'settings')
  const [cart, setCart] = useState<Cart>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // 全データ消去で消えた商品はカートに残っていても cartItems が除外する
  const items = cartItems(cart, data.products)
  const total = itemsTotal(items)

  const addItem = useCallback((id: string) => {
    setCart((prev) => addToCart(prev, id))
  }, [])

  const changeQty = useCallback((id: string, delta: number) => {
    setCart((prev) => changeCartQty(prev, id, delta))
  }, [])

  const openCheckout = () => {
    if (canCheckout(items)) setCheckoutOpen(true)
  }

  const confirmCheckout = (paid: number | null) => {
    // 確定できる会計だけを渡すので、reducer で必ず記録される
    if (!canConfirmSale(items, paid)) return
    dispatch({ type: 'checkout', items, paid })
    setCart(clearCart())
    setCheckoutOpen(false)
  }

  return (
    <>
      <header className="topbar">
        <h1>Dayresi</h1>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'register' && (
          <RegisterView
            products={data.products}
            items={items}
            total={total}
            onAddItem={addItem}
            onChangeQty={changeQty}
            onClear={() => setCart(clearCart())}
            onCheckout={openCheckout}
            onGoSettings={() => setTab('settings')}
          />
        )}
        {tab === 'history' && (
          <HistoryView sales={data.sales} onVoid={(id) => dispatch({ type: 'voidSale', id })} />
        )}
        {tab === 'summary' && <SummaryView sales={data.sales} products={data.products} />}
        {tab === 'settings' && (
          <SettingsView data={data} dispatch={dispatch} />
        )}
      </main>

      {checkoutOpen && (
        <CheckoutDialog total={total} onConfirm={confirmCheckout} onCancel={() => setCheckoutOpen(false)} />
      )}
    </>
  )
}
