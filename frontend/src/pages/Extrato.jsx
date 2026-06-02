import { motion } from 'framer-motion'
import { transacoes, brl } from '../data.js'
import TiltCard from '../components/TiltCard.jsx'
import CountUp from '../components/CountUp.jsx'
import WordReveal from '../components/WordReveal.jsx'

const list = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}
const row = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }
}

export default function Extrato() {
  const entradas = transacoes.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0)
  const saidas = transacoes.filter(t => t.valor < 0).reduce((s, t) => s + t.valor, 0)
  const saldoPeriodo = entradas + saidas

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <WordReveal className="page-title">Extrato</WordReveal>
          <p className="page-subtitle">Suas últimas movimentações</p>
        </div>
      </div>

      {/* Resumo entradas/saídas com tilt */}
      <div className="summary-grid">
        <TiltCard className="summary-card">
          <span className="summary-label">Entradas</span>
          <span className="summary-value pos">
            <CountUp value={entradas} duration={800} />
          </span>
        </TiltCard>
        <TiltCard className="summary-card">
          <span className="summary-label">Saídas</span>
          <span className="summary-value neg">
            <CountUp value={saidas} duration={800} />
          </span>
        </TiltCard>
        <TiltCard className="summary-card">
          <span className="summary-label">Saldo do período</span>
          <span className="summary-value" style={{ color: saldoPeriodo >= 0 ? 'var(--green)' : 'var(--red)' }}>
            <CountUp value={saldoPeriodo} duration={900} />
          </span>
        </TiltCard>
      </div>

      {/* Lista de transações */}
      <motion.div className="txn-list" variants={list} initial="hidden" animate="show">
        {transacoes.map((t) => (
          <motion.div className="txn" key={t.id} variants={row}>
            <div className={`txn-icon ${t.tipo}`}>
              {t.tipo === 'entrada' ? '↓' : '↑'}
            </div>
            <div className="txn-info">
              <span className="txn-title">{t.titulo}</span>
              <span className="txn-cat">{t.categoria} · {t.data}</span>
            </div>
            <span className={`txn-value ${t.valor > 0 ? 'pos' : 'neg'}`}>
              {brl(t.valor)}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
