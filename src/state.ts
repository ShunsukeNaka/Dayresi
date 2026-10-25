import { useEffect, useReducer, useRef } from 'react'
import type { AppData, SaleItem } from './types'
import { addProduct } from './lib/products'
import { emptyData, loadData, saveData } from './lib/storage'
import { createSale, voidSale } from './lib/sales'

/**
 * 商品と会計を変える操作。画面はこれを通してだけデータを変える（カートは画面の state で持ち、ここには入れない）
 * - addProduct：商品を末尾に登録する。名前か価格がルールに合わなければ何もしない
 * - checkout：明細とお預かり（未入力は null で「ちょうど」）から会計を確定する。確定できなければ何もしない
 * - voidSale：会計を取り消す（消さずに取消済みにする）。取消済みやない ID なら何もしない
 * - resetAll：全データ消去。商品と会計をすべて消す
 */
export type Action =
  | { type: 'addProduct'; name: string; price: number }
  | { type: 'checkout'; items: SaleItem[]; paid: number | null }
  | { type: 'voidSale'; id: string }
  | { type: 'resetAll' }

/** 何も変わらない操作では同じ状態を返し、保存し直さない */
export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'addProduct': {
      const products = addProduct(state.products, action.name, action.price)
      return products === state.products ? state : { ...state, products }
    }
    case 'checkout': {
      const sale = createSale(action.items, action.paid, state.sales)
      return sale ? { ...state, sales: [...state.sales, sale] } : state
    }
    case 'voidSale': {
      const sales = voidSale(state.sales, action.id)
      return sales === state.sales ? state : { ...state, sales }
    }
    case 'resetAll':
      return emptyData()
  }
}

/** 状態が変わるたびに localStorage へ保存する。保存に失敗しても知らせない（#50） */
export function useAppData() {
  const [data, dispatch] = useReducer(reducer, undefined, loadData)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    saveData(data)
  }, [data])

  return [data, dispatch] as const
}
