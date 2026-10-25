/** 商品の価格の上限（円） */
export const MAX_PRICE = 9_999_999
/** 割引などをマイナスの価格の商品として登録できる */
export const MIN_PRICE = -MAX_PRICE
/** 商品名の最大文字数。前後の空白も数える */
export const MAX_NAME_LENGTH = 30

export function formatYen(n: number): string {
  return (n < 0 ? '−¥' : '¥') + Math.abs(n).toLocaleString('ja-JP')
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** ファイル名用の YYYYMMDD-HHmm */
export function fileStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

export function isValidPrice(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_PRICE && n <= MAX_PRICE
}

/** 入力中の文字列を価格に変換する。全角や記号のマイナスも受け付ける。不正なら null */
export function parsePrice(s: string): number | null {
  const t = s.trim().replace(/^[−－]/, '-')
  if (!/^-?\d+$/.test(t)) return null
  const n = Number(t)
  return isValidPrice(n) ? n : null
}

export function isValidName(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0 && s.length <= MAX_NAME_LENGTH
}

/** 会計の ID。商品の ID は crypto.randomUUID() で振る */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
