import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

// ============================================================================
// PAINEL DE RESILIÊNCIA (Modo Demonstração / Fault Injection ao vivo)
// ============================================================================
// Esta tela é o "centro de controle" da demonstração. Ela:
//  - Faz POLLING a cada 1,5s em /resiliencia/circuitos (no BFF) para mostrar o
//    estado de cada circuit breaker em tempo real (CLOSED / OPEN / HALF_OPEN).
//  - Tem botões que INJETAM FALHA em cada serviço (erro 500 ou lentidão), sem
//    reiniciar nada — provocando os fallbacks do BFF ao vivo.
//
// Todo o controle passa pelo BFF (porta 8083). O frontend nunca fala direto
// com os microsserviços — isso é o padrão BFF na prática.

// Quanto tempo entre cada leitura do estado dos circuitos (polling).
const INTERVALO_POLL = 1500

// Metadados de cada serviço (rótulo amigável e descrição curta).
const SERVICOS = [
  { id: 'saldo', nome: 'Saldo', porta: 8080 },
  { id: 'cartao', nome: 'Cartão', porta: 8081 },
  { id: 'investimentos', nome: 'Investimentos', porta: 8082 },
]

// Mapeia o estado do circuito para cor/rótulo. As cores TÊM SIGNIFICADO:
// verde = saudável, âmbar = recuperando, vermelho = isolado.
const ESTADO_INFO = {
  CLOSED:    { rotulo: 'FECHADO',    classe: 'estado-closed',    desc: 'Chamadas passam normalmente' },
  OPEN:      { rotulo: 'ABERTO',     classe: 'estado-open',      desc: 'Circuito isolado — chamadas bloqueadas' },
  HALF_OPEN: { rotulo: 'SEMI-ABERTO', classe: 'estado-halfopen', desc: 'Testando se o serviço se recuperou' },
}

// Traduz o motivo técnico do último fallback para algo legível.
const MOTIVO_LABEL = {
  SERVICO_FORA: 'Serviço fora do ar (HTTP 500)',
  TIMEOUT: 'Tempo de resposta estourado',
  CIRCUITO_ABERTO: 'Bloqueado pelo circuito aberto',
}

export default function Resiliencia() {
  // Estado atual de cada circuito (vindo do polling).
  const [circuitos, setCircuitos] = useState([])
  // Modo de falha ativo em cada serviço (NORMAL / ERRO / LENTIDAO / INDISPONIVEL).
  const [modos, setModos] = useState({})
  // Indica se já conseguimos falar com o BFF ao menos uma vez.
  const [conectado, setConectado] = useState(null)
  // Trava para não disparar dois cliques no mesmo botão ao mesmo tempo.
  const [ocupado, setOcupado] = useState(false)

  // Guarda o id do setInterval para limpar quando a tela sair.
  const pollRef = useRef(null)

  // Busca o estado dos circuitos no BFF.
  const buscarCircuitos = async () => {
    try {
      const res = await axios.get('/resiliencia/circuitos')
      setCircuitos(res.data.circuitos || [])
      setConectado(true)
    } catch {
      setConectado(false)
    }
  }

  // Busca o modo de falha atual de cada serviço (para destacar o botão certo).
  const buscarModos = async () => {
    try {
      const res = await axios.get('/resiliencia/falha/status')
      setModos(res.data || {})
    } catch {
      // Se falhar, deixamos como está — o polling tenta de novo.
    }
  }

  // Liga o polling ao montar a tela e desliga ao sair (evita vazamento).
  useEffect(() => {
    buscarCircuitos()
    buscarModos()
    pollRef.current = setInterval(() => {
      buscarCircuitos()
      buscarModos()
    }, INTERVALO_POLL)
    return () => clearInterval(pollRef.current)
  }, [])

  // Envia o comando de falha para o BFF e atualiza a tela na hora.
  const acionar = async (servico, acao) => {
    if (ocupado) return
    setOcupado(true)
    try {
      if (acao === 'normal') {
        await axios.post(`/resiliencia/falha/${servico}/desativar`)
      } else {
        await axios.post(`/resiliencia/falha/${servico}/ativar?modo=${acao}`)
      }
      await buscarModos()
      await buscarCircuitos()
    } catch {
      // Erro tratado silenciosamente; o polling reflete o estado real em seguida.
    } finally {
      setOcupado(false)
    }
  }

  // Estado agregado do sistema (para o cabeçalho).
  const estados = circuitos.map(c => c.estado)
  let statusGlobal = { rotulo: 'SISTEMA OPERACIONAL', classe: 'global-ok' }
  if (estados.includes('OPEN')) {
    statusGlobal = { rotulo: 'FALHA ISOLADA', classe: 'global-fail' }
  } else if (estados.includes('HALF_OPEN')) {
    statusGlobal = { rotulo: 'RECUPERANDO', classe: 'global-recover' }
  }

  return (
    <div className="page">

      <div className="page-head">
        <div>
          <h1 className="page-title">Painel de Resiliência</h1>
          <p className="page-subtitle">
            Injeção de falha controlada — observe o Circuit Breaker reagindo em tempo real
          </p>
        </div>
        <div className={`global-status ${statusGlobal.classe}`}>
          <span className="global-dot" />
          {statusGlobal.rotulo}
        </div>
      </div>

      {/* Aviso de conexão com o BFF */}
      {conectado === false && (
        <div className="painel-aviso erro">
          Sem conexão com o BFF (porta 8083). Verifique se ele está rodando.
        </div>
      )}
      {conectado === null && (
        <div className="painel-aviso">Conectando ao BFF…</div>
      )}

      {/* Legenda dos estados — ajuda a explicar na demo */}
      <div className="legenda">
        <span className="legenda-item"><span className="legenda-cor estado-closed" /> Fechado (saudável)</span>
        <span className="legenda-item"><span className="legenda-cor estado-halfopen" /> Semi-aberto (recuperando)</span>
        <span className="legenda-item"><span className="legenda-cor estado-open" /> Aberto (isolado)</span>
        <span className="legenda-pulse">● ao vivo · atualiza a cada {INTERVALO_POLL / 1000}s</span>
      </div>

      {/* Um card de controle por serviço */}
      <div className="painel-grid">
        {SERVICOS.map(servico => {
          const circuito = circuitos.find(c => c.nome === servico.id) || {}
          const estado = circuito.estado || 'CLOSED'
          const info = ESTADO_INFO[estado] || ESTADO_INFO.CLOSED
          const modoAtivo = modos[servico.id] || 'NORMAL'
          const taxa = circuito.taxaFalha
          const taxaTexto = (taxa === undefined || taxa < 0) ? '—' : `${taxa.toFixed(0)}%`

          return (
            <motion.div
              key={servico.id}
              layout
              className={`painel-card ${info.classe}`}
              animate={{
                // A borda muda de cor quando o circuito troca de estado — comunica
                // o isolamento. Usamos hex (não var CSS) para o framer-motion
                // interpolar a cor suavemente na transição.
                borderColor: estado === 'OPEN' ? '#C0392B'
                  : estado === 'HALF_OPEN' ? '#EC7000'
                  : '#ECE7DF',
              }}
              transition={{ duration: 0.4 }}
            >
              <div className="painel-card-head">
                <div>
                  <div className="painel-card-nome">{servico.nome}</div>
                  <div className="painel-card-porta">localhost:{servico.porta}</div>
                </div>
                {/* Selo do estado, animado na troca */}
                <AnimatePresence mode="wait">
                  <motion.span
                    key={estado}
                    className={`estado-badge ${info.classe}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.25 }}
                  >
                    {info.rotulo}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="painel-card-desc">{info.desc}</div>

              {/* Métricas do circuito */}
              <div className="metricas">
                <div className="metrica">
                  <span className="metrica-valor">{taxaTexto}</span>
                  <span className="metrica-rotulo">Taxa de falha</span>
                </div>
                <div className="metrica">
                  <span className="metrica-valor">{circuito.chamadasNaJanela ?? 0}</span>
                  <span className="metrica-rotulo">Chamadas na janela</span>
                </div>
                <div className="metrica">
                  <span className="metrica-valor">{circuito.chamadasComFalha ?? 0}</span>
                  <span className="metrica-rotulo">Com falha</span>
                </div>
              </div>

              {/* Último motivo de fallback */}
              <div className="ultimo-motivo">
                <span className="ultimo-motivo-rotulo">Último fallback:</span>
                <span className="ultimo-motivo-valor">
                  {circuito.ultimoMotivo
                    ? (MOTIVO_LABEL[circuito.ultimoMotivo] || circuito.ultimoMotivo)
                    : 'nenhum ainda'}
                </span>
              </div>

              {/* Controles de injeção de falha */}
              <div className="controles">
                <button
                  className={`ctrl-btn ${modoAtivo === 'NORMAL' ? 'ativo normal' : ''}`}
                  onClick={() => acionar(servico.id, 'normal')}
                  disabled={ocupado}
                >
                  Normal
                </button>
                <button
                  className={`ctrl-btn ${modoAtivo === 'ERRO' ? 'ativo erro' : ''}`}
                  onClick={() => acionar(servico.id, 'erro')}
                  disabled={ocupado}
                >
                  Erro 500
                </button>
                <button
                  className={`ctrl-btn ${modoAtivo === 'LENTIDAO' ? 'ativo lentidao' : ''}`}
                  onClick={() => acionar(servico.id, 'lentidao')}
                  disabled={ocupado}
                >
                  Lentidão
                </button>
              </div>

              {modoAtivo === 'INDISPONIVEL' && (
                <div className="painel-aviso erro pequeno">
                  Processo deste serviço parece estar parado.
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="painel-dica">
        Dica de demonstração: ative <strong>Erro 500</strong> em um serviço e clique algumas
        vezes em <strong>Atualizar</strong> no Painel principal. Após 5 falhas, o circuito
        <strong> abre</strong> e o motivo muda de <code>SERVICO_FORA</code> para
        <code> CIRCUITO_ABERTO</code>. Espere ~10s para ver o estado <strong>SEMI-ABERTO</strong>.
      </div>

    </div>
  )
}
