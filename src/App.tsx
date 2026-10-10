import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cart, PaymentMethod } from './types'
import { useAppData } from './state'
import { cartItems, createSale, itemsTotal } from './lib/sales'
import { formatYen } from './lib/format'
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
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const onSaveError = useCallback(
    () => showToast('保存に失敗しました。ブラウザの保存領域を確認してください。'),
    [showToast],
  )
  const [data, dispatch] = useAppData(onSaveError)
  const [tab, setTab] = useState<Tab>(data.products.length > 0 ? 'register' : 'settings')
  const [cart, setCart] = useState<Cart>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // 消されにくい保存領域をブラウザに依頼する（対応ブラウザのみ）
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  // 削除された商品はカートに残っていても cartItems が除外する
  const items = cartItems(cart, data.products)
  const total = itemsTotal(items)

  const changeQty = useCallback((id: string, delta: number) => {
    setCart((prev) => {
      const qty = Math.max(0, Math.min(999, (prev[id] ?? 0) + delta))
      const next = { ...prev }
      if (qty === 0) delete next[id]
      else next[id] = qty
      return next
    })
  }, [])

  const openCheckout = () => {
    if (items.length > 0) setCheckoutOpen(true)
  }

  const confirmCheckout = (method: PaymentMethod, paid: number) => {
    const sale = createSale(items, method, paid, data.sales)
    dispatch({ type: 'recordSale', sale })
    setCart({})
    setCheckoutOpen(false)
    showToast(
      method === 'cash'
        ? `会計 ${sale.no} 番を記録しました（おつり ${formatYen(sale.change)}）`
        : `会計 ${sale.no} 番を記録しました`,
    )
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
            onClear={() => setCart({})}
            onCheckout={openCheckout}
            onGoSettings={() => setTab('settings')}
          />
        )}
        {tab === 'history' && (
          <HistoryView sales={data.sales} onVoid={(id) => dispatch({ type: 'voidSale', id })} />
        )}
        {tab === 'summary' && <SummaryView sales={data.sales} products={data.products} />}
        {tab === 'settings' && (
          <SettingsView data={data} dispatch={dispatch} onToast={showToast} />
        )}
      </main>

      {checkoutOpen && (
        <CheckoutDialog total={total} onConfirm={confirmCheckout} onCancel={() => setCheckoutOpen(false)} />
      )}

      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  )
}
