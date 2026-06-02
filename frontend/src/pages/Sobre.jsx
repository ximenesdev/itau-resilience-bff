import { motion } from 'framer-motion'
import WordReveal from '../components/WordReveal.jsx'

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }
  })
}

export default function Sobre() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <WordReveal className="page-title">Sobre o projeto</WordReveal>
          <p className="page-subtitle">Arquitetura de microsserviços resiliente</p>
        </div>
      </div>

      <motion.section className="about-hero" variants={fade} initial="hidden" animate="show" custom={0}>
        <p className="about-lead">
          Um sistema bancário de demonstração que mostra como manter uma aplicação
          <strong> funcionando mesmo quando parte dela falha</strong> — o problema central
          de qualquer sistema distribuído em produção.
        </p>
      </motion.section>

      <motion.section className="about-block" variants={fade} initial="hidden" animate="show" custom={1}>
        <h2 className="about-h2">O problema</h2>
        <p>
          Imagine que a tela inicial do banco precisa mostrar saldo, cartão e investimentos.
          Esses dados vêm de três serviços diferentes. Se o serviço de cartão cair,
          o que acontece com a tela inteira? Sem proteção, <strong>a página toda quebra</strong> —
          o cliente não vê nem o saldo, que estava funcionando.
        </p>
      </motion.section>

      <motion.section className="about-block" variants={fade} initial="hidden" animate="show" custom={2}>
        <h2 className="about-h2">A solução: <span translate="no">Circuit Breaker</span> + <span translate="no">BFF</span></h2>
        <p>
          O <strong translate="no">BFF (Backend for Frontend)</strong> é um serviço único que conversa com os três
          serviços e entrega tudo pronto para a tela. E o padrão <strong translate="no">Circuit Breaker</strong> (disjuntor)
          funciona como o disjuntor da sua casa: quando um serviço falha, ele "desarma" aquele
          pedaço específico e devolve uma resposta alternativa amigável, mantendo o resto de pé.
        </p>
      </motion.section>

      {/* Diagrama da arquitetura */}
      <motion.section className="about-block" variants={fade} initial="hidden" animate="show" custom={3}>
        <h2 className="about-h2">Como os serviços se conectam</h2>
        <div className="arch" translate="no">
          <div className="arch-node frontend">
            <span className="arch-tag">Frontend</span>
            <span className="arch-name">React</span>
            <span className="arch-port">:5173</span>
          </div>
          <div className="arch-arrow">→</div>
          <div className="arch-node bff">
            <span className="arch-tag">Orquestrador</span>
            <span className="arch-name">BFF + Circuit Breaker</span>
            <span className="arch-port">:8083</span>
          </div>
          <div className="arch-arrow">→</div>
          <div className="arch-services">
            <div className="arch-node svc"><span className="arch-name">Saldo</span><span className="arch-port">:8080</span></div>
            <div className="arch-node svc"><span className="arch-name">Cartão</span><span className="arch-port">:8081</span></div>
            <div className="arch-node svc"><span className="arch-name">Investimentos</span><span className="arch-port">:8082</span></div>
          </div>
        </div>
      </motion.section>

      {/* Tecnologias */}
      <motion.section className="about-block" variants={fade} initial="hidden" animate="show" custom={4}>
        <h2 className="about-h2">Tecnologias</h2>
        <div className="tech-grid" translate="no">
          <div className="tech-item"><span className="tech-name">Java 25</span><span className="tech-desc">Linguagem dos serviços</span></div>
          <div className="tech-item"><span className="tech-name">Spring Boot</span><span className="tech-desc">Framework backend</span></div>
          <div className="tech-item"><span className="tech-name">Resilience4j</span><span className="tech-desc">Biblioteca de resiliência</span></div>
          <div className="tech-item"><span className="tech-name">React</span><span className="tech-desc">Interface do usuário</span></div>
          <div className="tech-item"><span className="tech-name">Vite</span><span className="tech-desc">Build do frontend</span></div>
          <div className="tech-item"><span className="tech-name">Framer Motion</span><span className="tech-desc">Animações</span></div>
        </div>
      </motion.section>

    </div>
  )
}
