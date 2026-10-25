import type { Sale } from '../types'
import { formatTime, formatYen } from '../lib/format'

type Props = {
  sales: Sale[]
  onVoid: (id: string) => void
}

/**
 * 履歴画面（SPEC「会計」、ADR 0012）
 * - 会計を新しい順に並べ、会計番号・時刻・合計・明細（商品名×数量）を出す
 * - 「取消」は確認してから取り消す。取り消した会計は消さずに「取消済」と出し、取消ボタンは出さない（元に戻す処理はない）
 * - 保存データの会計は壊れていても捨てずに残す（#64）ので、値が壊れていても画面が止まらないようにする
 */
export function HistoryView({ sales, onVoid }: Props) {
  // 会計は末尾に足されるだけで並びが変わらないので、元の位置を key にする（壊れた会計の id が重なっても区別できる）
  const newestFirst = sales.map((s, index) => ({ s, index })).reverse()

  return (
    <section className="tab">
      <div className="container">
        {sales.length === 0 && <p className="empty">まだ会計はありません。</p>}
        <ul className="history-list">
          {newestFirst.map(({ s, index }) => (
            <li key={index} className={s.voided ? 'voided' : ''}>
              <div className="meta">
                {`#${s.no}`}　{formatTime(s.at)}
                {s.voided && <span className="tag">取消済</span>}
              </div>
              <div className="amount">{formatYen(s.total)}</div>
              <div className="items">{s.items.map((i) => `${i.name}×${i.qty}`).join('、')}</div>
              <div className="history-ops">
                {!s.voided && (
                  <button
                    className="secondary"
                    onClick={() => {
                      if (confirm(`会計 #${s.no}（${formatYen(s.total)}）を取り消しますか？\n取り消すと集計から除かれ、元に戻せません。`)) onVoid(s.id)
                    }}
                  >
                    取消
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
