import { motion, useReducedMotion } from 'framer-motion'

const word = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  show: (i) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, delay: 0.08 + i * 0.09, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function WordReveal({ children, className = '', tag: Tag = 'h1' }) {
  const shouldReduce = useReducedMotion()
  const words = String(children).split(' ')

  if (shouldReduce) return <Tag className={className}>{children}</Tag>

  return (
    <Tag className={className} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em', lineHeight: 1.05 }}>
      {words.map((w, i) => (
        <motion.span key={i} custom={i} variants={word} initial="hidden" animate="show" style={{ display: 'inline-block' }}>
          {w}
        </motion.span>
      ))}
    </Tag>
  )
}
