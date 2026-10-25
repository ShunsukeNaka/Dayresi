/** 商品の価格の上限（円） */
export const MAX_PRICE = 9_999_999
/** 割引などをマイナスの価格の商品として登録できる */
export const MIN_PRICE = -MAX_PRICE
/** 商品名の最大文字数。前後の空白も数える */
export const MAX_NAME_LENGTH = 30

/** 金額の表示。¥1,000、マイナスは記号（U+2212）を ¥ の前に置いて −¥50 */
export function formatYen(n: number): string {
  return (n < 0 ? '−¥' : '¥') + Math.abs(n).toLocaleString('ja-JP')
}

/** 履歴の時刻。PC の時刻で 9:05（時は 0 を付けず、分は 2 桁） */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 売上 CSV の日時。PC の時刻で 2026-10-25 09:05:30 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** ファイル名用の日時。PC の時刻で 20261025-1530（YYYYMMDD-HHmm） */
export function fileStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

export function isValidPrice(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_PRICE && n <= MAX_PRICE
}

/**
 * 入力中の文字列を価格に変換する。不正なら null
 * 全角の数字（４００）と、全角や記号のマイナス（－・−）も受け付ける。桁区切りのカンマ・¥・円は受け付けない
 */
export function parsePrice(s: string): number | null {
  const t = s
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/^[−－]/, '-')
  if (!/^-?\d+$/.test(t)) return null
  const n = Number(t)
  return isValidPrice(n) ? n : null
}

/** 空白だけは不可。前後の空白も含めて MAX_NAME_LENGTH 文字まで */
export function isValidName(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0 && s.length <= MAX_NAME_LENGTH
}
