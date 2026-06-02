import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { brl } from '../data.js'
import TiltCard from '../components/TiltCard.jsx'
import CountUp from '../components/CountUp.jsx'
import WordReveal from '../components/WordReveal.jsx'
import MagneticButton from '../components/MagneticButton.jsx'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } }
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchDashboard = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await axios.get('/dashboard')
      setData(res.data)
    } catch (err) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

  // Circuit Breaker: detecta qual serviço está fora individualmente
  const saldoDown = data?.saldo?.status === 'CIRCUIT BREAKER ATIVO'
  const cartaoDown = data?.cartao?.status === 'CIRCUIT BREAKER ATIVO'
  const investimentosDown = data?.investimentos?.status === 'CIRCUIT BREAKER ATIVO'
  const anyDown = saldoDown || cartaoDown || investimentosDown

  // Monta a lista de serviços fora para o banner
  const servicosIndisponiveis = [
    saldoDown && 'saldo',
    cartaoDown && 'cartão',
    investimentosDown && 'investimentos',
  ].filter(Boolean)

  const bannerMsg = anyDown
    ? `⚡ ${servicosIndisponiveis.length} serviço(s) indisponível(is) — ${servicosIndisponiveis.join(', ')} temporariamente fora do ar`
    : 'Todos os serviços operacionais'

  return (
    <div className="page">

      <div className="page-head">
        <div>
          <WordReveal className="page-title">Olá, Bruno</WordReveal>
          <p className="page-subtitle">Aqui está o resumo das suas contas</p>
        </div>
        <MagneticButton
          className="btn-refresh"
          onClick={fetchDashboard}
          disabled={loading}
          translate="no"
        >
          <span className={loading ? 'spin-icon' : 'refresh-icon'}>↻</span> Atualizar
        </MagneticButton>
      </div>

      {data && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`status-banner ${anyDown ? 'circuit' : 'ok'}`}
        >
          <span className="status-dot" />
          {bannerMsg}
        </motion.div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Carregando seu painel...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-state">
          <div className="error-icon">!</div>
          <p className="error-title">Não foi possível conectar ao servidor</p>
          <p className="error-sub">Verifique se o <span translate="no">BFF</span> está rodando na porta 8083</p>
          <MagneticButton className="btn-refresh" onClick={fetchDashboard} translate="no">
            Tentar novamente
          </MagneticButton>
        </div>
      )}

      {data && !loading && (
        <motion.div className="cards-grid" variants={container} initial="hidden" animate="show">

          {/* ---- Card Saldo ---- */}
          <TiltCard className={`card ${saldoDown ? 'card-danger' : ''}`} variants={item}>
            <div className="card-accent" />
            <div className="card-header">
              <span className="card-label">Conta corrente</span>
              {saldoDown
                ? <span className="cb-badge" translate="no">⚡ fallback</span>
                : <div className="card-icon">◉</div>}
            </div>
            {saldoDown ? (
              <>
                <div className="card-value unavailable">Indisponível</div>
                <div className="card-sub">{data.saldo?.mensagem}</div>
                <div className="fallback-note">
                  O disjuntor isolou este serviço para proteger o restante do sistema.
                </div>
              </>
            ) : (
              <>
                <div className="card-value"><CountUp value={data.saldo?.saldo} /></div>
                <div className="card-sub">Conta {data.saldo?.conta}</div>
                <div className="card-rows">
                  <div className="card-row">
                    <span>Titular</span>
                    <span className="strong">{data.saldo?.titular}</span>
                  </div>
                </div>
              </>
            )}
          </TiltCard>

          {/* ---- Card Cartão ---- */}
          <TiltCard className={`card ${cartaoDown ? 'card-danger' : ''}`} variants={item}>
            <div className="card-accent" />
            <div className="card-header">
              <span className="card-label">Cartão de crédito</span>
              {cartaoDown
                ? <span className="cb-badge" translate="no">⚡ fallback</span>
                : <div className="card-icon">▭</div>}
            </div>
            {cartaoDown ? (
              <>
                <div className="card-value unavailable">Indisponível</div>
                <div className="card-sub">{data.cartao?.mensagem}</div>
                <div className="fallback-note">
                  O disjuntor isolou este serviço para proteger o restante do sistema.
                </div>
              </>
            ) : (
              <>
                <div className="card-value"><CountUp value={data.cartao?.fatura_atual} /></div>
                <div className="card-sub">Fatura atual</div>
                <div className="card-rows">
                  <div className="card-row"><span>Limite</span><span className="strong">{brl(data.cartao?.limite)}</span></div>
                  <div className="card-row"><span>Vencimento</span><span className="strong">{data.cartao?.vencimento}</span></div>
                  <div className="card-row"><span>Titular</span><span className="strong">{data.cartao?.titular}</span></div>
                </div>
              </>
            )}
          </TiltCard>

          {/* ---- Card Investimentos ---- */}
          <TiltCard className={`card ${investimentosDown ? 'card-danger' : ''}`} variants={item}>
            <div className="card-accent" />
            <div className="card-header">
              <span className="card-label">Investimentos</span>
              {investimentosDown
                ? <span className="cb-badge" translate="no">⚡ fallback</span>
                : <div className="card-icon">↗</div>}
            </div>
            {investimentosDown ? (
              <>
                <div className="card-value unavailable">Indisponível</div>
                <div className="card-sub">{data.investimentos?.mensagem}</div>
                <div className="fallback-note">
                  O disjuntor isolou este serviço para proteger o restante do sistema.
                </div>
              </>
            ) : (
              <>
                <div className="card-value"><CountUp value={data.investimentos?.total_investido} /></div>
                <div className="card-sub">Total investido</div>
                <div className="card-rows">
                  <div className="card-row"><span>Tesouro Direto</span><span className="strong">{brl(data.investimentos?.tesouro_direto)}</span></div>
                  <div className="card-row"><span>Ações</span><span className="strong">{brl(data.investimentos?.acoes)}</span></div>
                  <div className="card-row"><span>Titular</span><span className="strong">{data.investimentos?.titular}</span></div>
                </div>
              </>
            )}
          </TiltCard>

        </motion.div>
      )}

      {data && !loading && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
          className="hint">
          💡 Quer ver a resiliência em ação? Derrube qualquer serviço Java no IntelliJ e clique em Atualizar.
        </motion.div>
      )}

    </div>
  )
}
