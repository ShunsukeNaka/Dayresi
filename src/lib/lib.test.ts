import { describe, expect, it } from 'vitest'
import type { Product, Sale } from '../types'
import { canCheckout, cartItems, createSale, itemsTotal, summarize, voidSale } from './sales'
import { MAX_NAME_LENGTH, fileStamp, formatDateTime, formatTime, formatYen, isValidName, isValidPrice, parsePrice } from './format'
import { salesToCsv } from './csv'
import { parseData } from './storage'
import { addProduct } from './products'
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
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const exact = createSale(items, 400, [first])
    expect(exact).toMatchObject({ no: 2, paid: 400, change: 0 })
    // 取り消した会計も番号を持ち続けるので、番号を詰めない
    expect(createSale(items, 400, [first, { ...exact, voided: true }]).no).toBe(3)
    // 全データ消去で会計がなくなると 1 に戻る
    expect(createSale(items, 400, []).no).toBe(1)
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

describe('voidSale', () => {
  const s1 = createSale(cartItems({ a: 2 }, products), 1000, [])
  const s2 = createSale(cartItems({ b: 1 }, products), 150, [s1])
  const sales = [s1, s2]

  it('指定した会計だけを取消済みにし、番号や明細は変えない', () => {
    const next = voidSale(sales, s1.id)
    expect(next[0]).toEqual({ ...s1, voided: true })
    expect(next[1]).toBe(s2)
  })

  it('元の配列と会計を変えない', () => {
    voidSale(sales, s1.id)
    expect(sales).toEqual([s1, s2])
    expect(s1.voided).toBe(false)
  })

  it('取消済みの会計や、ない ID を指定したときは、受け取った配列をそのまま返す', () => {
    const voided = voidSale(sales, s1.id)
    expect(voidSale(voided, s1.id)).toBe(voided)
    expect(voidSale(sales, 'none')).toBe(sales)
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

describe('products', () => {
  it('商品を末尾に足し、ID を UUID で振る', () => {
    const next = addProduct(products, '割引', -50)
    expect(next.map((p) => p.name)).toEqual(['焼きそば', 'ラムネ', '割引'])
    expect(next[2]).toMatchObject({ name: '割引', price: -50 })
    expect(next[2].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(products).toHaveLength(2)
  })

  it('商品名は前後の空白も残し、同じ名前も足せる', () => {
    const next = addProduct(addProduct(products, ' 焼きそば ', 400), '焼きそば', 400)
    expect(next.map((p) => p.name)).toEqual(['焼きそば', 'ラムネ', ' 焼きそば ', '焼きそば'])
    expect(new Set(next.map((p) => p.id)).size).toBe(4)
  })

  it('ルールに合わない名前や価格では足さない', () => {
    const bad: [string, number][] = [
      ['', 100], ['　 ', 100], ['あ'.repeat(MAX_NAME_LENGTH + 1), 100],
      ['焼きそば', 1.5], ['焼きそば', 10_000_000], ['焼きそば', -10_000_000],
    ]
    for (const [name, price] of bad) expect(addProduct(products, name, price)).toBe(products)
  })
})

describe('reducer', () => {
  it('商品の追加と会計の取消ができる', () => {
    let state = reducer({ products, sales: [] }, { type: 'addProduct', name: '割引', price: -50 })
    expect(state.products.map((p) => p.name)).toEqual(['焼きそば', 'ラムネ', '割引'])
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

  it('全角の数字を受け付け、カンマ・¥・円は弾く', () => {
    expect(parsePrice('４００')).toBe(400)
    expect(parsePrice('－５０')).toBe(-50)
    expect(parsePrice('−５０')).toBe(-50)
    expect(parsePrice('　４００　')).toBe(400)
    expect(parsePrice('４0０')).toBe(400)
    expect(parsePrice('９９９９９９９')).toBe(9_999_999)
    for (const bad of ['１０００００００', '１．５', '1,000', '１，０００', '¥400', '￥400', '400円', '４００円']) expect(parsePrice(bad)).toBeNull()
  })

  it('価格は上限・下限ちょうどまで受け付ける', () => {
    expect(parsePrice('9999999')).toBe(9_999_999)
    expect(parsePrice('-9999999')).toBe(-9_999_999)
    expect(isValidPrice(9_999_999)).toBe(true)
    expect(isValidPrice(10_000_000)).toBe(false)
    expect(isValidPrice(1.5)).toBe(false)
    expect(isValidPrice('400')).toBe(false)
  })

  it('商品名は空白だけを弾き、前後の空白も含めて文字数を数える', () => {
    expect(isValidName('')).toBe(false)
    expect(isValidName('   ')).toBe(false)
    expect(isValidName(400)).toBe(false)
    expect(isValidName(' 焼きそば ')).toBe(true)
    expect(isValidName('　 ')).toBe(false)
    expect(isValidName('あ'.repeat(MAX_NAME_LENGTH))).toBe(true)
    expect(isValidName(' ' + 'あ'.repeat(MAX_NAME_LENGTH))).toBe(false)
  })

  it('マイナスの金額は符号を前に付けて表示する', () => {
    expect(formatYen(1200)).toBe('¥1,200')
    expect(formatYen(-50)).toBe('−¥50')
    expect(formatYen(0)).toBe('¥0')
  })

  it('大きな金額は 3 桁ごとに区切り、マイナスも区切る', () => {
    expect(formatYen(9_999_999)).toBe('¥9,999,999')
    expect(formatYen(-1_234_567)).toBe('−¥1,234,567')
  })

  it('履歴の時刻は、時に 0 を付けず分を 2 桁にする', () => {
    expect(formatTime(new Date(2026, 9, 25, 9, 5, 30).toISOString())).toBe('9:05')
    expect(formatTime(new Date(2026, 9, 25, 15, 30, 0).toISOString())).toBe('15:30')
    expect(formatTime(new Date(2026, 9, 25, 0, 0, 0).toISOString())).toBe('0:00')
  })

  it('CSV の日時は、月日・時分秒を 2 桁にする', () => {
    expect(formatDateTime(new Date(2026, 9, 25, 9, 5, 30).toISOString())).toBe('2026-10-25 09:05:30')
    expect(formatDateTime(new Date(2026, 0, 3, 14, 7, 8).toISOString())).toBe('2026-01-03 14:07:08')
  })

  it('ファイル名用の日時は YYYYMMDD-HHmm にする', () => {
    expect(fileStamp(new Date(2026, 9, 25, 15, 30, 45))).toBe('20261025-1530')
    expect(fileStamp(new Date(2026, 0, 3, 9, 5, 0))).toBe('20260103-0905')
  })
})
