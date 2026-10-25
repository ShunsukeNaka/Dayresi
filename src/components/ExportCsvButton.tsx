import type { Sale } from '../types'
import { salesCsvFileName, salesToCsv } from '../lib/csv'
import { downloadFile } from '../lib/download'

type Props = {
  sales: Sale[]
}

export function ExportCsvButton({ sales }: Props) {
  return (
    <button
      className="secondary"
      disabled={sales.length === 0}
      onClick={() => downloadFile(salesCsvFileName(), salesToCsv(sales), 'text/csv;charset=utf-8')}
    >
      売上CSVを保存
    </button>
  )
}
