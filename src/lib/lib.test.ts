import { describe, expect, it } from 'vitest'
import type { Product, Sale } from '../types'
import { cartItems, createSale, itemsTotal, summarize } from './sales'
import { salesToCsv } from './csv'
import { ProductFileError, parseProductFile, productsToFile } from './productFile'
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

  it('現金はおつりを計算し、その他は合計額で記録する', () => {
    const items = cartItems({ a: 1 }, products)
    const cash = createSale(items, 'cash', 1000, [])
    expect(cash).toMatchObject({ no: 1, total: 400, paid: 1000, change: 600, voided: false })
    const other = createSale(items, 'other', 0, [cash])
    expect(other).toMatchObject({ no: 2, paid: 400, change: 0 })
  })

  it('取消済みを除いて集計し、削除済み商品は末尾に置く', () => {
    const s1 = createSale([{ productId: 'x', name: '削除済み', price: 100, qty: 1 }, ...cartItems({ b: 1 }, products)], 'cash', 250, [])
    const s2 = createSale(cartItems({ a: 2, b: 1 }, products), 'cash', 950, [s1])
    const s3 = { ...createSale(cartItems({ a: 5 }, products), 'other', 0, [s1, s2]), voided: true }
    const summary = summarize([s1, s2, s3], products)
    expect(summary.total).toBe(250 + 950)
    expect(summary.count).toBe(2)
    expect(summary.voidedCount).toBe(1)
    expect(summary.byProduct.map((r) => [r.name, r.qty, r.amount])).toEqual([
      ['焼きそば', 2, 800],
      ['ラムネ', 2, 300],
      ['削除済み', 1, 100],
    ])
  })
})

describe('csv', () => {
  it('BOM付きで、記号を含む値と数式に見える値をエスケープする', () => {
    const sale: Sale = {
      id: '1', no: 1, at: '2026-10-10T03:04:05.000Z', total: 100, method: 'cash', paid: 100, change: 0, voided: true,
      items: [{ productId: 'a', name: '=SUM("A1")', price: 100, qty: 1 }],
    }
    const csv = salesToCsv([sale])
    expect(csv.startsWith('﻿会計番号,')).toBe(true)
    const row = csv.split('\r\n')[1]
    expect(row).toContain(`"'=SUM(""A1"")"`)
    expect(row.endsWith(',取消')).toBe(true)
  })
})

describe('productFile', () => {
  it('書き出したファイルを読み込める（IDは振り直す）', () => {
    const parsed = parseProductFile(productsToFile(products))
    expect(parsed.map(({ name, price }) => ({ name, price }))).toEqual([
      { name: '焼きそば', price: 400 },
      { name: 'ラムネ', price: 150 },
    ])
    expect(parsed[0].id).not.toBe('a')
  })

  it('不正なファイルはわかりやすいエラーにする', () => {
    expect(() => parseProductFile('not json')).toThrow(ProductFileError)
    expect(() => parseProductFile('{"app":"other"}')).toThrow(ProductFileError)
    expect(() => parseProductFile('{"app":"dayresi","type":"products","version":1,"products":[{"name":"","price":1}]}')).toThrow('1 番目')
    expect(() => parseProductFile('{"app":"dayresi","type":"products","version":1,"products":[{"name":"a","price":1.5}]}')).toThrow(ProductFileError)
  })
})

describe('storage', () => {
  it('空や不正な要素を含むデータから有効なものだけ取り出す', () => {
    expect(parseData(null)).toEqual({ products: [], sales: [] })
    const data = parseData(JSON.stringify({ products: [products[0], { id: 1 }], sales: [{ bad: true }] }))
    expect(data).toEqual({ products: [products[0]], sales: [] })
  })
})

describe('reducer', () => {
  it('商品の並べ替えと会計の取消ができる', () => {
    let state = reducer({ products, sales: [] }, { type: 'moveProduct', id: 'b', delta: -1 })
    expect(state.products.map((p) => p.id)).toEqual(['b', 'a'])
    expect(reducer(state, { type: 'moveProduct', id: 'b', delta: -1 })).toBe(state)
    const sale = createSale(cartItems({ a: 1 }, products), 'cash', 400, [])
    state = reducer(state, { type: 'recordSale', sale })
    state = reducer(state, { type: 'voidSale', id: sale.id })
    expect(state.sales[0].voided).toBe(true)
  })
})
