import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, useInView } from 'framer-motion'
import { brl } from '../data.js'

// Anima um número contando de 0 até o valor quando entra em tela.
// Em "prefers-reduced-motion", mostra o valor final direto, sem animar.
export default function CountUp({ value, duration = 950 }) {
  const ref = useRef(null)
  const shouldReduce = useReducedMotion()
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const [display, setDisplay] = useState(0)
  const running = useRef(false)
  const safeValue = value ?? 0

  useEffect(() => {
    // Não anima quando movimento é reduzido, fora de tela, ou já animou.
    // (O caso de movimento reduzido é resolvido na renderização, abaixo, para
    // não chamar setState de forma síncrona dentro do efeito.)
    if (shouldReduce || !inView || running.current) return
    running.current = true
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4) // ease-out-quart
      setDisplay(safeValue * eased)
      if (p < 1) requestAnimationFrame(tick)
      else setDisplay(safeValue)
    }
    requestAnimationFrame(tick)
  }, [inView, safeValue, duration, shouldReduce])

  return <span ref={ref}>{brl(shouldReduce ? safeValue : display)}</span>
}
