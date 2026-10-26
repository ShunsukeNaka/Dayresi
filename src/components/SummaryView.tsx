import type { Coupon, Product, Sale } from '../types'
import { formatPercent, formatYen } from '../lib/format'
import { summarize } from '../lib/sales'

type Props = {
  sales: Sale[]
  products: Product[]
  coupons: Coupon[]
}

/**
 * 集計画面（SPEC「集計」）
 * - 売上合計と会計件数。取り消した会計は入れず、取消の件数は出さない
 * - 商品ごとの数量と金額を、商品の登録順に「商品」の見出しを付けた表で出す。マイナス価格の商品も出る
 * - 商品ごとに、売上に占める割合を横棒と % で出す。マイナス価格の商品には出さない
 * - 会計がない（取り消した会計だけのときも）ときは、表に「まだ売上はありません」と出す
 * - 割引券を使った会計があれば、割引券ごとの枚数と引いた金額の表を出す（docs/design/dayresi.pen の K-05・K-14）
 * - 売上 CSV の保存ボタンは設定画面にだけ置き、ここには置かない（#50）
 */
export function SummaryView({ sales, products, coupons }: Props) {
  const summary = summarize(sales, products, coupons)
  // 横棒の長さは、割合が一番大きい商品を目いっぱいにして比べる
  const maxShare = Math.max(0, ...summary.byProduct.map((r) => r.share ?? 0))

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

        <h3 className="section-title">商品</h3>
        <div className="table-box">
        <table className="table">
          <thead>
            <tr><th>商品</th><th>割合</th><th className="num">数量</th><th className="num">金額</th></tr>
          </thead>
          <tbody>
            {summary.byProduct.length === 0 && (
              <tr><td colSpan={4} className="empty-cell">まだ売上はありません</td></tr>
            )}
            {summary.byProduct.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td className="share">
                  {row.share === null ? (
                    <span className="share-none">—</span>
                  ) : (
                    <span className="share-cell">
                      <span className="share-bar" aria-hidden="true">
                        <span style={{ width: `${(row.share / maxShare) * 100}%` }} />
                      </span>
                      <span className="share-num">{formatPercent(row.share)}</span>
                    </span>
                  )}
                </td>
                <td className="num">{row.qty}</td>
                <td className={row.amount < 0 ? 'num minus' : 'num'}>{formatYen(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {summary.byCoupon.length > 0 && (
          <>
            <h3 className="section-title">割引券</h3>
            <div className="table-box">
              <table className="table coupon-table">
                <thead>
                  <tr><th>割引券</th><th className="num">枚数</th><th className="num">引いた金額</th></tr>
                </thead>
                <tbody>
                  {summary.byCoupon.map((row) => (
                    <tr key={row.key}>
                      <td>{row.name}</td>
                      <td className="num">{row.qty}</td>
                      <td className="num minus">{formatYen(-row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
