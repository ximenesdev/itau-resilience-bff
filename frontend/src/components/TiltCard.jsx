import { useRef, useCallback } from 'react'
import { motion, useSpring, useTransform, useReducedMotion } from 'framer-motion'

const TILT = 6
const SPRING = { stiffness: 280, damping: 24, mass: 0.5 }

export default function TiltCard({ children, className = '', style = {}, variants }) {
  const ref = useRef(null)
  const shouldReduce = useReducedMotion()

  const mouseX = useSpring(0, SPRING)
  const mouseY = useSpring(0, SPRING)
  const glowX = useSpring(50, SPRING)
  const glowY = useSpring(50, SPRING)

  const rotateX = useTransform(mouseY, y => shouldReduce ? 0 : -y * TILT)
  const rotateY = useTransform(mouseX, x => shouldReduce ? 0 : x * TILT)
  const glowBg = useTransform(
    [glowX, glowY],
    ([x, y]) => `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.15) 0%, transparent 65%)`
  )

  const onMove = useCallback((e) => {
    if (shouldReduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    mouseX.set((e.clientX - r.left) / r.width - 0.5)
    mouseY.set((e.clientY - r.top) / r.height - 0.5)
    glowX.set(((e.clientX - r.left) / r.width) * 100)
    glowY.set(((e.clientY - r.top) / r.height) * 100)
  }, [shouldReduce, mouseX, mouseY, glowX, glowY])

  const onLeave = useCallback(() => {
    mouseX.set(0)
    mouseY.set(0)
    glowX.set(50)
    glowY.set(50)
  }, [mouseX, mouseY, glowX, glowY])

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, ...style }}
      variants={variants}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          zIndex: 2,
          background: glowBg,
        }}
      />
      {children}
    </motion.div>
  )
}
