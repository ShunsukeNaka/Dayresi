import type { Sale } from '../types'
import { formatTime, formatYen } from '../lib/format'
import { voidableSaleIds } from '../lib/sales'

type Props = {
  sales: Sale[]
  onVoid: (id: string) => void
}

/**
 * 履歴画面（SPEC「会計」、ADR 0012）
 * - 会計を新しい順に並べ、会計番号・時刻・合計・明細（商品名×数量）を出す
 * - 「取消」は確認してから取り消す。取り消した会計は消さずに「取消済」と出し、取消ボタンは出さない（元に戻す処理はない）
 * - 保存データの会計は壊れていても捨てずに残す（#64）ので、値が壊れていても画面が止まらないようにする
 * - ID がない・ほかの会計と重なる壊れた会計には、取消ボタンを出さない（#73）
 */
export function HistoryView({ sales, onVoid }: Props) {
  // 会計は末尾に足されるだけで並びが変わらないので、元の位置を key にする（壊れた会計の id が重なっても区別できる）
  const newestFirst = sales.map((s, index) => ({ s, index })).reverse()
  const voidable = voidableSaleIds(sales)

  return (
    <section className="tab">
      <div className="container page">
        <h2 className="page-title">履歴</h2>
        {sales.length === 0 && <p className="empty">まだ会計はありません。</p>}
        {/* 1 行に 会計番号・時刻・明細・合計・取消 を並べる */}
        {sales.length > 0 && (
          <ul className="history-list">
            {newestFirst.map(({ s, index }) => (
              <li key={index} className={s.voided ? 'voided' : ''}>
                <span className="no">{`#${s.no}`}</span>
                <span className="time">{formatTime(s.at)}</span>
                <span className="items">
                  {s.voided && <span className="tag">取消済</span>}
                  {s.items.map((i) => `${i.name}×${i.qty}`).join('、')}
                </span>
                <span className="amount">{formatYen(s.total)}</span>
                <span className="history-ops">
                  {voidable.has(s.id) && (
                    <button
                      className="secondary"
                      onClick={() => {
                        if (confirm(`会計 #${s.no}（${formatYen(s.total)}）を取り消しますか？\n取り消すと集計から除かれ、元に戻せません。`)) onVoid(s.id)
                      }}
                    >
                      取消
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
