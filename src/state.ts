import { useEffect, useReducer, useRef } from 'react'
import type { Product, Sale, SaleItem, Store } from './types'
import type { CartCoupons } from './lib/coupons'
import { addProduct } from './lib/products'
import { loadStore, saveStore } from './lib/storage'
import { addRegister, createRegister, deleteRegister, importProducts, importSales, switchRegister, updateCurrent } from './lib/registers'
import { isValidName } from './lib/format'
import { createSale, voidSale } from './lib/sales'

/**
 * 商品と会計を変える操作。画面はこれを通してだけデータを変える（カートは画面の state で持ち、ここには入れない）
 * どの操作も、今使っているレジに対して行う
 * - addProduct：商品を末尾に登録する。名前か価格がルールに合わなければ何もしない。会計する人のレジでは、配られた商品を編集できないので何もしない
 * - checkout：明細とお預かり（未入力は null で「ちょうど」）と、選んだ割引券から会計を確定する。確定できなければ何もしない
 * - voidSale：会計を取り消す（消さずに取消済みにする）。取消済みやない ID なら何もしない
 * - resetAll：全データ消去。今のレジの商品・割引券・会計をすべて消す（ほかのレジは残す）
 * - switchRegister：今使うレジを切り替える
 * - createRegister：自分が代表者になる新しいレジを作り、切り替える。レジの名前か自分の名前がルールに合わなければ何もしない
 * - deleteRegister：レジを削除する。最後の 1 つを消したらマイレジを自動で作る
 * - setMyName：今のレジの自分の名前を変える。ルールに合わなければ何もしない
 * - importProducts：配られた商品を取り込む（新しく足すときは自分の名前がルールに合わなければ何もしない）
 * - importSales：送られた会計を、同じ店の代表者のレジに合算する（そのレジがなければ何もしない）
 */
export type Action =
  | { type: 'addProduct'; name: string; price: number }
  | { type: 'checkout'; items: SaleItem[]; paid: number | null; coupons?: CartCoupons }
  | { type: 'voidSale'; id: string }
  | { type: 'resetAll' }
  | { type: 'switchRegister'; id: string }
  | { type: 'createRegister'; name: string; myName: string }
  | { type: 'deleteRegister'; id: string }
  | { type: 'setMyName'; name: string }
  | { type: 'importProducts'; share: { storeId: string; name: string; products: Product[] }; myName: string }
  | { type: 'importSales'; share: { storeId: string; by: string; sales: Sale[] } }

/** 何も変わらない操作では同じ状態を返し、保存し直さない */
export function reducer(state: Store, action: Action): Store {
  switch (action.type) {
    case 'switchRegister':
      return switchRegister(state, action.id)
    case 'createRegister':
      if (!isValidName(action.name) || !isValidName(action.myName)) return state
      return addRegister(state, createRegister({ name: action.name, myName: action.myName }))
    case 'deleteRegister':
      return deleteRegister(state, action.id)
    case 'importProducts': {
      const existing = state.registers.some((r) => r.storeId === action.share.storeId)
      if (!existing && !isValidName(action.myName)) return state
      return importProducts(state, action.share, action.myName).store
    }
    case 'importSales':
      return importSales(state, action.share).store
  }
  return updateCurrent(state, (register) => {
    switch (action.type) {
      case 'addProduct': {
        if (register.role === 'member') return register
        const products = addProduct(register.products, action.name, action.price)
        return products === register.products ? register : { ...register, products }
      }
      case 'checkout': {
        const sale = createSale(action.items, action.paid, register.sales, new Date(), register.coupons, action.coupons ?? {})
        return sale ? { ...register, sales: [...register.sales, sale] } : register
      }
      case 'voidSale': {
        const sales = voidSale(register.sales, action.id)
        return sales === register.sales ? register : { ...register, sales }
      }
      case 'setMyName':
        return isValidName(action.name) && action.name !== register.myName ? { ...register, myName: action.name } : register
      case 'resetAll':
        return register.products.length === 0 && register.coupons.length === 0 && register.sales.length === 0
          ? register
          : { ...register, products: [], coupons: [], sales: [] }
    }
  })
}

/** 状態が変わるたびに localStorage へ保存する。保存に失敗しても知らせない（#50） */
export function useAppData() {
  const [data, dispatch] = useReducer(reducer, undefined, loadStore)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    saveStore(data)
  }, [data])

  return [data, dispatch] as const
}
