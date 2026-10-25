import { useEffect, useReducer, useRef } from 'react'
import type { AppData, Product, Sale } from './types'
import { emptyData, loadData, saveData } from './lib/storage'

export type Action =
  | { type: 'addProduct'; product: Product }
  | { type: 'recordSale'; sale: Sale }
  | { type: 'voidSale'; id: string }
  | { type: 'resetAll' }

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'addProduct':
      return { ...state, products: [...state.products, action.product] }
    case 'recordSale':
      return { ...state, sales: [...state.sales, action.sale] }
    case 'voidSale':
      return { ...state, sales: state.sales.map((s) => (s.id === action.id ? { ...s, voided: true } : s)) }
    case 'resetAll':
      return emptyData()
  }
}

/** 状態が変わるたびに localStorage へ保存する */
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
