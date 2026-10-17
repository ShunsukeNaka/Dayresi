import type { Sale } from '../types'
import { formatTime, formatYen } from '../lib/format'

type Props = {
  sales: Sale[]
  onVoid: (id: string) => void
}

export function HistoryView({ sales, onVoid }: Props) {
  const newestFirst = [...sales].reverse()

  return (
    <section className="tab">
      <div className="container">
        {sales.length === 0 && <p className="empty">まだ会計はありません。</p>}
        <ul className="history-list">
          {newestFirst.map((s) => (
            <li key={s.id} className={s.voided ? 'voided' : ''}>
              <div className="meta">
                #{s.no}　{formatTime(s.at)}
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
