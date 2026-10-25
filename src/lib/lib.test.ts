import { afterEach, describe, expect, it } from 'vitest'
import type { Product, Sale } from '../types'
import { canCheckout, createSale, itemsTotal, summarize, voidSale } from './sales'
import { MAX_QTY, addToCart, cartItems, changeQty, clearCart } from './cart'
import { MAX_NAME_LENGTH, fileStamp, formatDateTime, formatTime, formatYen, isValidName, isValidPrice, parsePrice } from './format'
import { salesCsvFileName, salesToCsv } from './csv'
import { loadData, parseData, saveData } from './storage'
import { addProduct } from './products'
import { reducer } from '../state'

const products: Product[] = [
  { id: 'a', name: '焼きそば', price: 400 },
  { id: 'b', name: 'ラムネ', price: 150 },
]

describe('cart', () => {
  it('商品を 1 つずつ入れ、数量を増やす・減らす', () => {
    let cart = addToCart({}, 'a')
    expect(cart).toEqual({ a: 1 })
    cart = addToCart(cart, 'a')
    expect(cart).toEqual({ a: 2 })
    cart = changeQty(cart, 'a', 1)
    expect(cart).toEqual({ a: 3 })
    cart = changeQty(cart, 'a', -1)
    expect(cart).toEqual({ a: 2 })
  })

  it('0 になったらカートから消え、0 より少なくならない', () => {
    expect(changeQty({ a: 1, b: 2 }, 'a', -1)).toEqual({ b: 2 })
    expect(changeQty({ b: 2 }, 'a', -1)).toEqual({ b: 2 })
  })

  it('数量は MAX_QTY で止まる', () => {
    expect(MAX_QTY).toBe(999)
    expect(addToCart({ a: MAX_QTY }, 'a')).toEqual({ a: MAX_QTY })
    expect(changeQty({ a: MAX_QTY - 1 }, 'a', 1)).toEqual({ a: MAX_QTY })
  })

  it('一括でクリアする', () => {
    expect(clearCart()).toEqual({})
  })

  it('商品の登録順で明細にし、商品にないものは除く', () => {
    const items = cartItems({ x: 1, b: 2, a: 1 }, products)
    expect(items).toEqual([
      { productId: 'a', name: '焼きそば', price: 400, qty: 1 },
      { productId: 'b', name: 'ラムネ', price: 150, qty: 2 },
    ])
  })

  it('受け取ったカートを変えない', () => {
    const cart = Object.freeze({ a: 1 })
    expect(addToCart(cart, 'a')).not.toBe(cart)
    changeQty(cart, 'a', -1)
    changeQty(cart, 'b', 1)
    expect(cart).toEqual({ a: 1 })
  })
})

/** 会計できる前提のテストで使う。会計を作れなかったら失敗させる */
function mustCreateSale(...args: Parameters<typeof createSale>): Sale {
  const sale = createSale(...args)
  if (!sale) throw new Error('会計を作れなかった')
  return sale
}

describe('sales', () => {
  it('カートを商品順に明細化して合計する', () => {
    const items = cartItems({ b: 2, a: 1 }, products)
    expect(items.map((i) => i.name)).toEqual(['焼きそば', 'ラムネ'])
    expect(itemsTotal(items)).toBe(700)
  })

  it('お預かり金額からおつりを計算し、会計番号を振る', () => {
    const items = cartItems({ a: 1 }, products)
    const first = mustCreateSale(items, 1000, [])
    expect(first).toMatchObject({ no: 1, total: 400, paid: 1000, change: 600, voided: false })
    expect(first).not.toHaveProperty('method')
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const exact = mustCreateSale(items, 400, [first])
    expect(exact).toMatchObject({ no: 2, paid: 400, change: 0 })
    // 取り消した会計も番号を持ち続けるので、番号を詰めない
    expect(mustCreateSale(items, 400, [first, { ...exact, voided: true }]).no).toBe(3)
    // 全データ消去で会計がなくなると 1 に戻る
    expect(mustCreateSale(items, 400, []).no).toBe(1)
  })

  it('お預かりが未入力なら「ちょうど」として、お預かりを合計と同じにする', () => {
    const sale = mustCreateSale(cartItems({ a: 1, b: 1 }, products), null, [])
    expect(sale).toMatchObject({ total: 550, paid: 550, change: 0 })
  })

  it('お預かりが合計より少ないときは、会計を作らない', () => {
    expect(createSale(cartItems({ a: 1 }, products), 399, [])).toBeNull()
    expect(createSale(cartItems({ a: 1 }, products), 400, [])).not.toBeNull()
  })

  it('空の明細や、合計が0円未満のときは、会計を作らない', () => {
    const withDiscount: Product[] = [...products, { id: 'd', name: '割引', price: -50 }]
    expect(createSale([], null, [])).toBeNull()
    expect(createSale(cartItems({ d: 1 }, withDiscount), null, [])).toBeNull()
    expect(createSale(cartItems({ b: 1, d: 3 }, withDiscount), null, [])).toMatchObject({ total: 0, paid: 0, change: 0 })
  })

  it('整数でない番号の会計が残っていても、次の番号は整数の番号から振る', () => {
    const items = cartItems({ a: 1 }, products)
    const first = mustCreateSale(items, null, [])
    const broken = { ...first, id: 'x', no: 'abc' as unknown as number }
    expect(mustCreateSale(items, null, [first, broken]).no).toBe(2)
    expect(mustCreateSale(items, null, [broken]).no).toBe(1)
  })

  it('日時は渡した時刻の ISO 8601 の文字列にする', () => {
    const now = new Date(2026, 9, 25, 9, 5, 30)
    expect(mustCreateSale(cartItems({ a: 1 }, products), null, [], now).at).toBe(now.toISOString())
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

  it('空の明細の合計は0で、合計0円ちょうどは会計でき、0円未満はできない', () => {
    expect(itemsTotal([])).toBe(0)
    const zero = [{ productId: 'b', name: 'ラムネ', price: 150, qty: 1 }, { productId: 'd', name: '割引', price: -50, qty: 3 }]
    expect(itemsTotal(zero)).toBe(0)
    expect(canCheckout(zero)).toBe(true)
    const minus = [{ productId: 'b', name: 'ラムネ', price: 150, qty: 1 }, { productId: 'd', name: '割引', price: -50, qty: 4 }]
    expect(itemsTotal(minus)).toBe(-50)
    expect(canCheckout(minus)).toBe(false)
  })

  it('取消済みを除いて集計し、商品の一覧にない商品は末尾に置く', () => {
    const s1 = mustCreateSale([{ productId: 'x', name: '一覧にない商品', price: 100, qty: 1 }, ...cartItems({ b: 1 }, products)], 250, [])
    const s2 = mustCreateSale(cartItems({ a: 2, b: 1 }, products), 950, [s1])
    const s3 = { ...mustCreateSale(cartItems({ a: 5 }, products), 2000, [s1, s2]), voided: true }
    const summary = summarize([s1, s2, s3], products)
    expect(summary.total).toBe(250 + 950)
    expect(summary.count).toBe(2)
    expect(summary.byProduct.map((r) => [r.name, r.qty, r.amount])).toEqual([
      ['焼きそば', 2, 800],
      ['ラムネ', 2, 300],
      ['一覧にない商品', 1, 100],
    ])
  })

  it('マイナス価格の商品も、商品ごとの集計に数量と金額が出る', () => {
    const withDiscount: Product[] = [...products, { id: 'd', name: '割引', price: -50 }]
    const s1 = mustCreateSale(cartItems({ a: 1, d: 1 }, withDiscount), 350, [])
    const s2 = mustCreateSale(cartItems({ b: 1, d: 1 }, withDiscount), 100, [s1])
    const summary = summarize([s1, s2], withDiscount)
    expect(summary.total).toBe(450)
    expect(summary.count).toBe(2)
    expect(summary.byProduct.map((r) => [r.name, r.qty, r.amount])).toEqual([
      ['焼きそば', 1, 400],
      ['ラムネ', 1, 150],
      ['割引', 2, -100],
    ])
  })

  it('取り消した会計は、売上合計・件数・商品ごとの集計のどれにも入らない', () => {
    const s1 = mustCreateSale(cartItems({ a: 1 }, products), 400, [])
    const s2 = { ...mustCreateSale(cartItems({ b: 3 }, products), 450, [s1]), voided: true }
    const summary = summarize([s1, s2], products)
    expect(summary.total).toBe(400)
    expect(summary.count).toBe(1)
    expect(summary.byProduct.map((r) => r.name)).toEqual(['焼きそば'])
  })

  it('会計がないときは 0 円・0 件・空の一覧になる', () => {
    expect(summarize([], products)).toEqual({ total: 0, count: 0, byProduct: [] })
    const voided = { ...mustCreateSale(cartItems({ a: 1 }, products), 400, []), voided: true }
    expect(summarize([voided], products)).toEqual({ total: 0, count: 0, byProduct: [] })
  })
})

describe('voidSale', () => {
  const s1 = mustCreateSale(cartItems({ a: 2 }, products), 1000, [])
  const s2 = mustCreateSale(cartItems({ b: 1 }, products), 150, [s1])
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
  it('ファイル名は保存した日時を入れる', () => {
    expect(salesCsvFileName(new Date(2026, 9, 25, 9, 5))).toBe('dayresi-sales-20261025-0905.csv')
  })

  it('1 行を明細 1 件にし、取り消した会計も「取消」として出す', () => {
    const base = { at: '2026-10-25T03:00:00.000Z', paid: 1000, voided: false }
    const s1: Sale = { ...base, id: '1', no: 1, total: 750, change: 250, items: [{ productId: 'a', name: '焼きそば', price: 400, qty: 2 }, { productId: 'd', name: '割引', price: -50, qty: 1 }] }
    const s2: Sale = { ...base, id: '2', no: 2, total: 150, change: 850, voided: true, items: [{ productId: 'b', name: 'ラムネ', price: 150, qty: 1 }] }
    const csv = salesToCsv([s1, s2])
    expect(csv.startsWith('\uFEFF会計番号,日時,商品名,単価,数量,小計,会計合計,お預かり,おつり,状態\r\n')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    const rows = csv.slice(1).split('\r\n').slice(1, -1).map((r) => r.split(','))
    expect(rows.map((r) => [r[0], r[2], r[5], r[9]])).toEqual([
      ['1', '焼きそば', '800', ''],
      ['1', '割引', '-50', ''],
      ['2', 'ラムネ', '150', '取消'],
    ])
  })

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

  it('カンマや改行を含む商品名は「"」で囲む', () => {
    const sale = mustCreateSale([{ productId: 'a', name: '焼きそば,大盛り', price: 500, qty: 1 }, { productId: 'b', name: 'ラムネ\r\n冷', price: 150, qty: 1 }], 650, [])
    const csv = salesToCsv([sale])
    expect(csv).toContain(',"焼きそば,大盛り",500,')
    expect(csv).toContain(',"ラムネ\r\n冷",150,')
  })

  it('会計が 0 件なら見出しだけを出す', () => {
    expect(salesToCsv([])).toBe('﻿会計番号,日時,商品名,単価,数量,小計,会計合計,お預かり,おつり,状態\r\n')
  })

  it('1 行に会計の値をすべて出し、日時は PC の時刻で書く', () => {
    const sale = mustCreateSale([{ productId: 'a', name: '焼きそば', price: 400, qty: 2 }], 1000, [], new Date(2026, 9, 25, 9, 5, 30))
    expect(salesToCsv([sale]).split('\r\n')[1]).toBe('1,2026-10-25 09:05:30,焼きそば,400,2,800,800,1000,200,')
  })

  it('マイナス価格は数値のまま出力する', () => {
    const sale = mustCreateSale([{ productId: 'd', name: '割引', price: -50, qty: 2 }, { productId: 'a', name: '焼きそば', price: 400, qty: 1 }], 300, [])
    const rows = salesToCsv([sale]).split('\r\n')
    expect(rows[1].split(',').slice(2, 6)).toEqual(['割引', '-50', '2', '-100'])
  })
})

describe('storage', () => {
  it('空のデータは空で、壊れた商品はその商品だけ捨てる', () => {
    expect(parseData(null)).toEqual({ products: [], sales: [] })
    const broken = [{ id: 1, name: 'a', price: 1 }, { id: 'x', name: '   ', price: 1 }, { id: 'y', name: 'a', price: 1.5 }, null]
    expect(parseData(JSON.stringify({ products: [products[0], ...broken], sales: [] })).products).toEqual([products[0]])
  })

  it('番号や合計が壊れた会計も、計算が合わない会計も、捨てずに残す', () => {
    const odd = { id: 's', no: '1', at: 123, items: [{ productId: 'a', name: '', price: 'abc', qty: 1 }], total: '400', paid: null, change: 99, voided: 'no' }
    const mismatch = { ...createSale(cartItems({ a: 1 }, products), 400, []), total: 9999, change: -1 }
    const sales = parseData(JSON.stringify({ products: [], sales: [odd, mismatch] })).sales
    expect(sales).toEqual([odd, mismatch])
  })

  it('画面が止まるほど壊れた会計（オブジェクトでない、明細が一覧でない、明細がオブジェクトでない）だけ捨てる', () => {
    const ok = createSale(cartItems({ a: 1 }, products), 400, [])
    const bad = [null, 'sale', 1, { ...ok, items: 'x' }, { ...ok, items: undefined }, { ...ok, items: [null] }, { ...ok, items: [1] }]
    expect(parseData(JSON.stringify({ products: [], sales: [...bad, ok] })).sales).toEqual([ok])
  })

  it('マイナス価格の商品を捨てずに読み込む', () => {
    const discount = { id: 'd', name: '割引', price: -50 }
    expect(parseData(JSON.stringify({ products: [discount], sales: [] })).products).toEqual([discount])
  })

  describe('localStorage', () => {
    const original = globalThis.localStorage
    const stub = (entries: Record<string, string>) => {
      const map = new Map(Object.entries(entries))
      globalThis.localStorage = {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
      } as Storage
      return map
    }
    afterEach(() => {
      globalThis.localStorage = original
    })

    it('dayresi:v2 から読み、dayresi:v2 に保存する', () => {
      const map = stub({ 'dayresi:v2': JSON.stringify({ products: [products[0]], sales: [] }) })
      expect(loadData().products).toEqual([products[0]])
      saveData({ products, sales: [] })
      expect(JSON.parse(map.get('dayresi:v2')!).products).toEqual(products)
    })

    it('JSON として読めないデータは捨てて空で始める', () => {
      stub({ 'dayresi:v2': '{broken' })
      expect(loadData()).toEqual({ products: [], sales: [] })
      stub({ 'dayresi:v2': 'null' })
      expect(loadData()).toEqual({ products: [], sales: [] })
    })

    it('保存に失敗しても例外を投げない', () => {
      stub({})
      globalThis.localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError') }
      expect(() => saveData({ products, sales: [] })).not.toThrow()
    })

    it('全データ消去で空のデータを保存すると、商品も会計もなくなる', () => {
      const sale = createSale(cartItems({ a: 1 }, products), 400, [])
      const map = stub({ 'dayresi:v2': JSON.stringify({ products, sales: [sale] }) })
      saveData(reducer(loadData(), { type: 'resetAll' }))
      expect(JSON.parse(map.get('dayresi:v2')!)).toEqual({ products: [], sales: [] })
      expect(loadData()).toEqual({ products: [], sales: [] })
    })

    it('作り直す前の dayresi:v1 は読まず、保存しても消さない', () => {
      const v1 = JSON.stringify({ products: [products[0]], sales: [] })
      const map = stub({ 'dayresi:v1': v1 })
      expect(loadData()).toEqual({ products: [], sales: [] })
      saveData({ products, sales: [] })
      expect(map.get('dayresi:v1')).toBe(v1)
    })
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
    const sale = mustCreateSale(cartItems({ a: 1 }, products), 400, [])
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
