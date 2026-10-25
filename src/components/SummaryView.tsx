import type { Product, Sale } from '../types'
import { formatYen } from '../lib/format'
import { summarize } from '../lib/sales'

type Props = {
  sales: Sale[]
  products: Product[]
}

/**
 * 集計画面（SPEC「集計」）
 * - 売上合計と会計件数。取り消した会計は入れず、取消の件数は出さない
 * - 商品ごとの数量と金額を、商品の登録順に表で出す。マイナス価格の商品も出る
 * - 会計がない（取り消した会計だけのときも）ときは、表に「まだ売上はありません」と出す
 * - 売上 CSV の保存ボタンは設定画面にだけ置き、ここには置かない（#50）
 */
export function SummaryView({ sales, products }: Props) {
  const summary = summarize(sales, products)

  return (
    <section className="tab">
      <div className="container page">
        <h2 className="page-title">集計</h2>
        {/* 売上合計と会計件数は、1 つの枠に並べる */}
        <div className="cards">
          <div className="card">
            <div className="label">売上合計</div>
            <div className="value">{formatYen(summary.total)}</div>
          </div>
          <div className="card">
            <div className="label">会計件数</div>
            <div className="value">{summary.count}件</div>
          </div>
        </div>

        <div className="table-box">
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
                <td className={row.amount < 0 ? 'num minus' : 'num'}>{formatYen(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  )
}
