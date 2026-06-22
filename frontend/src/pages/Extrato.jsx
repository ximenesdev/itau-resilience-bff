import { transacoes, brl } from '../data.js'
import CountUp from '../components/CountUp.jsx'

// Tela de extrato (visão do cliente). Conteúdo SEMPRE visível — sem animação de
// entrada que esconda dados (boa prática: não condicionar visibilidade a motion).
export default function Extrato() {
  const entradas = transacoes.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0)
  const saidas = transacoes.filter(t => t.valor < 0).reduce((s, t) => s + t.valor, 0)
  const saldoPeriodo = entradas + saidas

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Extrato</h1>
          <p className="page-subtitle">Últimas movimentações da conta</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="summary-label">Entradas</span>
          <span className="summary-value pos"><CountUp value={entradas} duration={800} /></span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Saídas</span>
          <span className="summary-value neg"><CountUp value={saidas} duration={800} /></span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Saldo do período</span>
          <span className={`summary-value ${saldoPeriodo >= 0 ? 'pos' : 'neg'}`}>
            <CountUp value={saldoPeriodo} duration={900} />
          </span>
        </div>
      </div>

      <div className="txn-list">
        {transacoes.map((t) => (
          <div className="txn" key={t.id}>
            <div className={`txn-icon ${t.tipo}`}>{t.tipo === 'entrada' ? '↓' : '↑'}</div>
            <div className="txn-info">
              <span className="txn-title">{t.titulo}</span>
              <span className="txn-cat">{t.categoria} · {t.data}</span>
            </div>
            <span className={`txn-value ${t.valor > 0 ? 'pos' : 'neg'}`}>{brl(t.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
