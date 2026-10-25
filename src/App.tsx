import { useCallback, useState } from 'react'
import type { Cart } from './types'
import { useAppData } from './state'
import { canCheckout, createSale, itemsTotal } from './lib/sales'
import { cartItems, changeQty as changeCartQty, clearCart } from './lib/cart'
import { RegisterView } from './components/RegisterView'
import { CheckoutDialog } from './components/CheckoutDialog'
import { HistoryView } from './components/HistoryView'
import { SummaryView } from './components/SummaryView'
import { SettingsView } from './components/SettingsView'

type Tab = 'register' | 'history' | 'summary' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'register', label: 'レジ' },
  { id: 'history', label: '履歴' },
  { id: 'summary', label: '集計' },
  { id: 'settings', label: '設定' },
]

export default function App() {
  const [data, dispatch] = useAppData()
  const [tab, setTab] = useState<Tab>(data.products.length > 0 ? 'register' : 'settings')
  const [cart, setCart] = useState<Cart>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // 全データ消去で消えた商品はカートに残っていても cartItems が除外する
  const items = cartItems(cart, data.products)
  const total = itemsTotal(items)

  const changeQty = useCallback((id: string, delta: number) => {
    setCart((prev) => changeCartQty(prev, id, delta))
  }, [])

  const openCheckout = () => {
    if (canCheckout(items)) setCheckoutOpen(true)
  }

  const confirmCheckout = (paid: number | null) => {
    const sale = createSale(items, paid, data.sales)
    if (!sale) return
    dispatch({ type: 'recordSale', sale })
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
            cart={cart}
            items={items}
            total={total}
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
