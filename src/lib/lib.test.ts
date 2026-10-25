import { describe, expect, it } from 'vitest'
import type { Product, Sale } from '../types'
import { canCheckout, cartItems, createSale, itemsTotal, summarize } from './sales'
import { formatYen, isValidPrice, parsePrice } from './format'
import { salesToCsv } from './csv'
import { parseData } from './storage'
import { reducer } from '../state'

const products: Product[] = [
  { id: 'a', name: '焼きそば', price: 400 },
  { id: 'b', name: 'ラムネ', price: 150 },
]

describe('sales', () => {
  it('カートを商品順に明細化して合計する', () => {
    const items = cartItems({ b: 2, a: 1 }, products)
    expect(items.map((i) => i.name)).toEqual(['焼きそば', 'ラムネ'])
    expect(itemsTotal(items)).toBe(700)
  })

  it('お預かり金額からおつりを計算し、会計番号を振る', () => {
    const items = cartItems({ a: 1 }, products)
    const first = createSale(items, 1000, [])
    expect(first).toMatchObject({ no: 1, total: 400, paid: 1000, change: 600, voided: false })
    expect(first).not.toHaveProperty('method')
    const exact = createSale(items, 400, [first])
    expect(exact).toMatchObject({ no: 2, paid: 400, change: 0 })
  })

  it('マイナス価格の商品を含めて合計し、合計が0円以上なら会計できる', () => {
    const withDiscount: Product[] = [...products, { id: 'd', name: '割引', price: -50 }]
    const items = cartItems({ a: 1, d: 1 }, withDiscount)
    expect(itemsTotal(items)).toBe(350)
    expect(canCheckout(items)).toBe(true)
    expect(canCheckout(cartItems({ b: 1, d: 3 }, withDiscount))).toBe(true)
    expect(canCheckout(cartItems({ d: 1 }, withDiscount))).toBe(false)
    expect(canCheckout([])).toBe(false)
  })

  it('取消済みを除いて集計し、削除済み商品は末尾に置く', () => {
    const s1 = createSale([{ productId: 'x', name: '削除済み', price: 100, qty: 1 }, ...cartItems({ b: 1 }, products)], 250, [])
    const s2 = createSale(cartItems({ a: 2, b: 1 }, products), 950, [s1])
    const s3 = { ...createSale(cartItems({ a: 5 }, products), 2000, [s1, s2]), voided: true }
    const summary = summarize([s1, s2, s3], products)
    expect(summary.total).toBe(250 + 950)
    expect(summary.count).toBe(2)
    expect(summary.byProduct.map((r) => [r.name, r.qty, r.amount])).toEqual([
      ['焼きそば', 2, 800],
      ['ラムネ', 2, 300],
      ['削除済み', 1, 100],
    ])
  })
})

describe('csv', () => {
  it('BOM付きで、記号を含む値をエスケープする', () => {
    const sale: Sale = {
      id: '1', no: 1, at: '2026-10-10T03:04:05.000Z', total: 100, paid: 100, change: 0, voided: true,
      items: [{ productId: 'a', name: '=SUM("A1")', price: 100, qty: 1 }],
    }
    const csv = salesToCsv([sale])
    expect(csv.startsWith('﻿会計番号,日時,商品名,単価,')).toBe(true)
    const row = csv.split('\r\n')[1]
    expect(row).toContain(`"=SUM(""A1"")"`)
    expect(row.endsWith(',取消')).toBe(true)
  })

  it('マイナス価格は数値のまま出力する', () => {
    const sale = createSale([{ productId: 'd', name: '割引', price: -50, qty: 2 }, { productId: 'a', name: '焼きそば', price: 400, qty: 1 }], 300, [])
    const rows = salesToCsv([sale]).split('\r\n')
    expect(rows[1].split(',').slice(2, 6)).toEqual(['割引', '-50', '2', '-100'])
  })
})

describe('storage', () => {
  it('空や不正な要素を含むデータから有効なものだけ取り出す', () => {
    expect(parseData(null)).toEqual({ products: [], sales: [] })
    const data = parseData(JSON.stringify({ products: [products[0], { id: 1 }], sales: [{ bad: true }] }))
    expect(data).toEqual({ products: [products[0]], sales: [] })
  })

  it('マイナス価格の商品を捨てずに読み込む', () => {
    const discount = { id: 'd', name: '割引', price: -50 }
    expect(parseData(JSON.stringify({ products: [discount], sales: [] })).products).toEqual([discount])
  })

  it('支払方法を記録していた以前のデータも読み込める', () => {
    const old = { id: '1', no: 1, at: '2026-10-10T03:04:05.000Z', items: [], total: 400, method: 'other', paid: 400, change: 0, voided: false }
    expect(parseData(JSON.stringify({ products: [], sales: [old] })).sales).toHaveLength(1)
  })
})

describe('reducer', () => {
  it('商品の追加と会計の取消ができる', () => {
    let state = reducer({ products, sales: [] }, { type: 'addProduct', product: { id: 'c', name: '割引', price: -50 } })
    expect(state.products.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    const sale = createSale(cartItems({ a: 1 }, products), 400, [])
    state = reducer(state, { type: 'recordSale', sale })
    state = reducer(state, { type: 'voidSale', id: sale.id })
    expect(state.sales[0].voided).toBe(true)
  })
})

describe('format', () => {
  it('マイナスを含む価格の入力を受け付け、範囲外や小数は弾く', () => {
    expect(parsePrice('400')).toBe(400)
    expect(parsePrice(' -50 ')).toBe(-50)
    expect(parsePrice('−50')).toBe(-50)
    expect(parsePrice('－50')).toBe(-50)
    expect(parsePrice('0')).toBe(0)
    for (const bad of ['', '-', '1.5', '50-', 'abc', '10000000', '-10000000']) expect(parsePrice(bad)).toBeNull()
    expect(isValidPrice(-9_999_999)).toBe(true)
    expect(isValidPrice(-10_000_000)).toBe(false)
  })

  it('マイナスの金額は符号を前に付けて表示する', () => {
    expect(formatYen(1200)).toBe('¥1,200')
    expect(formatYen(-50)).toBe('−¥50')
    expect(formatYen(0)).toBe('¥0')
  })
})
