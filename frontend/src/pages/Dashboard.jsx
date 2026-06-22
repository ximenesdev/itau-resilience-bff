import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { brl } from '../data.js'
import CountUp from '../components/CountUp.jsx'
import MagneticButton from '../components/MagneticButton.jsx'

// Metadados de cada serviço (rótulo do cliente + identidade técnica).
const SERVICOS = [
  { id: 'saldo', porta: 8080, nome: 'Conta corrente', svc: 'svc-saldo' },
  { id: 'cartao', porta: 8081, nome: 'Cartão de crédito', svc: 'svc-cartao' },
  { id: 'investimentos', porta: 8082, nome: 'Investimentos', svc: 'svc-investimentos' },
]

// Traduz o estado do circuito (Resilience4j) para classe/rótulo de UI.
const ESTADO = {
  CLOSED:    { cls: 'closed',   rotulo: 'CLOSED' },
  HALF_OPEN: { cls: 'halfopen', rotulo: 'HALF-OPEN' },
  OPEN:      { cls: 'open',     rotulo: 'OPEN' },
}
const estadoDe = (e) => ESTADO[e] || ESTADO.CLOSED

const MOTIVO_LABEL = {
  SERVICO_FORA: 'Serviço fora (HTTP 500)',
  TIMEOUT: 'Tempo de resposta estourado',
  CIRCUITO_ABERTO: 'Bloqueado pelo circuito aberto',
}

export default function Dashboard() {
  const [data, setData] = useState(null)        // resposta do /dashboard (dados financeiros)
  const [circuitos, setCircuitos] = useState({}) // estado dos circuitos por nome
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [eventos, setEventos] = useState([])    // log de transições para o feed
  const prevStates = useRef({})                  // estados anteriores (detectar transição)

  const buscar = async () => {
    setLoading(true)
    setError(false)
    try {
      // Busca os dados do cliente E o estado dos circuitos ao mesmo tempo.
      const [dash, circ] = await Promise.all([
        axios.get('/dashboard'),
        axios.get('/resiliencia/circuitos'),
      ])
      setData(dash.data)

      // Indexa os circuitos por nome para acesso rápido.
      const porNome = {}
      ;(circ.data.circuitos || []).forEach(c => { porNome[c.nome] = c })
      setCircuitos(porNome)

      // Registra no feed apenas as TRANSIÇÕES de estado (não polui a cada refresh).
      const hora = new Date().toLocaleTimeString('pt-BR', { hour12: false })
      const novos = []
      SERVICOS.forEach(s => {
        const estado = porNome[s.id]?.estado || 'CLOSED'
        if (prevStates.current[s.id] && prevStates.current[s.id] !== estado) {
          novos.push({ id: `${s.id}-${Date.now()}`, hora, svc: s.id, estado })
        }
        prevStates.current[s.id] = estado
      })
      if (novos.length) setEventos(ev => [...novos, ...ev].slice(0, 12))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Adia a 1ª busca para fora do corpo síncrono do efeito — evita o aviso do
    // React sobre setState síncrono em efeito (e re-render em cascata).
    queueMicrotask(buscar)
  }, [])

  // Quantos serviços estão operacionais (estado CLOSED e status ok).
  const estados = SERVICOS.map(s => circuitos[s.id]?.estado || 'CLOSED')
  const operacionais = estados.filter(e => e === 'CLOSED').length
  const algumOpen = estados.includes('OPEN')
  const algumHalf = estados.includes('HALF_OPEN')

  let sys = { cls: 'sys-ok', rotulo: 'Sistema operacional' }
  if (algumOpen) sys = { cls: 'sys-crit', rotulo: 'Falha isolada' }
  else if (algumHalf) sys = { cls: 'sys-warn', rotulo: 'Recuperando' }

  return (
    <div className="page">

      <div className="page-head">
        <div>
          <h1 className="page-title">Painel</h1>
          <p className="page-subtitle">Centro de operações · visão do cliente</p>
        </div>
        <div className="page-head-right">
          {data && (
            <div className={`sys-status ${sys.cls}`}>
              <span className="sys-dot" />
              {sys.rotulo}
            </div>
          )}
          <MagneticButton className="btn-refresh" onClick={buscar} disabled={loading} translate="no">
            <span className={loading ? 'spin-icon' : 'refresh-icon'}>↻</span> Atualizar
          </MagneticButton>
        </div>
      </div>

      {error && (
        <div className="error-state">
          <div className="error-icon">!</div>
          <p className="error-title">Não foi possível conectar ao servidor</p>
          <p className="error-sub">Verifique se o <span translate="no">BFF</span> está rodando na porta 8083</p>
          <MagneticButton className="btn-refresh" onClick={buscar} translate="no">Tentar novamente</MagneticButton>
        </div>
      )}

      {!error && (
        <div className="ops-grid">

          {/* ===== TRILHO DE STATUS (esquerda) ===== */}
          <aside className="rail">
            <section className="rail-card">
              <div className="rail-card-head">Saúde do sistema</div>
              <div className="rail-health">
                <span className="rail-health-num" translate="no">{operacionais}/3</span>
                <span className="rail-health-lbl">serviços operacionais</span>
              </div>
              <ul className="rail-svc-list">
                {SERVICOS.map(s => {
                  const est = estadoDe(circuitos[s.id]?.estado)
                  return (
                    <li className="rail-svc" key={s.id}>
                      <span className={`dot ${est.cls}`} />
                      <span className="rail-svc-name" translate="no">{s.id}</span>
                      <span className={`rail-svc-state ${est.cls}`} translate="no">{est.rotulo}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="rail-card">
              <div className="rail-card-head">Registro de eventos</div>
              <div className="feed">
                {eventos.length === 0 ? (
                  <div className="feed-empty">Nenhuma transição registrada nesta sessão.</div>
                ) : eventos.map(ev => {
                  const est = estadoDe(ev.estado)
                  return (
                    <div className="feed-line" key={ev.id}>
                      <span className="feed-time" translate="no">{ev.hora}</span>
                      <span className="feed-svc" translate="no">{ev.svc}</span>
                      <span className={`feed-state ${est.cls}`} translate="no">{est.rotulo}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rail-card">
              <div className="rail-card-head">Legenda</div>
              <div className="legenda">
                <span className="legenda-item"><span className="legenda-cor closed" /> Closed · saudável</span>
                <span className="legenda-item"><span className="legenda-cor halfopen" /> Half-open · recuperando</span>
                <span className="legenda-item"><span className="legenda-cor open" /> Open · isolado</span>
              </div>
            </section>
          </aside>

          {/* ===== TILES DE SERVIÇO (direita) ===== */}
          <div className="tiles">
            {loading && !data ? (
              <>
                <div className="skeleton-tile" />
                <div className="tiles-row"><div className="skeleton-tile" /><div className="skeleton-tile" /></div>
              </>
            ) : data && (
              <>
                <Tile
                  meta={SERVICOS[0]} dado={data.saldo} circuito={circuitos.saldo} hero
                  valor={data.saldo?.saldo}
                  rows={[['Titular', data.saldo?.titular], ['Conta', data.saldo?.conta]]}
                  valorLabel="Saldo disponível"
                />
                <div className="tiles-row">
                  <Tile
                    meta={SERVICOS[1]} dado={data.cartao} circuito={circuitos.cartao}
                    valor={data.cartao?.fatura_atual}
                    rows={[['Limite', brl(data.cartao?.limite)], ['Vencimento', data.cartao?.vencimento]]}
                    valorLabel="Fatura atual"
                  />
                  <Tile
                    meta={SERVICOS[2]} dado={data.investimentos} circuito={circuitos.investimentos}
                    valor={data.investimentos?.total_investido}
                    rows={[['Tesouro Direto', brl(data.investimentos?.tesouro_direto)], ['Ações', brl(data.investimentos?.acoes)]]}
                    valorLabel="Total investido"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {data && (
        <div className="hint">
          Quer ver a resiliência agir? Vá em <strong>Resiliência</strong>, injete uma falha
          em um serviço e volte aqui para <strong>Atualizar</strong>. O circuito reage em tempo real.
        </div>
      )}
    </div>
  )
}

// ---- Tile de um serviço ----
function Tile({ meta, dado, circuito, valor, rows, valorLabel, hero }) {
  const down = dado?.status === 'CIRCUIT BREAKER ATIVO'
  const est = estadoDe(circuito?.estado)
  const taxa = circuito?.taxaFalha
  const taxaTxt = (taxa === undefined || taxa < 0) ? '—' : `${taxa.toFixed(0)}%`
  const janela = circuito?.chamadasNaJanela ?? 0

  return (
    <motion.article
      layout
      className={`tile estado-${est.cls} ${hero ? 'tile-hero' : ''} ${down ? 'fallback' : ''}`}
      animate={{ borderColor: circuito?.estado === 'OPEN' ? '#E5544B' : circuito?.estado === 'HALF_OPEN' ? '#E9A93C' : '#2A241F' }}
      transition={{ duration: 0.4 }}
    >
      {down && circuito?.estado === 'OPEN' && (
        <>
          <span className="tile-stamp" translate="no">ISOLADO</span>
          <motion.span className="tile-cut" initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: [0, 1, 0.4], scaleX: 1 }} transition={{ duration: 0.6 }} />
        </>
      )}

      <div className="tile-meta">
        <span className="tile-name">{meta.nome}</span>
        {/* Quando isolado, o carimbo ISOLADO no canto já indica o estado —
            escondemos o selo pequeno para os dois não se sobreporem. */}
        {!(down && circuito?.estado === 'OPEN') && (
          <span className={`tile-state ${est.cls}`} translate="no">
            <span className="st-dot" />{est.rotulo}
          </span>
        )}
      </div>

      <div className="tile-tech" translate="no">
        <span>{meta.svc}</span><span className="sep">·</span>
        <span>:{meta.porta}</span><span className="sep">·</span>
        <span>falha {taxaTxt}</span><span className="sep">·</span>
        <span>janela {janela}/10</span>
      </div>

      {down ? (
        <>
          <div className="tile-value">Indisponível</div>
          <div className="tile-fallback-msg">{dado?.mensagem}</div>
          <div className="tile-fallback-note" translate="no">
            Motivo: {MOTIVO_LABEL[dado?.motivo] || dado?.motivo}. O disjuntor isolou este
            serviço para proteger o restante do sistema.
          </div>
        </>
      ) : (
        <>
          <div className="tile-value"><CountUp value={valor} /></div>
          <div className="tile-value-label">{valorLabel}</div>
          <div className="tile-rows">
            {rows.map(([k, v]) => (
              <div className="tile-row" key={k}><span>{k}</span><span className="v">{v}</span></div>
            ))}
          </div>
        </>
      )}
    </motion.article>
  )
}
