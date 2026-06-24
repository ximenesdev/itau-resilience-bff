import DiagramaArquitetura from '../components/DiagramaArquitetura.jsx'

// Tela "Sobre o projeto". Conteúdo SEMPRE visível — sem animação de entrada que
// esconda texto (boa prática: não condicionar visibilidade a motion).
//
// Layout em DUAS COLUNAS (em telas largas): o texto explicativo fica à esquerda e o
// DIAGRAMA DE ARQUITETURA ANIMADO à direita. Antes sobrava um vazio enorme à
// direita; agora esse espaço carrega a peça que melhor prova a engenharia do
// projeto — o fluxo Frontend → BFF → 3 serviços com o Circuit Breaker.
export default function Sobre() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Sobre o projeto</h1>
          <p className="page-subtitle">Arquitetura de microsserviços resiliente</p>
        </div>
      </div>

      <div className="sobre-grid">
        {/* ===== COLUNA ESQUERDA: o texto ===== */}
        <div className="sobre-texto">
          <p className="about-lead">
            Um sistema bancário de demonstração que mostra como manter uma aplicação
            <strong> funcionando mesmo quando parte dela falha</strong>.
          </p>

          <section className="about-block">
            <h2 className="about-h2">O problema</h2>
            <p>
              A tela inicial do banco precisa mostrar saldo, cartão e investimentos. Esses dados vêm de
              três serviços diferentes. Se o serviço de cartão cair, o que acontece com a tela inteira?
              Sem proteção, <strong>a página toda quebra</strong> — o cliente não vê nem o saldo, que
              estava funcionando.
            </p>
          </section>

          <section className="about-block">
            <h2 className="about-h2">A solução: <span translate="no">Circuit Breaker</span> + <span translate="no">BFF</span></h2>
            <p>
              O <strong translate="no">BFF (Backend for Frontend)</strong> é um serviço único que conversa com os três
              serviços e entrega tudo pronto para a tela. O padrão <strong translate="no">Circuit Breaker</strong> (disjuntor)
              funciona como o disjuntor da sua casa: quando um serviço falha, ele "desarma" aquele pedaço
              específico e devolve uma resposta alternativa amigável, mantendo o resto de pé.
            </p>
          </section>

          <section className="about-block">
            <h2 className="about-h2">Tecnologias</h2>
            <div className="tech-grid" translate="no">
              <div className="tech-item"><span className="tech-name">Java 25</span><span className="tech-desc">Linguagem dos serviços</span></div>
              <div className="tech-item"><span className="tech-name">Spring Boot</span><span className="tech-desc">Framework backend</span></div>
              <div className="tech-item"><span className="tech-name">Resilience4j</span><span className="tech-desc">Biblioteca de resiliência</span></div>
              <div className="tech-item"><span className="tech-name">React</span><span className="tech-desc">Interface do usuário</span></div>
              <div className="tech-item"><span className="tech-name">Vite</span><span className="tech-desc">Build do frontend</span></div>
              <div className="tech-item"><span className="tech-name">Framer Motion</span><span className="tech-desc">Animações</span></div>
            </div>
          </section>
        </div>

        {/* ===== COLUNA DIREITA: o diagrama animado (prova de engenharia) ===== */}
        <aside className="sobre-visual">
          <DiagramaArquitetura />
        </aside>
      </div>
    </div>
  )
}
