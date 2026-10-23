import { useEffect, useReducer, useRef } from 'react'
import type { AppData, Product, Sale } from './types'
import { emptyData, loadData, saveData } from './lib/storage'

export type Action =
  | { type: 'addProduct'; product: Product }
  | { type: 'updateProduct'; product: Product }
  | { type: 'removeProduct'; id: string }
  | { type: 'moveProduct'; id: string; delta: -1 | 1 }
  | { type: 'recordSale'; sale: Sale }
  | { type: 'voidSale'; id: string }
  | { type: 'resetAll' }

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'addProduct':
      return { ...state, products: [...state.products, action.product] }
    case 'updateProduct':
      return { ...state, products: state.products.map((p) => (p.id === action.product.id ? action.product : p)) }
    case 'removeProduct':
      return { ...state, products: state.products.filter((p) => p.id !== action.id) }
    case 'moveProduct': {
      const i = state.products.findIndex((p) => p.id === action.id)
      const j = i + action.delta
      if (i < 0 || j < 0 || j >= state.products.length) return state
      const products = [...state.products]
      ;[products[i], products[j]] = [products[j], products[i]]
      return { ...state, products }
    }
    case 'recordSale':
      return { ...state, sales: [...state.sales, action.sale] }
    case 'voidSale':
      return { ...state, sales: state.sales.map((s) => (s.id === action.id ? { ...s, voided: true } : s)) }
    case 'resetAll':
      return emptyData()
  }
}

/** 状態が変わるたびに localStorage へ保存する。保存に失敗したら onSaveError を呼ぶ（onSaveError は useCallback で固定すること） */
export function useAppData(onSaveError: () => void) {
  const [data, dispatch] = useReducer(reducer, undefined, loadData)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!saveData(data)) onSaveError()
  }, [data, onSaveError])

  return [data, dispatch] as const
}
