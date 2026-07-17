# Frontend — Itaú Resilience Ops

Painel de operações (SPA React) do projeto **itau-resilience-bff**. Mostra, em tempo
real, como um Super App bancário permanece parcialmente funcional quando um serviço de
backend falha — com o **Circuit Breaker** como protagonista.

> Este é o módulo de frontend. Para a visão completa da arquitetura (BFF, serviços
> backend, padrões de resiliência e Docker), veja o [README na raiz](../README.md).

## Stack

| Camada     | Tecnologia       |
| ---------- | ---------------- |
| UI         | React 19         |
| Build/Dev  | Vite 8           |
| Rotas      | React Router 7   |
| HTTP       | Axios            |
| Animações  | Framer Motion    |
| Lint       | ESLint 10        |

## Pré-requisitos

- **Node.js 20.19+ ou 22.12+** (requisito do Vite 8) e npm
- O **BFF** rodando em `http://localhost:8083`. Em modo dev o Vite faz proxy das
  chamadas de API para ele (veja `vite.config.js`). Sem o BFF no ar, as telas abrem,
  mas os dados vêm vazios ou em estado de erro.

## Como rodar (desenvolvimento)

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. As chamadas para `/dashboard`, `/resiliencia/*` e
`/actuator` são encaminhadas ao BFF na porta 8083.

## Scripts

| Comando           | O que faz                             |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Servidor de desenvolvimento (com HMR) |
| `npm run build`   | Build de produção em `dist/`          |
| `npm run preview` | Serve o build de produção localmente  |
| `npm run lint`    | Roda o ESLint                         |

## Rotas

| Rota           | Tela        | Papel                                                          |
| -------------- | ----------- | -------------------------------------------------------------- |
| `/`            | Painel      | Visão geral: saldo, cartão e investimentos agregados pelo BFF  |
| `/resiliencia` | Resiliência | Estado dos Circuit Breakers e injeção de falha ao vivo         |
| `/extrato`     | Extrato     | Lançamentos da conta (dados mockados em `src/data.js`)         |
| `/sobre`       | Sobre       | Contexto do projeto e da arquitetura                           |

## Estrutura

```
src/
├── main.jsx                    # Ponto de entrada (React + Router)
├── App.jsx                     # Shell: navegação, rotas e layout
├── data.js                     # Transações mockadas do Extrato
├── components/
│   ├── CountUp.jsx             # Animação de contagem de números
│   └── DiagramaArquitetura.jsx # Diagrama visual da arquitetura
└── pages/
    ├── Dashboard.jsx           # Painel
    ├── Resiliencia.jsx         # Circuit Breakers + injeção de falha
    ├── Extrato.jsx             # Extrato
    └── Sobre.jsx               # Sobre o projeto
```

---

Projeto educacional de portfólio, sem afiliação com o Itaú Unibanco S.A.
