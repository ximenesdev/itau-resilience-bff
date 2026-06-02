import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Lenis from 'lenis'
import Dashboard from './pages/Dashboard.jsx'
import Extrato from './pages/Extrato.jsx'
import Sobre from './pages/Sobre.jsx'

export default function App() {
  const location = useLocation()
  const shouldReduce = useReducedMotion()
  const [menuOpen, setMenuOpen] = useState(false)

  // Fecha o menu ao trocar de rota
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Scroll suave com Lenis
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])

  return (
    <div className="shell">

      {/* ===== NAVBAR ===== */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <div className="brand-mark"><span translate="no">itaú</span></div>
            <span className="brand-text">resiliência</span>
          </div>

          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Painel</NavLink>
            <NavLink to="/extrato" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Extrato</NavLink>
            <NavLink to="/sobre" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Sobre o projeto</NavLink>
          </div>

          <div className="nav-user">
            <span className="nav-user-name">Bruno Ximenes</span>
            <div className="avatar">BX</div>
          </div>

          {/* Hambúrguer — só visível no mobile */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            <span className={`ham-line ${menuOpen ? 'open' : ''}`} />
            <span className={`ham-line ${menuOpen ? 'open' : ''}`} />
            <span className={`ham-line ${menuOpen ? 'open' : ''}`} />
          </button>
        </div>

        {/* Menu mobile (dropdown animado) */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="nav-mobile"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-mobile-link active' : 'nav-mobile-link'}>Painel</NavLink>
              <NavLink to="/extrato" className={({ isActive }) => isActive ? 'nav-mobile-link active' : 'nav-mobile-link'}>Extrato</NavLink>
              <NavLink to="/sobre" className={({ isActive }) => isActive ? 'nav-mobile-link active' : 'nav-mobile-link'}>Sobre o projeto</NavLink>
              <div className="nav-mobile-user">
                <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>BX</div>
                <span>Bruno Ximenes</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ===== TELAS COM TRANSIÇÃO ===== */}
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: shouldReduce ? 0 : 14, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: shouldReduce ? 0 : -8, filter: 'blur(3px)' }}
            transition={{ duration: shouldReduce ? 0.1 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/extrato" element={<Extrato />} />
              <Route path="/sobre" element={<Sobre />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ===== RODAPÉ ===== */}
      <footer className="footer">
        <span>Projeto de portfólio — Bruno Ximenes</span>
        <div className="tech-stack" translate="no">
          <span className="tech-tag">React</span>
          <span className="tech-tag">Spring Boot</span>
          <span className="tech-tag">Circuit Breaker</span>
          <span className="tech-tag">BFF Pattern</span>
        </div>
      </footer>

    </div>
  )
}
