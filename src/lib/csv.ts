import type { Sale } from '../types'
import { formatDateTime } from './format'

const HEADER = ['会計番号', '日時', '商品名', '単価', '数量', '小計', '会計合計', 'お預かり', 'おつり', '状態']

function escapeField(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** 1 行 = 会計の 1 明細。Excel で文字化けしないよう BOM を付ける */
export function salesToCsv(sales: Sale[]): string {
  const rows: (string | number)[][] = [HEADER]
  for (const sale of sales) {
    for (const item of sale.items) {
      rows.push([
        sale.no,
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
