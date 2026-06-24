import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion'
import Dashboard from './pages/Dashboard.jsx'
import Resiliencia from './pages/Resiliencia.jsx'
import Extrato from './pages/Extrato.jsx'
import Sobre from './pages/Sobre.jsx'

// Barra de progresso de scroll (fina, laranja de marca).
function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 })
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />
}

// Relógio ao vivo — toque de "centro de operações". Mostra hora local + fuso.
function RelogioOps() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hora = agora.toLocaleTimeString('pt-BR', { hour12: false })
  // Offset do fuso em formato -03 (estilo terminal financeiro)
  const off = -agora.getTimezoneOffset() / 60
  const fuso = `${off >= 0 ? '+' : '-'}${String(Math.abs(off)).padStart(2, '0')}`
  return (
    <div className="nav-clock" translate="no">
      <span className="live-dot" />
      {hora} <span style={{ color: 'var(--text-faint)' }}>{fuso}</span>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const fecharMenu = () => setMenuOpen(false)

  // REMOVIDO: o Lenis (scroll suave estilo landing page). Num painel de operações
  // ele atrapalhava — rodava um requestAnimationFrame infinito e, junto com o blur
  // da barra, deixava o scroll "borrachudo" e travado. Voltamos ao scroll nativo,
  // que é instantâneo e roda fora da thread principal.

  const linkClass = ({ isActive }) => isActive ? 'nav-link active' : 'nav-link'
  const mobileClass = ({ isActive }) => isActive ? 'nav-mobile-link active' : 'nav-mobile-link'

  return (
    <>
      <ScrollProgress />

      <div className="shell">

        {/* ===== BARRA DE OPERAÇÕES ===== */}
        <nav className="nav">
          <div className="nav-inner">
            <div className="brand">
              <div className="brand-mark"><span translate="no">it</span></div>
              <span className="brand-text" translate="no"><b>itaú</b> resilience ops</span>
            </div>

            <div className="nav-links">
              <NavLink to="/" end className={linkClass}>Painel</NavLink>
              <NavLink to="/resiliencia" className={linkClass}>Resiliência</NavLink>
              <NavLink to="/extrato" className={linkClass}>Extrato</NavLink>
              <NavLink to="/sobre" className={linkClass}>Sobre</NavLink>
            </div>

            <RelogioOps />

            <div className="nav-user">
              <div className="avatar">BX</div>
            </div>

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

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="nav-mobile"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <NavLink to="/" end onClick={fecharMenu} className={mobileClass}>Painel</NavLink>
                <NavLink to="/resiliencia" onClick={fecharMenu} className={mobileClass}>Resiliência</NavLink>
                <NavLink to="/extrato" onClick={fecharMenu} className={mobileClass}>Extrato</NavLink>
                <NavLink to="/sobre" onClick={fecharMenu} className={mobileClass}>Sobre</NavLink>
                <div className="nav-mobile-user">
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>BX</div>
                  <span>Bruno Ximenes</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* ===== TELAS COM TRANSIÇÃO ENTRE PÁGINAS =====
            ANTES: AnimatePresence mode="wait" — ele ESPERAVA a página atual sair
            (~200ms de tela VAZIA) antes de montar a nova. Era a principal causa da
            sensação de "não flui" ao trocar de aba.
            AGORA: a nova página entra IMEDIATAMENTE com um fade rápido (CSS, ~180ms).
            O segredo é a `key={pathname}`: ao mudar de rota, o React troca a <div>,
            e o CSS toca a animação de entrada. Sem espera, sem buraco. Anima só
            opacity/transform (barato, roda na GPU). */}
        <main className="main">
          <div className="page-swap" key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/resiliencia" element={<Resiliencia />} />
              <Route path="/extrato" element={<Extrato />} />
              <Route path="/sobre" element={<Sobre />} />
            </Routes>
          </div>
        </main>

        {/* ===== RODAPÉ ===== */}
        <footer className="footer">
          <span>Projeto de portfólio · Bruno Ximenes</span>
          <div className="tech-stack" translate="no">
            <span className="tech-tag">React</span>
            <span className="tech-tag">Spring Boot</span>
            <span className="tech-tag">Circuit Breaker</span>
            <span className="tech-tag">BFF Pattern</span>
          </div>
        </footer>

      </div>
    </>
  )
}
