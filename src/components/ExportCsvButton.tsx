import type { Sale } from '../types'
import { salesCsvFileName, salesToCsv } from '../lib/csv'
import { downloadFile } from '../lib/download'

type Props = {
  sales: Sale[]
  /** 自分の名前。売上 CSV の「会計した人」に、自分の会計の分として書く */
  ownName: string
}

/** 売上 CSV を保存するボタン。会計がないときは押せない */
export function ExportCsvButton({ sales, ownName }: Props) {
  return (
    <button
      className="secondary"
      disabled={sales.length === 0}
      onClick={() => downloadFile(salesCsvFileName(), salesToCsv(sales, ownName), 'text/csv;charset=utf-8')}
    >
      売上CSVを保存
    </button>
  )
}
