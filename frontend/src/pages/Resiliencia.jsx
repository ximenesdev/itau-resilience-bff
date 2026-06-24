import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// ============================================================================
// PAINEL DE RESILIÊNCIA (Modo Demonstração / Fault Injection ao vivo)
// ============================================================================
// Console de operações ao vivo. Faz POLLING a cada 1,5s em /resiliencia/circuitos
// (no BFF) para mostrar o estado de cada circuit breaker em tempo real, e tem
// botões que INJETAM FALHA em cada serviço — provocando os fallbacks ao vivo.
// Todo o controle passa pelo BFF (porta 8083): o frontend nunca fala direto com
// os microsserviços. Isso é o padrão BFF na prática.

const INTERVALO_POLL = 1500

const SERVICOS = [
  { id: 'saldo', nome: 'Saldo', porta: 8080 },
  { id: 'cartao', nome: 'Cartão', porta: 8081 },
  { id: 'investimentos', nome: 'Investimentos', porta: 8082 },
]

// Estado do circuito -> classe/rótulo. As cores TÊM SIGNIFICADO.
const ESTADO_INFO = {
  CLOSED:    { rotulo: 'CLOSED',    classe: 'estado-closed',   desc: 'Chamadas passam normalmente' },
  OPEN:      { rotulo: 'OPEN',      classe: 'estado-open',     desc: 'Circuito isolado — chamadas bloqueadas' },
  HALF_OPEN: { rotulo: 'HALF-OPEN', classe: 'estado-halfopen', desc: 'Testando se o serviço se recuperou' },
}
const infoDe = (e) => ESTADO_INFO[e] || ESTADO_INFO.CLOSED

const MOTIVO_LABEL = {
  SERVICO_FORA: 'Serviço fora do ar (HTTP 500)',
  TIMEOUT: 'Tempo de resposta estourado',
  CIRCUITO_ABERTO: 'Bloqueado pelo circuito aberto',
}

export default function Resiliencia() {
  const [circuitos, setCircuitos] = useState([])
  const [modos, setModos] = useState({})
  const [conectado, setConectado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [eventos, setEventos] = useState([])
  const pollRef = useRef(null)
  const prevStates = useRef({})

  const buscarCircuitos = async () => {
    try {
      const res = await axios.get('/resiliencia/circuitos')
      const lista = res.data.circuitos || []
      setCircuitos(lista)
      setConectado(true)

      // Detecta TRANSIÇÕES de estado e registra no feed (estilo log de NOC).
      const hora = new Date().toLocaleTimeString('pt-BR', { hour12: false })
      const novos = []
      lista.forEach(c => {
        if (prevStates.current[c.nome] && prevStates.current[c.nome] !== c.estado) {
          novos.push({ id: `${c.nome}-${Date.now()}`, hora, svc: c.nome, estado: c.estado })
        }
        prevStates.current[c.nome] = c.estado
      })
      if (novos.length) setEventos(ev => [...novos, ...ev].slice(0, 14))
    } catch {
      setConectado(false)
    }
  }

  const buscarModos = async () => {
    try {
      const res = await axios.get('/resiliencia/falha/status')
      setModos(res.data || {})
    } catch { /* o polling tenta de novo */ }
  }

  useEffect(() => {
    const tick = () => { buscarCircuitos(); buscarModos() }
    // Adia a 1ª leitura para fora do corpo síncrono do efeito (regra do React).
    queueMicrotask(tick)
    pollRef.current = setInterval(tick, INTERVALO_POLL)
    return () => clearInterval(pollRef.current)
  }, [])

  const acionar = async (servico, acao) => {
    if (ocupado) return
    setOcupado(true)
    try {
      if (acao === 'normal') await axios.post(`/resiliencia/falha/${servico}/desativar`)
      else await axios.post(`/resiliencia/falha/${servico}/ativar?modo=${acao}`)
      await buscarModos()
      await buscarCircuitos()
    } catch { /* o polling reflete o estado real em seguida */ }
    finally { setOcupado(false) }
  }

  // Status agregado do sistema.
  const estados = circuitos.map(c => c.estado)
  let sys = { cls: 'sys-ok', rotulo: 'Sistema operacional' }
  if (estados.includes('OPEN')) sys = { cls: 'sys-crit', rotulo: 'Falha isolada' }
  else if (estados.includes('HALF_OPEN')) sys = { cls: 'sys-warn', rotulo: 'Recuperando' }

  return (
    <div className="page">

      <div className="page-head">
        <div>
          <h1 className="page-title">Resiliência</h1>
          <p className="page-subtitle">Injeção de falha controlada · Circuit Breaker em tempo real</p>
        </div>
        <div className="page-head-right">
          {conectado && (
            <div className={`sys-status ${sys.cls}`}><span className="sys-dot" />{sys.rotulo}</div>
          )}
        </div>
      </div>

      {conectado === false && (
        <div className="painel-aviso erro">Sem conexão com o BFF (porta 8083). Verifique se ele está rodando.</div>
      )}
      {conectado === null && <div className="painel-aviso">Conectando ao BFF…</div>}

      {/* Legenda + indicador "ao vivo" */}
      <div className="legenda-bar">
        <span className="legenda-item"><span className="legenda-cor closed" /> Closed · saudável</span>
        <span className="legenda-item"><span className="legenda-cor halfopen" /> Half-open · recuperando</span>
        <span className="legenda-item"><span className="legenda-cor open" /> Open · isolado</span>
        <span className="legenda-pulse"><span className="live-dot" /> ao vivo · {INTERVALO_POLL / 1000}s</span>
      </div>

      {/* Cards de controle por serviço */}
      <div className="painel-grid">
        {SERVICOS.map(servico => {
          const circuito = circuitos.find(c => c.nome === servico.id) || {}
          const info = infoDe(circuito.estado)
          const modoAtivo = modos[servico.id] || 'NORMAL'
          const taxa = circuito.taxaFalha
          const taxaTexto = (taxa === undefined || taxa < 0) ? '—' : `${taxa.toFixed(0)}%`

          // Card sem motion: a cor da borda/faixa/badge é trocada pelo CSS, tudo na
          // MESMA duração e easing (transição coordenada). Tiramos também a prop
          // `layout`, que forçava re-medição do card a cada polling de 1,5s.
          return (
            <div key={servico.id} className={`painel-card ${info.classe}`}>
              <div className="painel-card-head">
                <div>
                  <div className="painel-card-nome">{servico.nome}</div>
                  <div className="painel-card-porta" translate="no">svc-{servico.id} · :{servico.porta}</div>
                </div>
                <span className={`estado-badge ${info.classe}`} translate="no">
                  {/* No half-open: ponto pulsando + "VERIFICANDO…" — mostra que o
                      circuito está testando a recuperação, sem parecer travado. */}
                  {circuito.estado === 'HALF_OPEN'
                    ? (<><span className="badge-dot dot-pulse" />VERIFICANDO<span className="reticencias" /></>)
                    : info.rotulo}
                </span>
              </div>

              <div className="painel-card-desc">{info.desc}</div>

              <div className="metricas">
                <div className="metrica">
                  <span className="metrica-valor" translate="no">{taxaTexto}</span>
                  <span className="metrica-rotulo">Taxa de falha</span>
                </div>
                <div className="metrica">
                  <span className="metrica-valor" translate="no">{circuito.chamadasNaJanela ?? 0}</span>
                  <span className="metrica-rotulo">Janela</span>
                </div>
                <div className="metrica">
                  <span className="metrica-valor" translate="no">{circuito.chamadasComFalha ?? 0}</span>
                  <span className="metrica-rotulo">Com falha</span>
                </div>
              </div>

              <div className="ultimo-motivo">
                <span className="ultimo-motivo-rotulo">Último fallback</span>
                <span className="ultimo-motivo-valor">
                  {circuito.ultimoMotivo ? (MOTIVO_LABEL[circuito.ultimoMotivo] || circuito.ultimoMotivo) : 'nenhum ainda'}
                </span>
              </div>

              <div className="controles">
                <button className={`ctrl-btn ${modoAtivo === 'NORMAL' ? 'ativo normal' : ''}`} onClick={() => acionar(servico.id, 'normal')} disabled={ocupado}>Normal</button>
                <button className={`ctrl-btn ${modoAtivo === 'ERRO' ? 'ativo erro' : ''}`} onClick={() => acionar(servico.id, 'erro')} disabled={ocupado}>Erro 500</button>
                <button className={`ctrl-btn ${modoAtivo === 'LENTIDAO' ? 'ativo lentidao' : ''}`} onClick={() => acionar(servico.id, 'lentidao')} disabled={ocupado}>Lentidão</button>
              </div>

              {modoAtivo === 'INDISPONIVEL' && (
                <div className="painel-aviso erro pequeno">Processo deste serviço parece estar parado.</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Feed de eventos ao vivo */}
      {eventos.length > 0 && (
        <div className="rail-card" style={{ marginBottom: '1.5rem' }}>
          <div className="rail-card-head">Registro de transições</div>
          <div className="feed">
            {eventos.map(ev => {
              const info = infoDe(ev.estado)
              return (
                <div className="feed-line" key={ev.id}>
                  <span className="feed-time" translate="no">{ev.hora}</span>
                  <span className="feed-svc" translate="no">{ev.svc}</span>
                  <span className={`feed-state ${info.classe.replace('estado-', '')}`} translate="no">{info.rotulo}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="painel-dica">
        Roteiro: ative <strong>Erro 500</strong> em um serviço e clique algumas vezes em
        <strong> Atualizar</strong> no Painel. Após 5 falhas, o circuito <strong>abre</strong> e o
        motivo muda de <code>SERVICO_FORA</code> para <code>CIRCUITO_ABERTO</code>. Espere ~10s
        para ver o estado <strong>HALF-OPEN</strong>.
      </div>

    </div>
  )
}
