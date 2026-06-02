import { motion, useReducedMotion } from 'framer-motion'

export default function Reveal({ children, delay = 0, y = 24, blur = false }) {
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: shouldReduce ? 0 : y,
        filter: (!shouldReduce && blur) ? 'blur(5px)' : 'blur(0px)',
      }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: shouldReduce ? 0.1 : 0.6,
        delay: shouldReduce ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
