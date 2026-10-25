import type { Product } from '../types'
import { isValidName, isValidPrice } from './format'

/**
 * 端末のあいだで渡すデータ（spec-next.md「商品を配る」「データ」）
 * URL の # 以降に「種類=データ」の形で入れる。# 以降はサーバー（GitHub Pages）に送られない
 * データは JSON を deflate-raw で縮めて base64url にする
 */

/** 代表者が配る商品。会計する人のレジに取り込む */
export type ProductsShare = {
  kind: 'products'
  /** 店ごとの印。同じ店のレジかどうかを見分ける */
  storeId: string
  /** レジの名前（代表者が付けたもの） */
  name: string
  products: Product[]
}

/** データの形の版。形を変えたら上げ、読めない版は取り込まない */
const VERSION = 1
/** # 以降の種類 */
const PRODUCTS_KEY = 'p'

async function compress(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompress(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** 商品を配るデータを、URL の # 以降に入れる文字列（# は含まない）にする */
export async function encodeProductsShare(share: Omit<ProductsShare, 'kind'>): Promise<string> {
  const body = [VERSION, share.storeId, share.name, share.products.map((p) => [p.id, p.name, p.price])]
  return `${PRODUCTS_KEY}=${toBase64Url(await compress(JSON.stringify(body)))}`
}

/** 配られた商品を 1 つ読む。ルールに合わない商品は捨てる */
function toProduct(x: unknown): Product | null {
  if (!Array.isArray(x)) return null
  const [id, name, price] = x as unknown[]
  return typeof id === 'string' && id && isValidName(name) && isValidPrice(price) ? { id, name, price } : null
}

/**
 * URL の # 以降を読む。引き渡しのデータでない・壊れている・読めない版のときは null
 * hash は location.hash のように先頭の # があってもなくてもよい
 */
export async function decodeShare(hash: string): Promise<ProductsShare | null> {
  const [key, data] = hash.replace(/^#/, '').split('=', 2)
  if (key !== PRODUCTS_KEY || !data) return null
  try {
    const body = JSON.parse(await decompress(fromBase64Url(data))) as unknown
    if (!Array.isArray(body)) return null
    const [version, storeId, name, products] = body as unknown[]
    if (version !== VERSION || typeof storeId !== 'string' || !storeId || !isValidName(name) || !Array.isArray(products)) return null
    return { kind: 'products', storeId, name, products: products.map(toProduct).filter((p) => p !== null) }
  } catch {
    return null
  }
}

/** 今のページの URL（# より前）に、引き渡しのデータを付けたリンク */
export function shareUrl(fragment: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}#${fragment}`
}
