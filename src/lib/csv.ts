/**
 * 売上 CSV の形式（#55）
 * - 1 行 = 会計の明細 1 件。1 行目は見出し
 * - 列：会計番号、会計した人、日時、商品名、単価、数量、小計、会計合計、お預かり、おつり、状態
 * - 会計した人は、代表者のレジに取り込んだ会計なら送った人の名前、自分の会計なら自分の名前（入れていなければ空）（spec-next.md「履歴・集計・出力」）
 * - 取り消した会計も出し、状態の列に「取消」と書く（取り消していなければ空）
 * - 文字コードは BOM 付き UTF-8（Excel で文字化けしないように）。改行は CRLF
 * - カンマ・改行・「"」を含む値は「"」で囲む
 * - ファイル名は dayresi-sales-YYYYMMDD-HHmm.csv（保存した日時）
 */
import type { Sale } from '../types'
import { fileStamp, formatDateTime } from './format'

const HEADER = ['会計番号', '会計した人', '日時', '商品名', '単価', '数量', '小計', '会計合計', 'お預かり', 'おつり', '状態']

function escapeField(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function salesToCsv(sales: Sale[], ownName = ''): string {
  const rows: (string | number)[][] = [HEADER]
  for (const sale of sales) {
    for (const item of sale.items) {
      rows.push([
        sale.no,
        sale.by ?? ownName,
        formatDateTime(sale.at),
        item.name,
        item.price,
        item.qty,
        item.price * item.qty,
        sale.total,
        sale.paid,
        sale.change,
        sale.voided ? '取消' : '',
      ])
    }
  }
  return '﻿' + rows.map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n'
}

export function salesCsvFileName(date = new Date()): string {
  return `dayresi-sales-${fileStamp(date)}.csv`
}
