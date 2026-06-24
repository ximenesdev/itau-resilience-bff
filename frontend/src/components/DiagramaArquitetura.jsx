import { useReducedMotion } from 'framer-motion'

// ============================================================================
// DIAGRAMA DE ARQUITETURA ANIMADO
// ============================================================================
// Não é enfeite: este diagrama MOSTRA o padrão BFF agindo. As requisições "fluem"
// do Frontend para o BFF e, a partir dele, abrem em LEQUE para os três
// microsserviços em PARALELO — que é exatamente o que o backend faz (CompletableFuture).
// No BFF mora o Circuit Breaker: é ele que isola um ramo que falha, mantendo o resto.
//
// Como é desenhado:
// - Linhas SÓLIDAS faint = os "canos" entre os serviços (estrutura).
// - Linhas TRACEJADAS que escorrem (stroke-dashoffset via CSS) = dados em trânsito.
// - Pontos que viajam pelos caminhos (SMIL <animateMotion>) = requisições em voo,
//   com pequenos atrasos entre si para dar a sensação de fan-out paralelo.
//
// Performance: anima só posição de tracejado e deslocamento dos pontos (barato).
// Acessibilidade: em prefers-reduced-motion não há movimento — vira um diagrama
// estático perfeitamente legível (os pontos viajantes nem são renderizados).
export default function DiagramaArquitetura() {
  const reduz = useReducedMotion()
  const fluir = reduz ? '' : 'diag-flow' // classe que liga a animação do tracejado

  // Caminhos do BFF até cada serviço (curvas que abrem em leque).
  const ramos = [
    { id: 'p-saldo', d: 'M140 210 C 116 250, 70 280, 47 322' },
    { id: 'p-cartao', d: 'M140 210 L140 322' },
    { id: 'p-invest', d: 'M140 210 C 164 250, 210 280, 233 322' },
  ]

  return (
    <figure className="diag">
      <svg viewBox="0 0 280 392" role="img"
           aria-label="Diagrama: o Frontend chama o BFF, que chama Saldo, Cartão e Investimentos em paralelo. O Circuit Breaker, no BFF, isola serviços com falha.">

        {/* ----- CANOS (estrutura estática, faint) ----- */}
        <g fill="none" stroke="var(--hairline-bright)" strokeWidth="1.5">
          <path d="M140 56 L140 150" />
          {ramos.map(r => <path key={r.id} d={r.d} />)}
        </g>

        {/* ----- FLUXO (tracejado que escorre = dados em trânsito) ----- */}
        <g fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="2 6"
           strokeLinecap="round" opacity="0.75">
          <path className={fluir} d="M140 56 L140 150" />
          {ramos.map(r => (
            // ids para os pontos viajantes referenciarem o mesmo caminho
            <path key={r.id} id={r.id} className={fluir} d={r.d} />
          ))}
        </g>

        {/* ----- PONTOS EM VOO (só com movimento permitido) ----- */}
        {!reduz && ramos.map((r, i) => (
          <circle key={r.id} r="3" fill="var(--brand)">
            {/* begin escalonado: 0s, 0.45s, 0.9s — dá o efeito de leque paralelo */}
            <animateMotion dur="1.5s" begin={`${i * 0.45}s`} repeatCount="indefinite">
              <mpath href={`#${r.id}`} />
            </animateMotion>
          </circle>
        ))}

        {/* ===== NÓ: FRONTEND ===== */}
        <g>
          <rect x="80" y="12" width="120" height="44" rx="6"
                fill="var(--ok-glow)" stroke="rgba(88,194,129,0.4)" />
          <text className="diag-tag" x="140" y="28" textAnchor="middle">FRONTEND</text>
          <text className="diag-name" x="140" y="42" textAnchor="middle">React</text>
          <text className="diag-port" x="140" y="52" textAnchor="middle">:5173</text>
        </g>

        {/* ===== NÓ: BFF + CIRCUIT BREAKER (destaque de marca) ===== */}
        <g>
          <rect x="62" y="150" width="156" height="60" rx="6"
                fill="var(--brand-glow)" stroke="rgba(236,112,0,0.5)" />
          <text className="diag-tag" x="140" y="168" textAnchor="middle">ORQUESTRADOR · CIRCUIT BREAKER</text>
          <text className="diag-name" x="140" y="184" textAnchor="middle">BFF</text>
          <text className="diag-port" x="140" y="198" textAnchor="middle">:8083 · chama os 3 em paralelo</text>
        </g>

        {/* ===== NÓS: SERVIÇOS ===== */}
        <g>
          <rect x="6" y="322" width="82" height="46" rx="6" fill="var(--bg-inset)" stroke="var(--hairline-bright)" />
          <text className="diag-name" x="47" y="346" textAnchor="middle">Saldo</text>
          <text className="diag-port" x="47" y="358" textAnchor="middle">:8080</text>

          <rect x="99" y="322" width="82" height="46" rx="6" fill="var(--bg-inset)" stroke="var(--hairline-bright)" />
          <text className="diag-name" x="140" y="346" textAnchor="middle">Cartão</text>
          <text className="diag-port" x="140" y="358" textAnchor="middle">:8081</text>

          <rect x="192" y="322" width="82" height="46" rx="6" fill="var(--bg-inset)" stroke="var(--hairline-bright)" />
          <text className="diag-name" x="233" y="343" textAnchor="middle">Investim.</text>
          <text className="diag-port" x="233" y="358" textAnchor="middle">:8082</text>
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
