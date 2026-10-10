import type { Sale } from '../types'
import { salesToCsv } from '../lib/csv'
import { downloadFile } from '../lib/download'
import { fileStamp } from '../lib/format'

type Props = {
  sales: Sale[]
  className?: string
}

export function ExportCsvButton({ sales, className = 'secondary' }: Props) {
  return (
    <button
      className={className}
      disabled={sales.length === 0}
      onClick={() => downloadFile(`dayresi-sales-${fileStamp()}.csv`, salesToCsv(sales), 'text/csv;charset=utf-8')}
    >
      売上CSVを保存
    </button>
  )
}
