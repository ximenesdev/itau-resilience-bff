# Perguntas & Respostas de Entrevista — `itau-resilience-bff`

Guia de estudo para defender o projeto numa entrevista técnica (Itaú / Sicoob).
As respostas estão no formato "resposta curta que eu falaria" + o **porquê** por trás,
para você conseguir sustentar a conversa quando o entrevistador aprofundar.

> Dica de ouro: numa entrevista, **conte a história da Fase D** (seção 3). Descobrir que
> o `@Retry` estava "morto" e corrigir via ordem dos aspectos é exatamente o tipo de
> raciocínio que separa "quem copiou um tutorial" de "quem entende o que está fazendo".

Sumário:
1. [Visão geral e o padrão BFF](#1-visão-geral-e-o-padrão-bff)
2. [Circuit Breaker: conceito e os 3 estados](#2-circuit-breaker-conceito-e-os-3-estados)
3. [Resilience4j: as 3 anotações e a ORDEM dos aspectos (a história principal)](#3-resilience4j-as-3-anotações-e-a-ordem-dos-aspectos)
4. [TimeLimiter, chamadas paralelas e CompletableFuture](#4-timelimiter-chamadas-paralelas-e-completablefuture)
5. [Fallback e degradação graciosa](#5-fallback-e-degradação-graciosa)
6. [Observabilidade e o painel ao vivo](#6-observabilidade-e-o-painel-ao-vivo)
7. [Fault injection / Chaos Engineering](#7-fault-injection--chaos-engineering)
8. [Testes](#8-testes)
9. [Decisões de stack (Spring Boot 4, Java 25, AOP)](#9-decisões-de-stack)
10. [Trade-offs, limitações e produção](#10-trade-offs-limitações-e-o-que-eu-faria-em-produção)
11. [Perguntas-armadilha](#11-perguntas-armadilha)
12. [Comportamentais ligadas ao projeto](#12-comportamentais-ligadas-ao-projeto)

---

## 1. Visão geral e o padrão BFF

**Q1. Em uma frase, o que é este projeto?**
É um *Super App* bancário simplificado que demonstra **resiliência**: um **BFF** (Backend
For Frontend) agrega 3 microsserviços (saldo, cartão, investimentos) e usa **Circuit
Breaker, Timeout e Retry** (Resilience4j) para continuar respondendo mesmo quando um
serviço cai ou fica lento. Tem um painel ao vivo que prova isso na prática.

**Q2. O que é o padrão BFF e por que usei?**
BFF é um backend dedicado a UM frontend. O frontend (React, porta 5173) fala só com o
BFF (porta 8083) e não sabe que existem 3 serviços em portas diferentes (8080/8081/8082).
Vantagens que eu defendo:
- **Agrega** dados de vários serviços numa única resposta (`/dashboard`), reduzindo
  idas e voltas do frontend.
- **Esconde a topologia** do backend: o BFF conhece o "mapa" das portas/serviços.
- **Centraliza a resiliência** (CB/timeout/retry) e o **CORS** num lugar só.
- O frontend fica mais simples e mais estável.

**Q3. Por que microsserviços separados e não um monólito?**
Para o objetivo do projeto — **mostrar isolamento de falha**. Com serviços separados, eu
consigo derrubar SÓ o de cartão e provar que saldo e investimentos continuam funcionando.
Num monólito não daria para demonstrar o circuit breaker isolando uma dependência.

**Q4. Qual é o fluxo de uma requisição ao `/dashboard`?**
Frontend → `GET /dashboard` no BFF → o BFF dispara **em paralelo** as 3 chamadas
(saldo/cartão/investimentos), cada uma protegida por CB+Timeout+Retry → junta as 3
respostas (reais OU fallback) num único JSON → devolve. O campo `status` diz se está
"operacional" ou "degradado — N serviço(s) indisponível(is)".

---

## 2. Circuit Breaker: conceito e os 3 estados

**Q5. O que é um Circuit Breaker e qual problema resolve?**
É um "disjuntor" de software. Quando uma dependência começa a falhar consistentemente,
ele **abre** e passa a rejeitar as chamadas imediatamente, sem nem tentar a rede. Isso
resolve o problema de **falha em cascata**: sem ele, threads ficam presas esperando um
serviço morto, o pool de threads esgota, e o BFF inteiro cai por causa de UMA dependência.
O CB "sacrifica" a dependência ruim para proteger o resto.

**Q6. Explique os 3 estados.**
- **CLOSED (fechado):** estado normal, as chamadas passam. O CB observa os resultados
  numa janela deslizante.
- **OPEN (aberto):** a taxa de falha estourou o limite. As chamadas são **bloqueadas na
  hora** (lançam `CallNotPermittedException`) e vão direto para o fallback. Poupa recursos
  e dá tempo do serviço se recuperar.
- **HALF_OPEN (semiaberto):** depois de um tempo aberto, o CB deixa passar **algumas
  chamadas de teste**. Se elas têm sucesso, ele **fecha** (volta ao normal). Se falham,
  ele **abre** de novo. É o que torna o CB **autocurável** — ele se recupera sozinho,
  sem intervenção humana.

**Q7. Quais valores você configurou e por quê?**
(arquivo `application.yml`)
- `slidingWindowType: COUNT_BASED`, `slidingWindowSize: 10` → calcula a taxa sobre as
  últimas 10 chamadas.
- `minimumNumberOfCalls: 5` → só começa a calcular a taxa depois de 5 chamadas. Sem isso,
  1 falha em 1 chamada = 100% e o circuito abriria cedo demais.
- `failureRateThreshold: 50` → abre se ≥ 50% das chamadas na janela falharem.
- `waitDurationInOpenState: 10s` → tempo aberto antes de testar (HALF_OPEN).
- `permittedNumberOfCallsInHalfOpenState: 3` → 3 chamadas de teste no HALF_OPEN.
> **Honestidade que impressiona:** "Esses valores são propositalmente baixos para a
> DEMONSTRAÇÃO. Em produção eu usaria janela e mínimo maiores (ex.: 20–50) e
> `waitDuration` de 30–60s, porque um sistema real tem muito mais tráfego e eu não
> quero abrir o circuito por causa de uma microrrajada de erros."

**Q8. COUNT_BASED vs TIME_BASED?**
COUNT_BASED conta as últimas N **chamadas**; TIME_BASED conta as chamadas dos últimos N
**segundos**. Usei COUNT_BASED porque é mais previsível para demonstrar (5 falhas = abre).
TIME_BASED é melhor quando o volume de tráfego varia muito ao longo do tempo.

---

## 3. Resilience4j: as 3 anotações e a ORDEM dos aspectos

> **Esta é a parte mais forte do projeto. Estude bem.**

**Q9. Quais anotações você usou e o que cada uma faz?**
Nos métodos do `ServicoBackend`:
- `@CircuitBreaker(name="saldo", fallbackMethod="fallbackSaldo")` — o disjuntor + o fallback.
- `@TimeLimiter(name="saldo")` — corta a espera em 2s.
- `@Retry(name="saldo")` — tenta de novo em falha transitória (`maxAttempts: 2`).

**Q10. Como o Resilience4j intercepta essas anotações? Por que a lógica está num `@Service`
separado do controller?**
Via **AOP (programação orientada a aspectos)**: o Spring entrega um **proxy** no lugar do
`ServicoBackend`. Quando o controller chama `servicoBackend.buscarSaldo()`, a chamada passa
pelo proxy, que executa CB/Timeout/Retry **antes** do método real.
O detalhe crítico: se eu colocasse essa lógica no próprio controller e chamasse
`this.buscarSaldo()`, a chamada seria **interna ao objeto** e **não passaria pelo proxy** —
o AOP seria ignorado e o circuit breaker **nunca atuaria**. Por isso a lógica fica num
bean separado, injetado.

**Q11. (A PERGUNTA PRINCIPAL) As 3 anotações se "envolvem" umas nas outras. Qual é a ordem
e por que ela importa?**
A ordem padrão do Resilience4j coloca o **Retry como o aspecto mais externo**:
`Retry( CircuitBreaker( TimeLimiter( chamada ) ) )`.
Eu **inverti de propósito** para o **CircuitBreaker ser o mais externo**:
`CircuitBreaker( Retry( TimeLimiter( chamada ) ) )`.

Por quê? Porque o **fallback mora no `@CircuitBreaker`**. Com a ordem padrão, eu descobri
um bug silencioso (ver Q12). Com o CB por fora:
- O **Retry fica por dentro do CB** → vê a falha **crua** (antes do fallback) → realmente
  tenta de novo.
- O **CircuitBreaker conta REQUISIÇÕES LÓGICAS, não tentativas**: uma chamada que falha
  mesmo depois de esgotar os retries = **1 falha** no disjuntor, não 2. Assim a taxa de
  falha reflete a saúde real do serviço, sem distorção pelo número de retries.
- Cada tentativa do Retry tem seu próprio Timeout de 2s (TimeLimiter por dentro).

**Q12. (A HISTÓRIA QUE VOCÊ DEVE CONTAR) Você falou em "bug silencioso". Qual era?**
Validando o projeto, descobri que o **`maxAttempts: 2` do Retry não tinha efeito nenhum —
era configuração morta**. Motivo: na ordem padrão, o Retry está **por fora** do
CircuitBreaker, e o fallback do CB **engole** a exceção e devolve o fallback como um
**resultado de SUCESSO**. Como o Retry só via "sucesso", ele **nunca tentava de novo**.
Eu provei isso lendo as métricas do próprio Retry: `successfulCallsWithoutRetryAttempt = 1`,
ou seja, 1 sucesso e 0 retentativas, mesmo com o serviço falhando.
A correção foi inverter a ordem (CB por fora). Depois disso, um teste prova que o Retry
faz **2 chamadas HTTP** e o CB registra **1 falha**.

**Q13. Como se configura essa ordem? Teve alguma pegadinha?**
Duas pegadinhas que custaram tempo (e que eu sei explicar):
1. **Direção do número:** no Spring (`Ordered`), **MENOR valor = mais EXTERNO** (maior
   precedência, executa primeiro). Então dei o **menor** número ao CB:
   `circuitBreakerAspectOrder: 1`, `retryAspectOrder: 2`, `timeLimiterAspectOrder: 3`.
2. **Onde a propriedade fica:** cada `*AspectOrder` precisa ficar **dentro da sua seção**
   (`resilience4j.circuitbreaker.circuitBreakerAspectOrder`, etc.). Se eu deixar solto sob
   `resilience4j:`, o Spring **ignora em silêncio** — eu cai nessa e os três valores não
   surtiam efeito até eu mover para o lugar certo.

**Q14. Retry não é perigoso? Pode piorar uma sobrecarga.**
Sim, retry mal usado amplifica carga (o "retry storm"). Por isso:
- `maxAttempts: 2` (só **uma** tentativa extra, não infinitas).
- `waitDuration: 300ms` entre tentativas, para não bombardear um serviço se recuperando.
- E principalmente: o Retry está **por dentro do Circuit Breaker**. Se o serviço está
  consistentemente fora, o CB **abre** e corta as tentativas na raiz — o retry só age em
  falhas pontuais, não numa queda generalizada. Em produção eu ainda adicionaria
  *backoff exponencial* e *jitter*.

---

## 4. TimeLimiter, chamadas paralelas e CompletableFuture

**Q15. Por que preciso de Timeout se já tenho Circuit Breaker?**
São proteções para problemas diferentes. O CB protege contra falhas **explícitas**
(erros, exceções). O Timeout protege contra o pior caso: o serviço que **não responde nem
dá erro** — fica pendurado. Uma thread esperando para sempre é um vazamento de recurso;
com tráfego, esgota o pool de threads. O `@TimeLimiter` corta a espera em **2s** e trata
como falha (que, aí sim, alimenta o circuit breaker).

**Q16. Por que os métodos retornam `CompletableFuture`?**
Porque o `@TimeLimiter` precisa **cancelar** uma tarefa que demora demais, e para isso a
execução tem que ser **assíncrona**. Uso `CompletableFuture.supplyAsync(...)` para rodar a
chamada HTTP em outra thread. Se fosse síncrono e bloqueante, não daria para interromper a
espera no prazo.

**Q17. Você diz que as 3 chamadas são "em paralelo". Como?**
No `BffController`, eu chamo os 3 métodos (`buscarSaldo`, `buscarCartao`,
`buscarInvestimentos`) — como cada um já dispara um `supplyAsync`, as 3 tarefas começam
**ao mesmo tempo**. Depois uso `CompletableFuture.allOf(...).join()` para esperar todas
terminarem. Resultado: o `/dashboard` demora ≈ o tempo do serviço **mais lento**, não a
**soma** dos três. Se fossem sequenciais e cada um levasse 1s, seriam 3s; em paralelo, ~1s.

**Q18. E se uma das 3 chamadas falhar, o `allOf().join()` não estoura?**
Não, e isso é proposital. Cada future **sempre completa com sucesso**, porque o fallback
do circuit breaker transforma a falha numa resposta de contingência. Então o `join()` nunca
recebe um future em estado de exceção — no pior caso ele recebe o JSON de fallback. O
dashboard nunca quebra inteiro por causa de um serviço.

---

## 5. Fallback e degradação graciosa

**Q19. O que é "degradação graciosa" e como aparece aqui?**
É continuar funcionando **parcialmente** em vez de cair por completo. Se o serviço de cartão
cai, o usuário ainda vê saldo e investimentos; o card de cartão mostra dados de contingência
com aviso. Melhor um app "degradado" do que uma tela de erro total.

**Q20. Seu fallback diferencia 3 motivos. Quais e por quê?**
No método `preencherMotivo`, eu inspeciono a exceção recebida:
- `CallNotPermittedException` → **CIRCUITO_ABERTO** (o CB bloqueou sem nem tentar).
- `TimeoutException` / `CancellationException` → **TIMEOUT** (estourou os 2s).
- Qualquer outra (ex.: conexão recusada, HTTP 500) → **SERVICO_FORA**.
Por que diferenciar? (1) Numa entrevista, prova que entendo os estados; (2) no painel, dá
para mostrar ao operador **por que** caiu; (3) o `status` continua "CIRCUIT BREAKER ATIVO"
em todos os casos para o frontend pintar o card de vermelho — o `motivo` é o detalhe técnico.

**Q21. Regra do fallback no Resilience4j que você precisou respeitar?**
A assinatura do método de fallback tem que ter o **mesmo tipo de retorno** do original
(`CompletableFuture<Map<String,Object>>`) e receber um parâmetro `Throwable` a mais. Se a
assinatura não casa, o Resilience4j não acha o fallback em runtime.

---

## 6. Observabilidade e o painel ao vivo

**Q22. Como dá para observar o estado dos circuitos?**
Por dois caminhos:
- **Actuator** (padrão Spring): expus `health`, `metrics`, `circuitbreakers` e
  `circuitbreakerevents`.
- **Endpoint próprio** `GET /resiliencia/circuitos`, que lê o `CircuitBreakerRegistry` e
  devolve um JSON limpo (estado, taxa de falha, nº de chamadas na janela, último motivo).
  É o que o painel React consome (polling a cada 1,5s).

**Q23. (DECISÃO BOA) Por que criou um endpoint próprio em vez de usar só o Actuator?**
Dois motivos concretos:
1. O `/actuator/circuitbreakers` só devolve a **lista de nomes** dos circuitos, não os
   estados/métricas que o painel precisa.
2. O `/actuator/health`, com `circuitbreakers.enabled: true`, vira **HTTP 503** quando um
   circuito abre. Isso é correto para um *health check* de orquestrador (Kubernetes), mas
   **quebraria o painel** justo na hora da demonstração — o front trataria como "API fora".
Então criei uma visão própria, **estável**, lendo o registry direto. Mostra que eu entendo
a diferença entre "health check para infra" e "telemetria para um dashboard".

**Q24. Por que a classe `EstadoResiliencia` existe?**
O `CircuitBreakerRegistry` guarda **estado e números**, mas não o "motivo humano" do último
fallback (SERVICO_FORA/TIMEOUT/CIRCUITO_ABERTO). Então criei um componente em memória que o
`ServicoBackend` **escreve** (no fallback) e o `ResilienciaController` **lê** (no painel).
Uso `ConcurrentHashMap` porque as 3 chamadas paralelas do `/dashboard` podem escrever ao
mesmo tempo — preciso de uma estrutura segura para concorrência.

---

## 7. Fault injection / Chaos Engineering

**Q25. Como você "quebra" um serviço ao vivo sem reiniciar nada?**
Cada serviço tem um componente `ModoFalha` (um interruptor em memória) com 3 modos:
- **NORMAL** → responde certo.
- **ERRO** → lança **HTTP 500** → no BFF vira fallback **SERVICO_FORA**.
- **LENTIDAO** → dorme **5s** (acima dos 2s de timeout) → no BFF vira fallback **TIMEOUT**.
Eu ligo/desligo via `POST /admin/falha/ativar|desativar`, repassado pelo BFF
(`/resiliencia/falha/{servico}/ativar`). Isso é **fault injection** — a base de *chaos
engineering* (o Chaos Monkey da Netflix). Em vez de esperar uma falha real, eu a provoco
de propósito, num ambiente controlado, para **provar** que as proteções funcionam.

**Q26. Por que o `modoAtual` é `volatile`?**
Porque ele é **escrito** por uma thread (a requisição `POST /admin/falha/ativar`) e
**lido** por outra (o `GET /saldo` seguinte). Sem `volatile`, por causa de cache de CPU,
a thread leitora poderia não enxergar a mudança. O `volatile` garante **visibilidade
imediata** entre threads. (É um detalhe de modelo de memória da JVM que costuma impressionar.)

**Q27. Por que a lógica de falha fica isolada num método/classe à parte?**
Para deixar explícito que é um **enxerto de demonstração**, fácil de ler e de **remover**,
sem se misturar com a regra de negócio real do serviço. Em produção, esse componente não
existiria.

---

## 8. Testes

**Q28. O que seus testes cobrem?**
9 testes no BFF, em 3 níveis:
- **`BffApplicationTests`** — *smoke test*: o contexto Spring sobe (prova que toda a config
  do Resilience4j/Actuator/AspectJ está correta).
- **`BffControllerTest`** — testes **puros com Mockito** (sem Spring): a lógica de montar o
  JSON do `/dashboard` (operacional vs degradado). Rápidos (milissegundos).
- **`CircuitBreakerTest`** — testes de **integração com `@SpringBootTest`**, que sobem os
  proxies AOP de verdade: fallback por SERVICO_FORA, abertura do circuito após 5 falhas,
  **prova da ordem dos aspectos** (2 HTTP + 1 falha no CB), **TIMEOUT** e o ciclo
  **OPEN→HALF_OPEN→CLOSED**.

**Q29. Por que dois estilos (Mockito puro vs `@SpringBootTest`)?**
Cada um testa uma coisa. O Mockito puro testa a **lógica do controller** sem o peso de subir
o Spring — aqui as anotações de resiliência **não** atuam, e está certo, porque o teste não é
sobre o CB. Já o `@SpringBootTest` é o **único** jeito de testar o comportamento **real** do
circuit breaker, porque ele precisa dos proxies AOP ativos. Usar a ferramenta certa para
cada objetivo (pirâmide de testes: muitos testes rápidos, poucos lentos e completos).

**Q30. Como você testou o HALF_OPEN sem esperar 10 segundos?**
Forcei a transição com `cb.transitionToHalfOpenState()`. Em produção isso acontece sozinho
após `waitDurationInOpenState` (10s), mas no teste eu não quero esperar 10s reais. Depois,
com o serviço "recuperado" (mock voltando a responder), as 3 chamadas de teste passam e o
circuito **fecha** sozinho — provando a autocura.

**Q31. Algum detalhe de Mockito que você precisou conhecer?**
Sim: para **re-configurar** o mock no meio de um teste (primeiro falhando, depois
recuperado), usei `doThrow(...).when(...)` / `doReturn(...).when(...)` em vez de
`when(...).thenThrow(...)`. Motivo: o estilo `when(...)` **executa** o stub durante a própria
reconfiguração — e o stub que lança exceção quebraria o teste. Também resetei o circuito no
`@BeforeEach` para um teste não "contaminar" o outro.

**Q32. Spring Boot 4 mudou algo nos testes?**
Sim: usei **`@MockitoBean`** em vez do antigo `@MockBean` (que foi depreciado/removido). Ele
substitui o `RestTemplate` real por um mock dentro do contexto Spring, deixando eu controlar
o que o "serviço" responde em cada cenário.

---

## 9. Decisões de stack

**Q33. Qual stack e por quê Spring Boot 4?**
Java 25 + **Spring Boot 4.0.6** (Spring Framework 7), Gradle 9.4.1, build multimódulo
(4 serviços), frontend React + Vite. Spring Boot 4 por ser a versão mais nova — mostra que
acompanho o ecossistema. Mas isso trouxe pegadinhas reais que eu sei explicar (abaixo).

**Q34. (PEGADINHA QUE VOCÊ RESOLVEU) Que cuidados o Spring Boot 4 exigiu?**
Três:
1. **Resilience4j:** precisei do `resilience4j-spring-boot4:2.4.0`. O
   `resilience4j-spring-boot3` é **incompatível** com o Boot 4 (muda o Spring Framework de 6
   para 7).
2. **AOP:** no Boot 4 **não existe mais** o `spring-boot-starter-aop`. Tive que declarar o
   **`org.aspectj:aspectjweaver`** diretamente. Sem ele, as anotações `@CircuitBreaker`
   seriam **ignoradas em silêncio** — o método rodaria sem proteção alguma. Esse é um erro
   que passaria despercebido (compila e roda, só não protege).
3. **Testes:** `@MockitoBean` no lugar de `@MockBean`.

**Q35. O que significa "build multimódulo Gradle"?**
Um `settings.gradle` na raiz inclui os 4 serviços como módulos
(`:backend:bff`, `:backend:servico-saldo`, etc.). Um único `.\gradlew.bat build` na raiz
compila e testa os 4. Mantém o repositório organizado como um monorepo.

**Q36. Por que `RestTemplate` e não `WebClient`?**
`RestTemplate` é simples, síncrono e suficiente para o objetivo didático (e eu o envolvo em
`CompletableFuture` para o assincronismo que o TimeLimiter exige). Eu o registro como
**`@Bean`** (não `new RestTemplate()`) justamente para os testes conseguirem substituí-lo por
um mock. Em produção/maior escala, eu migraria para `WebClient` (reativo, não-bloqueante),
que casa melhor com chamadas paralelas e timeouts.

---

## 10. Trade-offs, limitações e o que eu faria em produção

**Q37. Quais as limitações conscientes deste projeto?**
- O `EstadoResiliencia` é **em memória** → não sobrevive a restart e não é compartilhado
  entre réplicas. Em produção: Redis ou um sistema de métricas (Micrometer/Prometheus).
- O **estado do circuit breaker é por instância** (in-JVM). Com várias réplicas do BFF,
  cada uma tem seu próprio CB — o que costuma ser **aceitável e até desejável** (cada
  instância reage ao que ela observa).
- Valores de config **agressivos para demo** (limites baixos, `waitDuration` curto).
- Sem autenticação/autorização nos endpoints `/admin/falha` — ok para demo, não para prod.
- `@CrossOrigin(origins = "*")` é permissivo demais para produção.

**Q38. O que você acrescentaria numa versão de produção?**
- **Backoff exponencial + jitter** no Retry.
- **Bulkhead** (isolar pools de thread por dependência) para reforçar o isolamento.
- **Observabilidade real**: Micrometer + Prometheus + Grafana, *tracing* distribuído
  (OpenTelemetry).
- **Idempotência** e cuidado com retry em operações de escrita (retry em GET é seguro;
  em POST que cria algo, não — pode duplicar).
- Segurança nos endpoints administrativos, CORS restrito, *rate limiting*.

**Q39. Retry em operações de escrita — qual o risco?**
Duplicação. Reexecutar um POST que transfere dinheiro pode transferir duas vezes. Retry só é
seguro em operações **idempotentes** (GET, ou escritas com chave de idempotência). Neste
projeto as chamadas são de **leitura**, então o retry é seguro — mas eu sei a fronteira.

---

## 11. Perguntas-armadilha

**Q40. "Você tem `@Retry` configurado. Ele está mesmo funcionando?"**
Hoje sim — e tenho um **teste que prova** (2 chamadas HTTP por requisição lógica). Mas a
resposta honesta é que ele **não estava** funcionando: na ordem padrão o fallback do CB
engolia a falha antes do Retry ver. Eu descobri pelas métricas e corrigi invertendo a ordem
dos aspectos. (Essa resposta vira ponto a favor, não contra.)

**Q41. "Se o circuito abre, o usuário recebe um erro?"**
Não. Circuito aberto → `CallNotPermittedException` → **fallback** com dados de contingência.
O usuário vê o app degradado com aviso, não uma tela de erro. O `/dashboard` continua 200 OK.

**Q42. "Por que não colocar as anotações direto no controller?"**
Porque a chamada `this.metodo()` é interna ao objeto e **não passa pelo proxy AOP** — o
circuit breaker seria ignorado. Por isso a lógica fica num bean `@Service` separado, injetado.

**Q43. "Qual a diferença entre Timeout e Circuit Breaker? Não são redundantes?"**
Não. Timeout protege contra "pendurado/lento"; Circuit Breaker protege contra "falha
repetida". O timeout transforma a lentidão numa **falha rápida**, que então alimenta o
circuit breaker. Eles se complementam: sem timeout, uma dependência lenta nunca contaria
como falha e o CB nunca abriria por causa de lentidão.

**Q44. "O que acontece se o `aspectjweaver` não estiver no classpath?"**
As anotações de resiliência são **ignoradas silenciosamente**: o app sobe, os endpoints
respondem, mas **sem nenhuma proteção**. É um bug perigoso porque parece estar tudo bem.
(No Boot 4 isso é fácil de cair porque o `starter-aop` foi removido.)

**Q45. "Por que `minimumNumberOfCalls`? Tira a proteção nas primeiras chamadas?"**
Ele evita **estatística não confiável**. Com 1 chamada, 1 falha = 100% e o circuito abriria
por um único erro pontual. Exigir um mínimo (5) garante que a taxa de falha tenha
significado estatístico antes de tomar uma decisão drástica como abrir o circuito.

---

## 12. Comportamentais ligadas ao projeto

**Q46. "Conte sobre um bug difícil que você resolveu."**
Use a **Fase D** (Q12): o `@Retry` que parecia configurado mas era config morta. Estrutura
da resposta (formato STAR):
- **Situação:** ao revisar o projeto, suspeitei de um comentário que afirmava algo errado
  sobre a ordem do Retry.
- **Tarefa:** validar se o retry realmente funcionava.
- **Ação:** escrevi um teste que contava chamadas HTTP e li as métricas do Retry; descobri
  que ele via "sucesso" porque o fallback do CB engolia a falha; estudei a ordem dos
  aspectos e descobri 2 pegadinhas (direção do número e onde a propriedade fica).
- **Resultado:** invertendo a ordem (CB por fora), o retry passou a funcionar de verdade,
  comprovado por teste automatizado. Documentei o porquê no código.
- **Aprendizado:** "configurado" não é "funcionando" — só confio depois de um teste provar.

**Q47. "Por que escolheu um tema de resiliência?"**
Porque em banco **resiliência é dinheiro e confiança**: um Super App não pode cair inteiro
porque uma dependência piscou. Quis demonstrar que entendo os padrões que mantêm sistemas
financeiros de pé sob falha parcial — e provar isso ao vivo, não só no slide.

**Q48. "Você é iniciante em Java. Como garantiu qualidade?"**
Com três coisas: (1) **comentei o porquê** de cada decisão no código, para conseguir
defendê-la; (2) **testes automatizados** que provam o comportamento, não só a compilação;
(3) **ceticismo** — quando uma config parecia certa, eu **provei** com teste/métrica antes de
confiar (foi assim que achei o bug do retry).

---

### Apêndice — números para ter na ponta da língua
- Portas: saldo **8080**, cartão **8081**, investimentos **8082**, BFF **8083**, front **5173**.
- CB: janela **10**, mínimo **5**, limiar **50%**, aberto por **10s**, **3** chamadas no HALF_OPEN.
- Timeout: **2s**. Retry: **2** tentativas, **300ms** de pausa. Lentidão simulada: **5s**.
- Ordem dos aspectos: `circuitBreaker=1` (externo), `retry=2`, `timeLimiter=3` (interno).
- 9 testes verdes no BFF. Stack: Java 25, Spring Boot 4.0.6, Resilience4j 2.4.0.
</content>
</invoke>
