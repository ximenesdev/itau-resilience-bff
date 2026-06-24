import { useReducedMotion } from 'framer-motion'

// ============================================================================
// DIAGRAMA DE ARQUITETURA ANIMADO
// ============================================================================
// Não é enfeite: este diagrama MOSTRA o padrão BFF agindo. As requisições "fluem"
// do Frontend para o BFF e, a partir dele, abrem em LEQUE para os três
// microsserviços em PARALELO — que é o que o backend faz (CompletableFuture).
// No BFF mora o Circuit Breaker: é ele que isola um ramo que falha.
//
// Tipografia em unidades do viewBox (o SVG é ampliado ~1,4x ao preencher a coluna,
// então usamos fontes pequenas para o resultado renderizado ficar proporcional).
// Acessibilidade: em prefers-reduced-motion não há movimento (linhas e pontos
// param) — vira um diagrama estático perfeitamente legível.
export default function DiagramaArquitetura() {
  const reduz = useReducedMotion()
  const fluir = reduz ? '' : 'diag-flow'

  // Caminhos do BFF até cada serviço (curvas que abrem em leque).
  const ramos = [
    { id: 'p-saldo', d: 'M140 204 C 116 244, 72 270, 48 300' },
    { id: 'p-cartao', d: 'M140 204 L140 300' },
    { id: 'p-invest', d: 'M140 204 C 164 244, 208 270, 232 300' },
  ]

  return (
    <figure className="diag">
      {/* Cabeçalho do diagrama — ancora o topo do card na mesma linha do texto à
          esquerda (ajuda no alinhamento das duas colunas). */}
      <figcaption className="diag-head mono-label">Fluxo de requisições</figcaption>

      <svg viewBox="0 0 280 360" role="img"
           aria-label="Diagrama: o Frontend chama o BFF, que chama Saldo, Cartão e Investimentos em paralelo. O Circuit Breaker, no BFF, isola serviços com falha.">

        {/* ----- CANOS (estrutura estática, faint) ----- */}
        <g fill="none" stroke="var(--hairline-bright)" strokeWidth="1.5">
          <path d="M140 50 L140 146" />
          {ramos.map(r => <path key={r.id} d={r.d} />)}
        </g>

        {/* ----- FLUXO (tracejado que escorre = dados em trânsito) ----- */}
        <g fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="2 6"
           strokeLinecap="round" opacity="0.75">
          <path className={fluir} d="M140 50 L140 146" />
          {ramos.map(r => (
            <path key={r.id} id={r.id} className={fluir} d={r.d} />
          ))}
        </g>

        {/* ----- PONTOS EM VOO (só com movimento permitido) ----- */}
        {!reduz && ramos.map((r, i) => (
          <circle key={r.id} r="2.6" fill="var(--brand)">
            {/* begin escalonado dá a sensação de leque/fan-out paralelo */}
            <animateMotion dur="1.5s" begin={`${i * 0.45}s`} repeatCount="indefinite">
              <mpath href={`#${r.id}`} />
            </animateMotion>
          </circle>
        ))}

        {/* ===== NÓ: FRONTEND ===== */}
        <g>
          <rect x="82" y="8" width="116" height="42" rx="6"
                fill="var(--ok-glow)" stroke="rgba(88,194,129,0.4)" />
          <text className="diag-tag" x="140" y="22" textAnchor="middle">FRONTEND</text>
          <text className="diag-name" x="140" y="35" textAnchor="middle">React</text>
          <text className="diag-port" x="140" y="45" textAnchor="middle">:5173</text>
        </g>

        {/* ===== NÓ: BFF + CIRCUIT BREAKER (destaque de marca) ===== */}
        <g>
          <rect x="58" y="146" width="164" height="58" rx="6"
                fill="var(--brand-glow)" stroke="rgba(236,112,0,0.5)" />
          <text className="diag-tag" x="140" y="165" textAnchor="middle">ORQUESTRADOR</text>
          <text className="diag-name" x="140" y="180" textAnchor="middle">BFF</text>
          <text className="diag-port" x="140" y="193" textAnchor="middle">Circuit Breaker · :8083</text>
        </g>

        {/* ===== NÓS: SERVIÇOS ===== */}
        <g>
          <rect x="8" y="300" width="80" height="46" rx="6" fill="var(--bg-inset)" stroke="var(--hairline-bright)" />
          <text className="diag-name" x="48" y="324" textAnchor="middle">Saldo</text>
          <text className="diag-port" x="48" y="336" textAnchor="middle">:8080</text>

          <rect x="100" y="300" width="80" height="46" rx="6" fill="var(--bg-inset)" stroke="var(--hairline-bright)" />
          <text className="diag-name" x="140" y="324" textAnchor="middle">Cartão</text>
          <text className="diag-port" x="140" y="336" textAnchor="middle">:8081</text>

          <rect x="192" y="300" width="80" height="46" rx="6" fill="var(--bg-inset)" stroke="var(--hairline-bright)" />
          <text className="diag-name" x="232" y="324" textAnchor="middle">Investim.</text>
          <text className="diag-port" x="232" y="336" textAnchor="middle">:8082</text>
        </g>
      </svg>

      <figcaption className="diag-cap">
        As requisições fluem do app para o <strong>BFF</strong>, que chama os três
        serviços <strong>em paralelo</strong>. Se um falha, o <strong>Circuit Breaker</strong> isola
        apenas aquele ramo e devolve um fallback — os outros continuam respondendo.
      </figcaption>
    </figure>
  )
}
