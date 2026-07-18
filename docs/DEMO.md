# Demonstração de resiliência ao vivo

Este guia mostra como **reproduzir os mecanismos de resiliência** do projeto sem
reiniciar nada: injetando falhas controladas em um serviço e observando o Circuit
Breaker reagir em tempo real. É a forma mais rápida de ver, na prática, o que o
BFF faz quando uma dependência falha.

> **Pré-requisito:** o sistema no ar. Suba tudo via Docker
> ([`COMO-RODAR-DOCKER.md`](COMO-RODAR-DOCKER.md)) ou localmente (ver o
> [README](../README.md#-quick-start)). Depois abra `http://localhost:5173` e vá
> na aba **Resiliência**.

Estado inicial esperado: os três circuitos em **FECHADO** (verde) e o cabeçalho
indicando **sistema operacional**.

---

## Ato 1 — Serviço fora do ar → fallback `SERVICO_FORA`

**Ação:** na aba Resiliência, no card **Saldo**, clique em **Erro 500**. Depois vá
ao **Painel principal** e clique em **Atualizar**.

**O que acontece:** o serviço de saldo passa a responder HTTP 500. O card de saldo
mostra dados de **contingência**, com o motivo `SERVICO_FORA`. O circuito continua
**FECHADO** — uma única falha não abre o disjuntor.

**Por quê:** cartão e investimentos continuam funcionando normalmente. A falha de
um serviço **não derruba** os demais — é o isolamento de falhas do padrão BFF.

---

## Ato 2 — O circuito abre → fallback `CIRCUITO_ABERTO`

**Ação:** com o saldo ainda em Erro 500, volte ao Painel principal e clique em
**Atualizar 5 ou 6 vezes**.

**O que acontece:** o circuito está configurado para abrir após **5 chamadas** com
mais de **50% de falha**. No painel, a taxa de falha sobe e o estado do circuito de
saldo muda de **FECHADO** para **ABERTO** (vermelho). O motivo do fallback passa a
ser `CIRCUITO_ABERTO`.

**Por quê:** a diferença em relação ao Ato 1 é crucial. No `SERVICO_FORA`, o BFF
**tentava** chamar o serviço e falhava. Com o circuito **ABERTO**, o BFF **nem
tenta** — falha instantaneamente e protege o sistema, como um disjuntor elétrico
que desarma. Isso evita o **efeito cascata**: sem o Circuit Breaker, threads do BFF
ficariam presas esperando o serviço morto, esgotando o pool e derrubando o BFF
inteiro.

---

## Ato 3 — A recuperação → `HALF_OPEN` → `CLOSED`

**Ação:** no card Saldo, clique em **Normal** (desliga a falha) e aguarde ~10
segundos. Depois clique em **Atualizar** no Painel principal algumas vezes.

**O que acontece:** o circuito não fecha na hora. Ele espera **10 segundos**
(`waitDurationInOpenState`) e entra em **SEMI-ABERTO** (âmbar), deixando passar
algumas chamadas de teste. Se elas têm sucesso, o circuito **FECHA** de novo e
volta ao verde.

**Por quê:** essa recuperação automática é o que evita intervenção manual. O
sistema testa sozinho se a dependência voltou e se recompõe sem ninguém no
teclado.

---

## Bônus — Serviço lento → fallback `TIMEOUT`

**Ação:** em um card de serviço, clique em **Lentidão**. Depois **Atualizar** no
Painel principal.

**O que acontece:** o serviço não está fora — está **lento** (dorme 5s). O BFF tem
um **timeout de 2s** (`@TimeLimiter`): em vez de esperar, desiste e dispara o
fallback com o motivo `TIMEOUT`.

**Por quê:** esperar para sempre é tão ruim quanto falhar, então o tempo de espera
é limitado. Detalhe fino: o Retry é configurado para **não** re-tentar em timeout —
re-tentar um serviço já lento só faz o usuário esperar em dobro, já que cada
tentativa paga os 2s do timeout.

---

## Mapa dos três fallbacks

| Ação no painel   | O que simula            | Motivo do fallback | Mecanismo Resilience4j |
|------------------|-------------------------|--------------------|-------------------------|
| **Erro 500**     | Serviço caiu (HTTP 500) | `SERVICO_FORA`     | `@Retry` esgota → CB conta a falha |
| **Erro 500** (5×)| Falhas repetidas        | `CIRCUITO_ABERTO`  | `@CircuitBreaker` abre (>50% de falha) |
| **Lentidão**     | Serviço lento (5s)      | `TIMEOUT`          | `@TimeLimiter` corta em 2s |

---

## Reproduzindo pelo terminal (sem o frontend)

A injeção de falha também é acessível via API do BFF, útil para scripts ou para
demonstrar sem a interface:

```bash
# Injeta erro no serviço de saldo (passando pelo BFF)
curl -X POST "http://localhost:8083/resiliencia/falha/saldo/ativar?modo=erro"

# Injeta lentidão
curl -X POST "http://localhost:8083/resiliencia/falha/saldo/ativar?modo=lentidao"

# Observa o resultado agregado e o estado dos circuitos
curl http://localhost:8083/dashboard
curl http://localhost:8083/resiliencia/circuitos

# Remove a falha
curl -X POST http://localhost:8083/resiliencia/falha/saldo/desativar
```

O estado dos disjuntores também aparece no Actuator:
`http://localhost:8083/actuator/circuitbreakers`.
