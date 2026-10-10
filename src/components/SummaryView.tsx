import type { Product, Sale } from '../types'
import { formatYen } from '../lib/format'
import { summarize } from '../lib/sales'
import { ExportCsvButton } from './ExportCsvButton'

type Props = {
  sales: Sale[]
  products: Product[]
}

export function SummaryView({ sales, products }: Props) {
  const summary = summarize(sales, products)

  return (
    <section className="tab">
      <div className="container">
        <div className="cards">
          <div className="card">
            <div className="label">売上合計</div>
            <div className="value">{formatYen(summary.total)}</div>
          </div>
          <div className="card">
            <div className="label">会計件数</div>
            <div className="value">{summary.count} 件</div>
            {summary.voidedCount > 0 && <div className="sub-label">ほかに取消 {summary.voidedCount} 件</div>}
          </div>
        </div>

        <table className="table">
          <thead>
            <tr><th>商品</th><th className="num">数量</th><th className="num">金額</th></tr>
          </thead>
          <tbody>
            {summary.byProduct.length === 0 && (
              <tr><td colSpan={3} className="empty-cell">まだ売上はありません</td></tr>
            )}
            {summary.byProduct.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td className="num">{row.qty}</td>
                <td className="num">{formatYen(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row-actions">
          <ExportCsvButton sales={sales} className="primary" />
        </div>
      </div>
    </section>
  )
}
