import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cart } from './types'
import { useAppData } from './state'
import { ROLE_LABEL, currentRegister, findStoreRegister, importSales, type ImportSalesResult } from './lib/registers'
import { canCheckout, canConfirmSale, itemsTotal } from './lib/sales'
import { addToCart, cartItems, changeQty as changeCartQty, clearCart } from './lib/cart'
import { RegisterView } from './components/RegisterView'
import { CheckoutDialog } from './components/CheckoutDialog'
import { HistoryView } from './components/HistoryView'
import { SummaryView } from './components/SummaryView'
import { SettingsView } from './components/SettingsView'
import { RegisterDialog } from './components/RegisterDialog'
import { ImportProductsDialog } from './components/ImportProductsDialog'
import { ImportSalesResultDialog } from './components/ImportSalesResultDialog'
import { decodeShare, type ProductsShare } from './lib/share'

/** 画面はレジ・履歴・集計・設定の 4 つで、上のタブで切り替える */
type Tab = 'register' | 'history' | 'summary' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'register', label: 'レジ' },
  { id: 'history', label: '履歴' },
  { id: 'summary', label: '集計' },
  { id: 'settings', label: '設定' },
]

export default function App() {
  const [store, dispatch] = useAppData()
  // 商品がないときは、まず商品を登録できるよう設定画面から始める
  const [tab, setTab] = useState<Tab>(() => (currentRegister(store).products.length > 0 ? 'register' : 'settings'))
  const [cart, setCart] = useState<Cart>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  // 開いたリンク（QR）の # 以降にあった、配られた商品
  const [incoming, setIncoming] = useState<ProductsShare | null>(null)
  // 開いたリンク（QR）の会計を取り込んだ結果
  const [salesResult, setSalesResult] = useState<{ by: string; registerName: string; result: ImportSalesResult } | null>(null)
  // リンクを読むときに、そのときの保存データを使う
  const storeRef = useRef(store)
  useEffect(() => {
    storeRef.current = store
  }, [store])

  // リンクを開いたとき（開いているページで別のリンクを開いたときも）、# 以降の引き渡しのデータを読む。読んだら # 以降は消す
  useEffect(() => {
    const read = () => {
      const hash = location.hash
      if (!hash) return
      history.replaceState(null, '', location.pathname + location.search)
      void decodeShare(hash).then((share) => {
        if (share?.kind === 'products') setIncoming(share)
        if (share?.kind === 'sales') {
          // 送られた会計は、確かめずに同じ店の代表者のレジへ合算し、結果を出す（spec-next.md「会計を送る」）
          const before = storeRef.current
          const { result } = importSales(before, share)
          dispatch({ type: 'importSales', share })
          if (result.kind === 'merged' && findStoreRegister(before, share.storeId)?.id !== before.currentId) {
            setCart(clearCart())
            setCheckoutOpen(false)
          }
          setSalesResult({ by: share.by, registerName: findStoreRegister(before, share.storeId)?.name ?? '', result })
        }
      })
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [dispatch])
  // 画面は、今使っているレジの商品と会計を出す
  const data = currentRegister(store)

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
        <div className="topbar-left">
          <h1>Dayresi</h1>
          {/* 今のレジの名前と役割。押すとレジの一覧を開く（spec-next.md「レジ」） */}
          <button className="register-switch" onClick={() => setRegisterOpen(true)} aria-label={`レジ：${data.name}（${ROLE_LABEL[data.role]}）。レジの一覧を開く`}>
            <span className="register-switch-name">{data.name}</span>
            <span className="register-switch-role">{ROLE_LABEL[data.role]}</span>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
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
          <HistoryView sales={data.sales} myName={data.myName} onVoid={(id) => dispatch({ type: 'voidSale', id })} />
        )}
        {tab === 'summary' && <SummaryView sales={data.sales} products={data.products} />}
        {tab === 'settings' && (
          <SettingsView data={data} dispatch={dispatch} />
        )}
      </main>

      {registerOpen && (
        <RegisterDialog
          store={store}
          dispatch={dispatch}
          // レジが変わったら、前のレジのカートと会計ダイアログは閉じる
          onRegisterChange={() => {
            setCart(clearCart())
            setCheckoutOpen(false)
          }}
          onCreated={() => setTab('settings')}
          onClose={() => setRegisterOpen(false)}
        />
      )}

      {incoming && (
        <ImportProductsDialog
          share={incoming}
          existing={findStoreRegister(store, incoming.storeId)}
          onImport={(myName) => {
            dispatch({ type: 'importProducts', share: incoming, myName })
            setCart(clearCart())
            setCheckoutOpen(false)
            setTab('register')
            setIncoming(null)
          }}
          onClose={() => setIncoming(null)}
        />
      )}

      {salesResult && (
        <ImportSalesResultDialog
          by={salesResult.by}
          registerName={salesResult.registerName}
          result={salesResult.result}
          onClose={() => setSalesResult(null)}
        />
      )}

      {checkoutOpen && (
        <CheckoutDialog total={total} onConfirm={confirmCheckout} onCancel={() => setCheckoutOpen(false)} />
      )}
    </>
  )
}
