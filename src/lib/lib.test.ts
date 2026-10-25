import { afterEach, describe, expect, it } from 'vitest'
import type { Product, Sale, Store } from '../types'
import { canCheckout, canConfirmSale, createSale, itemsTotal, summarize, voidableSaleIds, voidSale } from './sales'
import { MAX_QTY, addToCart, cartItems, changeQty, clearCart } from './cart'
import { MAX_NAME_LENGTH, fileStamp, formatDateTime, formatPercent, formatTime, formatYen, isValidName, isValidPrice, parsePrice } from './format'
import { salesCsvFileName, salesToCsv } from './csv'
import { loadStore, parseData, parseStore, saveStore } from './storage'
import { DEFAULT_REGISTER_NAME, addRegister, createRegister, currentRegister, deleteRegister, findStoreRegister, importProducts, storeWith, switchRegister, updateCurrent } from './registers'
import { addProduct } from './products'
import { reducer } from '../state'
import { decodeShare, encodeProductsShare, shareUrl } from './share'
import { MAX_QR_VERSION, qrModules } from './qr'

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

  it('割合は、金額がプラスの商品の合計で割り、マイナスの商品は null になる', () => {
    const withDiscount: Product[] = [...products, { id: 'd', name: '割引', price: -50 }]
    const s1 = mustCreateSale(cartItems({ a: 3, b: 4, d: 2 }, withDiscount), 1700, [])
    const summary = summarize([s1], withDiscount)
    // 焼きそば 1200 円・ラムネ 600 円で、プラスの合計は 1800 円（割引の −100 円は入れない）
    expect(summary.byProduct.map((r) => [r.name, r.share])).toEqual([
      ['焼きそば', 1200 / 1800],
      ['ラムネ', 600 / 1800],
      ['割引', null],
    ])
    const sum = summary.byProduct.reduce((t, r) => t + (r.share ?? 0), 0)
    expect(sum).toBeCloseTo(1)
  })

  it('取り消した会計は割合にも入らない', () => {
    const s1 = mustCreateSale(cartItems({ a: 1 }, products), 400, [])
    const s2 = { ...mustCreateSale(cartItems({ b: 1 }, products), 150, [s1]), voided: true }
    expect(summarize([s1, s2], products).byProduct.map((r) => [r.name, r.share])).toEqual([['焼きそば', 1]])
  })

  it('会計がないときは 0 円・0 件・空の一覧になる', () => {
    expect(summarize([], products)).toEqual({ total: 0, count: 0, byProduct: [] })
    const voided = { ...mustCreateSale(cartItems({ a: 1 }, products), 400, []), voided: true }
    expect(summarize([voided], products)).toEqual({ total: 0, count: 0, byProduct: [] })
  })
})

describe('voidableSaleIds', () => {
  it('取消済みでなく、ID が文字列でほかと重ならない会計だけを返す', () => {
    const base = mustCreateSale(cartItems({ a: 1 }, products), 400, [])
    const sales = [
      { ...base, id: 'ok' },
      { ...base, id: 'voided', voided: true },
      { ...base, id: 'dup' },
      { ...base, id: 'dup' },
      { ...base, id: undefined as unknown as string },
    ]
    expect([...voidableSaleIds(sales)]).toEqual(['ok'])
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

  describe('レジの一覧（dayresi:v3）', () => {
    it('レジが 1 つもない・読めないときは、代表者のマイレジを 1 つ作る', () => {
      for (const raw of [null, '{}', JSON.stringify({ registers: [] }), JSON.stringify({ registers: [null, 1] })]) {
        const store = parseStore(raw)
        expect(store.registers).toHaveLength(1)
        expect(currentRegister(store)).toMatchObject({ name: DEFAULT_REGISTER_NAME, role: 'owner', myName: '', products: [], sales: [] })
      }
    })

    it('壊れた値は既定の値で補い、商品と会計は MVP と同じ決まりで読む', () => {
      const ok = createSale(cartItems({ a: 1 }, products), 400, [])
      const raw = JSON.stringify({ registers: [{ name: '', role: 'x', myName: 5, products: [products[0], { id: 1 }], sales: [ok, null] }], currentId: 'none' })
      const store = parseStore(raw)
      const r = currentRegister(store)
      expect(r).toMatchObject({ name: DEFAULT_REGISTER_NAME, role: 'owner', myName: '', products: [products[0]], sales: [ok] })
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(r.storeId).toMatch(/^[0-9a-f-]{36}$/)
      expect(store.currentId).toBe(r.id)
    })

    it('会計する人のレジと今のレジを、そのまま読む', () => {
      const owner = createRegister({ name: '研究室の模擬店', myName: '山田', products })
      const member = createRegister({ name: 'サークルの屋台', role: 'member', myName: '田中', storeId: 'store-1' })
      const store = parseStore(JSON.stringify({ registers: [owner, member], currentId: member.id }))
      expect(store).toEqual({ registers: [owner, member], currentId: member.id })
      expect(currentRegister(store)).toEqual(member)
    })
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

    it('dayresi:v3 から読み、dayresi:v3 に保存する', () => {
      const store = storeWith({ products })
      const map = stub({ 'dayresi:v3': JSON.stringify(store) })
      expect(loadStore()).toEqual(store)
      const next = updateCurrent(store, (r) => ({ ...r, products: [products[1]] }))
      saveStore(next)
      expect(JSON.parse(map.get('dayresi:v3')!)).toEqual(next)
    })

    it('dayresi:v3 がなければ、MVP の dayresi:v2 をマイレジに引き継ぎ、v2 は消さない', () => {
      const sale = createSale(cartItems({ a: 1 }, products), 400, [])
      const v2 = JSON.stringify({ products, sales: [sale] })
      const map = stub({ 'dayresi:v2': v2 })
      const store = loadStore()
      expect(store.registers).toHaveLength(1)
      expect(currentRegister(store)).toMatchObject({ name: DEFAULT_REGISTER_NAME, role: 'owner', products, sales: [sale] })
      saveStore(store)
      expect(map.get('dayresi:v2')).toBe(v2)
    })

    it('dayresi:v3 があれば、dayresi:v2 は読まない', () => {
      const store = storeWith()
      stub({ 'dayresi:v3': JSON.stringify(store), 'dayresi:v2': JSON.stringify({ products, sales: [] }) })
      expect(currentRegister(loadStore()).products).toEqual([])
    })

    it('JSON として読めないデータは捨てて、マイレジだけで始める', () => {
      const cases: Record<string, string>[] = [{ 'dayresi:v3': '{broken' }, { 'dayresi:v3': 'null' }, { 'dayresi:v2': '{broken' }]
      for (const entries of cases) {
        stub(entries)
        const store = loadStore()
        expect(store.registers).toHaveLength(1)
        expect(currentRegister(store)).toMatchObject({ name: DEFAULT_REGISTER_NAME, products: [], sales: [] })
      }
    })

    it('保存に失敗しても例外を投げない', () => {
      stub({})
      globalThis.localStorage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError') }
      expect(() => saveStore(storeWith({ products }))).not.toThrow()
    })

    it('作り直す前の dayresi:v1 は読まず、保存しても消さない', () => {
      const v1 = JSON.stringify({ products: [products[0]], sales: [] })
      const map = stub({ 'dayresi:v1': v1 })
      expect(currentRegister(loadStore()).products).toEqual([])
      saveStore(storeWith({ products }))
      expect(map.get('dayresi:v1')).toBe(v1)
    })
  })
})

describe('registers', () => {
  it('新しいレジは代表者で、ID と店の印を UUID で振る。会計する人のレジは店の印を受け継ぐ', () => {
    const owner = createRegister({ name: '研究室の模擬店' })
    expect(owner).toMatchObject({ name: '研究室の模擬店', role: 'owner', myName: '', products: [], sales: [] })
    expect(owner.id).not.toBe(owner.storeId)
    const member = createRegister({ name: '研究室の模擬店', role: 'member', storeId: owner.storeId, products })
    expect(member.storeId).toBe(owner.storeId)
    expect(member.id).not.toBe(owner.id)
  })

  it('今のレジだけを変え、変わらなければ同じ保存データを返す', () => {
    const a = createRegister({ name: 'A' })
    const b = createRegister({ name: 'B' })
    const store: Store = { registers: [a, b], currentId: b.id }
    const next = updateCurrent(store, (r) => ({ ...r, products }))
    expect(next.registers[0]).toBe(a)
    expect(next.registers[1].products).toEqual(products)
    expect(updateCurrent(store, (r) => r)).toBe(store)
  })

  it('レジを切り替え、ない ID や今のレジなら同じ保存データを返す', () => {
    const a = createRegister({ name: 'A' })
    const b = createRegister({ name: 'B' })
    const store: Store = { registers: [a, b], currentId: a.id }
    expect(switchRegister(store, b.id).currentId).toBe(b.id)
    expect(switchRegister(store, a.id)).toBe(store)
    expect(switchRegister(store, 'none')).toBe(store)
  })

  it('足したレジは末尾に入り、そのレジに切り替わる', () => {
    const store = storeWith()
    const b = createRegister({ name: 'B' })
    const next = addRegister(store, b)
    expect(next.registers.map((r) => r.name)).toEqual([DEFAULT_REGISTER_NAME, 'B'])
    expect(next.currentId).toBe(b.id)
  })

  it('今のレジを消すと最初のレジに切り替わり、ほかのレジを消しても今のレジは変わらない', () => {
    const a = createRegister({ name: 'A' })
    const b = createRegister({ name: 'B' })
    const c = createRegister({ name: 'C' })
    const store: Store = { registers: [a, b, c], currentId: b.id }
    expect(deleteRegister(store, b.id)).toEqual({ registers: [a, c], currentId: a.id })
    expect(deleteRegister(store, c.id)).toEqual({ registers: [a, b], currentId: b.id })
    expect(deleteRegister(store, 'none')).toBe(store)
  })

  it('最後の 1 つを消すと、マイレジを自動で作る', () => {
    const a = createRegister({ name: 'A', products })
    const next = deleteRegister({ registers: [a], currentId: a.id }, a.id)
    expect(next.registers).toHaveLength(1)
    expect(currentRegister(next)).toMatchObject({ name: DEFAULT_REGISTER_NAME, role: 'owner', products: [] })
    expect(currentRegister(next).id).not.toBe(a.id)
  })

  it('配られた商品は、会計する人のレジとして足して切り替える', () => {
    const store = storeWith({ products })
    const { store: next, result } = importProducts(store, { storeId: 'store-1', name: '研究室の模擬店', products }, '田中')
    expect(result).toBe('added')
    expect(currentRegister(next)).toMatchObject({ name: '研究室の模擬店', role: 'member', myName: '田中', storeId: 'store-1', products, sales: [] })
    expect(next.registers).toHaveLength(2)
    expect(next.registers[0]).toBe(store.registers[0])
    expect(findStoreRegister(next, 'store-1')).toBe(currentRegister(next))
  })

  it('何も入っていないマイレジしかないときは、取り込んだレジに置き換える', () => {
    const { store: next } = importProducts(storeWith(), { storeId: 'store-1', name: '研究室の模擬店', products }, '田中')
    expect(next.registers).toHaveLength(1)
    expect(currentRegister(next)).toMatchObject({ name: '研究室の模擬店', role: 'member' })
    const named = updateCurrent(storeWith(), (r) => ({ ...r, myName: '山田' }))
    expect(importProducts(named, { storeId: 'store-1', name: '店', products }, '田中').store.registers).toHaveLength(2)
  })

  it('同じ店の会計する人のレジがあれば、商品と名前を置き換えて切り替え、会計と自分の名前は残す', () => {
    const sale = mustCreateSale(cartItems({ a: 1 }, products), 400, [])
    const member = createRegister({ name: '旧名', role: 'member', myName: '田中', storeId: 'store-1', products: [products[0]], sales: [sale] })
    const store: Store = { registers: [storeWith().registers[0], member], currentId: 'x' }
    const { store: next, result } = importProducts(store, { storeId: 'store-1', name: '研究室の模擬店', products }, '別名')
    expect(result).toBe('updated')
    expect(next.registers).toHaveLength(2)
    expect(currentRegister(next)).toMatchObject({ id: member.id, name: '研究室の模擬店', myName: '田中', products, sales: [sale] })
  })

  it('同じ店の代表者のレジ（自分で配ったもの）には取り込まない', () => {
    const owner = createRegister({ name: '研究室の模擬店', storeId: 'store-1', products: [products[0]] })
    const store: Store = { registers: [owner], currentId: owner.id }
    const { store: next, result } = importProducts(store, { storeId: 'store-1', name: '別の名前', products }, '田中')
    expect(result).toBe('own')
    expect(next).toBe(store)
  })

  it('currentId がどのレジとも合わないときは、最初のレジを今のレジにする', () => {
    const a = createRegister({ name: 'A' })
    expect(currentRegister({ registers: [a], currentId: 'none' })).toBe(a)
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
  const empty = storeWith({ products })
  const cur = (store: Store) => currentRegister(store)

  it('商品を登録し、ルールに合わない商品では状態を変えない', () => {
    const state = reducer(empty, { type: 'addProduct', name: '割引', price: -50 })
    expect(cur(state).products.map((p) => p.name)).toEqual(['焼きそば', 'ラムネ', '割引'])
    expect(reducer(empty, { type: 'addProduct', name: '　', price: 100 })).toBe(empty)
  })

  it('会計を確定し、1 から番号を振る', () => {
    let state = reducer(empty, { type: 'checkout', items: cartItems({ a: 1 }, products), paid: 1000 })
    state = reducer(state, { type: 'checkout', items: cartItems({ b: 2 }, products), paid: null })
    expect(cur(state).sales.map((s) => [s.no, s.total, s.paid, s.change])).toEqual([[1, 400, 1000, 600], [2, 300, 300, 0]])
  })

  it('確定できない会計では状態を変えない', () => {
    expect(reducer(empty, { type: 'checkout', items: [], paid: null })).toBe(empty)
    expect(reducer(empty, { type: 'checkout', items: cartItems({ a: 1 }, products), paid: 100 })).toBe(empty)
    expect(canConfirmSale(cartItems({ a: 1 }, products), 100)).toBe(false)
    expect(canConfirmSale(cartItems({ a: 1 }, products), null)).toBe(true)
  })

  it('会計を取り消し、取消済みやない ID では状態を変えない', () => {
    let state = reducer(empty, { type: 'checkout', items: cartItems({ a: 1 }, products), paid: null })
    state = reducer(state, { type: 'voidSale', id: cur(state).sales[0].id })
    expect(cur(state).sales[0].voided).toBe(true)
    expect(reducer(state, { type: 'voidSale', id: cur(state).sales[0].id })).toBe(state)
    expect(reducer(state, { type: 'voidSale', id: 'none' })).toBe(state)
  })

  it('全データ消去で、今のレジの商品と会計だけが消え、ほかのレジとレジそのものは残る', () => {
    const other = createRegister({ name: 'サークルの屋台', role: 'member', products })
    let state: Store = { ...empty, registers: [...empty.registers, other] }
    state = reducer(state, { type: 'checkout', items: cartItems({ a: 1 }, products), paid: null })
    const cleared = reducer(state, { type: 'resetAll' })
    expect(cur(cleared)).toMatchObject({ id: cur(state).id, name: DEFAULT_REGISTER_NAME, products: [], sales: [] })
    expect(cleared.registers[1]).toBe(other)
    expect(reducer(cleared, { type: 'resetAll' })).toBe(cleared)
  })

  it('新しいレジを代表者として作って切り替え、名前がルールに合わなければ作らない', () => {
    const state = reducer(empty, { type: 'createRegister', name: '研究室の模擬店', myName: '山田' })
    expect(state.registers).toHaveLength(2)
    expect(cur(state)).toMatchObject({ name: '研究室の模擬店', myName: '山田', role: 'owner', products: [], sales: [] })
    expect(reducer(empty, { type: 'createRegister', name: '　', myName: '山田' })).toBe(empty)
    expect(reducer(empty, { type: 'createRegister', name: '研究室の模擬店', myName: '' })).toBe(empty)
  })

  it('レジを切り替え・削除する', () => {
    const created = reducer(empty, { type: 'createRegister', name: 'B', myName: '山田' })
    const switched = reducer(created, { type: 'switchRegister', id: empty.currentId })
    expect(cur(switched).name).toBe(DEFAULT_REGISTER_NAME)
    const deleted = reducer(switched, { type: 'deleteRegister', id: empty.currentId })
    expect(deleted.registers.map((r) => r.name)).toEqual(['B'])
    expect(cur(deleted).name).toBe('B')
  })

  it('今のレジの自分の名前を変え、ルールに合わない・同じ名前では状態を変えない', () => {
    const state = reducer(empty, { type: 'setMyName', name: '山田' })
    expect(cur(state).myName).toBe('山田')
    expect(reducer(state, { type: 'setMyName', name: '山田' })).toBe(state)
    expect(reducer(state, { type: 'setMyName', name: '　' })).toBe(state)
  })

  it('会計する人のレジでは、商品を登録できない', () => {
    const member = createRegister({ name: '研究室の模擬店', role: 'member', myName: '田中', products })
    const state: Store = { registers: [member], currentId: member.id }
    expect(reducer(state, { type: 'addProduct', name: '割引', price: -50 })).toBe(state)
  })

  it('配られた商品を取り込み、新しく足すときは自分の名前が要る', () => {
    const share = { storeId: 'store-1', name: '研究室の模擬店', products }
    expect(reducer(empty, { type: 'importProducts', share, myName: '' })).toBe(empty)
    const added = reducer(empty, { type: 'importProducts', share, myName: '田中' })
    expect(cur(added)).toMatchObject({ role: 'member', myName: '田中' })
    const updated = reducer(added, { type: 'importProducts', share: { ...share, products: [products[0]] }, myName: '' })
    expect(cur(updated).products).toEqual([products[0]])
  })

  it('操作は今のレジにだけ働く', () => {
    const other = createRegister({ name: 'サークルの屋台', products })
    const state: Store = { registers: [...empty.registers, other], currentId: other.id }
    const next = reducer(state, { type: 'addProduct', name: '割引', price: -50 })
    expect(next.registers[0]).toBe(empty.registers[0])
    expect(next.registers[1].products).toHaveLength(3)
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

  it('割合は小数第 1 位までの % で表示する', () => {
    expect(formatPercent(1200 / 1800)).toBe('66.7%')
    expect(formatPercent(1)).toBe('100.0%')
    expect(formatPercent(0.0004)).toBe('0.0%')
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

describe('share（商品を配る）', () => {
  const tenProducts: Product[] = Array.from({ length: 10 }, (_, i) => ({ id: crypto.randomUUID(), name: `たこ焼き（8個）${i}`, price: i === 9 ? -50 : 400 + i * 10 }))

  it('商品・レジの名前・店の印を詰めて、そのまま読み出せる', async () => {
    const fragment = await encodeProductsShare({ storeId: 'store-1', name: '研究室の模擬店', products: tenProducts })
    expect(fragment).toMatch(/^p=[A-Za-z0-9_-]+$/)
    expect(await decodeShare(`#${fragment}`)).toEqual({ kind: 'products', storeId: 'store-1', name: '研究室の模擬店', products: tenProducts })
    expect(await decodeShare(fragment)).toEqual(await decodeShare(`#${fragment}`))
  })

  it('引き渡しのデータでない・壊れている・読めない版のときは null', async () => {
    for (const hash of ['', '#', '#x=abc', '#p=', '#p=!!!', '#p=YWJj']) expect(await decodeShare(hash)).toBeNull()
    const fragment = await encodeProductsShare({ storeId: 's', name: '店', products })
    expect(await decodeShare(fragment.slice(0, -4))).toBeNull()
  })

  it('ルールに合わない商品は捨てて読む', async () => {
    const bad = [...products, { id: '', name: 'x', price: 1 }, { id: 'z', name: '　', price: 1 }, { id: 'y', name: 'a', price: 1.5 }]
    const fragment = await encodeProductsShare({ storeId: 's', name: '店', products: bad as Product[] })
    expect((await decodeShare(fragment))?.products).toEqual(products)
  })

  it('リンクは今のページの URL に # を付けたもの', () => {
    expect(shareUrl('p=abc', 'https://example.com/Dayresi/')).toBe('https://example.com/Dayresi/#p=abc')
  })

  it('商品 10 個のリンクは、QR の上限に収まる', async () => {
    const url = shareUrl(await encodeProductsShare({ storeId: crypto.randomUUID(), name: '研究室の模擬店', products: tenProducts }), 'https://shunsukenaka.github.io/Dayresi/')
    const modules = qrModules(url)
    expect(modules).not.toBeNull()
    expect(modules!.length).toBeLessThanOrEqual(17 + 4 * MAX_QR_VERSION)
  })
})

describe('qr', () => {
  it('文字列を正方形の点の並びにし、上限を超えると null', () => {
    // バージョン 1（21 × 21）から順に、入る一番小さい大きさにする
    expect(qrModules('https://e.co/')!.length).toBe(21)
    const small = qrModules('https://example.com/')!
    expect(small.length).toBe(25)
    expect(small.every((row) => row.length === 25)).toBe(true)
    expect(qrModules('a'.repeat(5000))).toBeNull()
    const max = 17 + 4 * MAX_QR_VERSION
    const big = qrModules('a'.repeat(1200))
    expect(big === null || big.length <= max).toBe(true)
  })
})
