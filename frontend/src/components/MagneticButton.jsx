import { useRef, useCallback } from 'react'
import { motion, useSpring, useReducedMotion } from 'framer-motion'

const STRENGTH = 0.16
const SPRING = { stiffness: 380, damping: 28, mass: 0.5 }

export default function MagneticButton({ children, className = '', disabled, onClick, style = {}, ...rest }) {
  const ref = useRef(null)
  const shouldReduce = useReducedMotion()
  const x = useSpring(0, SPRING)
  const y = useSpring(0, SPRING)

  const onMove = useCallback((e) => {
    if (shouldReduce || disabled || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * STRENGTH)
    y.set((e.clientY - (r.top + r.height / 2)) * STRENGTH)
  }, [shouldReduce, disabled, x, y])

  const onLeave = useCallback(() => { x.set(0); y.set(0) }, [x, y])

  return (
    <motion.button
      ref={ref}
      className={className}
      style={{ x, y, ...style }}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
