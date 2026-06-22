# 🎬 Roteiro da Demonstração — Resiliência ao Vivo

Guia passo a passo para conduzir a demo numa entrevista. A ideia é **provocar
falhas controladas** (fault injection) e mostrar o **Circuit Breaker** reagindo
em tempo real, sem reiniciar nada.

> Frase de abertura sugerida:
> *"Vou mostrar como esse sistema se comporta quando um serviço falha. Em vez de
> derrubar um processo na mão, eu tenho um mecanismo de **injeção de falha
> controlada** — a base da **chaos engineering** — para provocar a falha ao vivo
> e provar que os mecanismos de resiliência funcionam."*

---

## 1. Preparação (antes da entrevista)

Suba tudo, na ordem:

```powershell
# Na raiz do projeto, 4 terminais (ou use os botões Run do IntelliJ):
.\gradlew.bat :backend:servico-saldo:bootRun
.\gradlew.bat :backend:servico-cartao:bootRun
.\gradlew.bat :backend:servico-investimentos:bootRun
.\gradlew.bat :backend:bff:bootRun

# Frontend:
cd frontend
npm run dev
```

Abra `http://localhost:5173` e vá na aba **Resiliência**.
Deixe o **Painel principal** aberto em outra aba (para mostrar o impacto no usuário).

✅ Estado inicial: os 3 circuitos em **FECHADO** (verde), cabeçalho **SISTEMA OPERACIONAL**.

---

## 2. Os 3 atos da demonstração

### 🎭 ATO 1 — Serviço fora do ar (fallback `SERVICO_FORA`)

**O que clicar:** na aba Resiliência, no card **Saldo**, clique em **Erro 500**.

**O que falar:**
> *"Acabei de simular o serviço de saldo respondendo erro 500, como se ele tivesse
> caído em produção. Repare que o circuito ainda está **FECHADO** — uma falha só
> não abre o disjuntor."*

Vá ao **Painel principal** e clique em **Atualizar**.
> *"O card de saldo agora mostra dados de **contingência**, com o motivo
> `SERVICO_FORA`. O importante: **cartão e investimentos continuam funcionando**.
> A falha de um serviço **não derrubou** o resto — isso é o isolamento de falhas
> do padrão BFF."*

---

### 🎭 ATO 2 — O circuito ABRE (fallback `CIRCUITO_ABERTO`)

**O que clicar:** volte ao Painel principal e clique em **Atualizar 5 ou 6 vezes**
(o serviço de saldo segue em Erro 500).

**O que falar (olhando a aba Resiliência):**
> *"Configurei o circuito para abrir após **5 chamadas** com mais de **50% de
> falha**. Olhem o painel: a **taxa de falha** subiu, e o estado mudou de
> **FECHADO** para **ABERTO** (vermelho). Agora o último motivo virou
> `CIRCUITO_ABERTO`."*

> *"A diferença é crucial: no `SERVICO_FORA`, o BFF **tentava** chamar o serviço e
> falhava. Agora, com o circuito **ABERTO**, o BFF **nem tenta** — ele falha
> instantaneamente e protege o sistema. É o disjuntor da sua casa: depois que
> desarma, ele para de mandar corrente para o curto-circuito."*

Ponto técnico forte para soltar aqui:
> *"Isso evita o **efeito cascata**: sem o circuit breaker, threads do BFF ficariam
> presas esperando o serviço morto, esgotando o pool e derrubando o BFF inteiro."*

---

### 🎭 ATO 3 — A recuperação (`SEMI-ABERTO` → `FECHADO`)

**O que clicar:** no card Saldo, clique em **Normal** (desliga a falha).
Depois **espere ~10 segundos** olhando o painel.

**O que falar:**
> *"O serviço voltou ao normal. O circuito não fecha na hora: ele espera
> **10 segundos** e entra em **SEMI-ABERTO** (âmbar) — deixa passar algumas
> chamadas de teste. Se elas tiverem sucesso, ele **fecha** de novo e volta ao
> verde. Essa recuperação automática é o que evita intervenção manual de
> madrugada."*

Clique em **Atualizar** no Painel principal algumas vezes para alimentar as
chamadas de teste e ver o circuito **FECHAR** (voltar ao verde).

---

## 3. Bônus — o `TIMEOUT` (fallback distinto)

Se quiser mostrar o terceiro motivo de falha:

**O que clicar:** card de um serviço → **Lentidão**. Depois Atualizar no Painel.

**O que falar:**
> *"Agora o serviço não está fora — ele está **lento** (dorme 5s). O BFF tem um
> **timeout de 2s** (`@TimeLimiter`): em vez de ficar preso esperando, ele desiste
> e dispara o fallback com motivo `TIMEOUT`. Esperar para sempre é tão ruim quanto
> falhar — então cortamos o tempo de espera."*

---

## 4. Mapa rápido dos 3 fallbacks (cola mental)

| Botão no painel | O que simula            | Motivo no fallback | Conceito Resilience4j |
|-----------------|-------------------------|--------------------|------------------------|
| **Erro 500**    | Serviço caiu (HTTP 500) | `SERVICO_FORA`     | `@Retry` esgota → CB conta a falha |
| **Erro 500** (5×)| Falhas repetidas       | `CIRCUITO_ABERTO`  | `@CircuitBreaker` abre (>50% falha) |
| **Lentidão**    | Serviço lento (5s)      | `TIMEOUT`          | `@TimeLimiter` corta em 2s |

---

## 5. Frase de encerramento

> *"Resumindo: o sistema **degrada com elegância** em vez de cair por inteiro.
> Cada serviço é isolado, falhas não viram cascata, esperas são limitadas, e a
> recuperação é automática. É exatamente o tipo de resiliência que um sistema
> bancário precisa para não derrubar o app inteiro quando um pedaço falha."*
