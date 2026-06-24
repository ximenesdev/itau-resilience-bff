import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, useInView } from 'framer-motion'
import { brl } from '../data.js'

// Anima um número até o valor, contando suavemente.
// - Na 1ª vez que entra em tela: conta de 0 até o valor.
// - Quando o valor MUDA depois (ex.: após um "Atualizar"): conta do valor antigo
//   até o novo — vira um feedback gostoso de que o dado foi atualizado.
// Em "prefers-reduced-motion", mostra o valor final direto, sem animar.
//
// PORQUÊ desta reescrita: a versão antiga usava uma trava `running` que só deixava
// animar UMA vez. Efeito colateral: se o valor mudasse depois, o número ficava
// CONGELADO no valor antigo (bug latente). Agora guardamos de onde partir (`fromRef`)
// e animamos sempre que o destino muda.
export default function CountUp({ value, duration = 950 }) {
  const ref = useRef(null)
  const shouldReduce = useReducedMotion()
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)   // valor de onde a próxima animação parte
  const rafRef = useRef(0)    // id do requestAnimationFrame em curso (p/ cancelar)
  const safeValue = value ?? 0

  useEffect(() => {
    // Espera entrar em tela. Movimento reduzido é tratado na renderização.
    if (shouldReduce || !inView) return
    const from = fromRef.current
    const delta = safeValue - from
    if (delta === 0) return // nada mudou, não anima à toa

    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4) // ease-out-quart (rápido no início)
      setDisplay(from + delta * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else { setDisplay(safeValue); fromRef.current = safeValue }
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [inView, safeValue, duration, shouldReduce])

  return <span ref={ref}>{brl(shouldReduce ? safeValue : display)}</span>
}
