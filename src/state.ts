import { useEffect, useReducer, useRef } from 'react'
import type { AppData, Sale } from './types'
import { addProduct } from './lib/products'
import { emptyData, loadData, saveData } from './lib/storage'
import { voidSale } from './lib/sales'

export type Action =
  | { type: 'addProduct'; name: string; price: number }
  | { type: 'recordSale'; sale: Sale }
  | { type: 'voidSale'; id: string }
  | { type: 'resetAll' }

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'addProduct':
      return { ...state, products: addProduct(state.products, action.name, action.price) }
    case 'recordSale':
      return { ...state, sales: [...state.sales, action.sale] }
    case 'voidSale':
      return { ...state, sales: voidSale(state.sales, action.id) }
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
