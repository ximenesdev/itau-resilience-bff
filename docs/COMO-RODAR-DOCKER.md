# Como rodar com Docker Compose

Este guia sobe os **4 serviços backend** (saldo, cartão, investimentos e BFF) em
containers, com **um único comando**, sem precisar abrir vários terminais.

> O **frontend** (React/Vite) **não** é containerizado nesta fase — ele roda em modo
> desenvolvimento com `npm run dev` e conversa com o BFF em `localhost:8083`.

---

## Pré-requisitos
- **Docker** e **Docker Compose** instalados e **rodando** (no Windows, o Docker
  Desktop com WSL2). Verifique com:
  ```bash
  docker version
  docker compose version
  ```

## ⚠️ Antes de subir: libere as portas 8080–8083
Se você estiver rodando os serviços localmente (pelo `./gradlew` — no Windows,
`gradlew.bat` — ou pelo IntelliJ), **pare todos eles primeiro**. O Compose mapeia as portas `8080`, `8081`, `8082` e `8083`
para o host; se já houver algo nelas, o Docker acusa "port is already allocated".

---

## Subir tudo
Na **raiz do projeto**:
```bash
docker compose up --build
```
- `--build` força (re)construir as imagens. Use sempre que mudar código.
- A **primeira** vez demora alguns minutos (baixa as imagens base e as dependências do
  Gradle). As próximas são rápidas (o Docker reaproveita as camadas em cache).
- A ordem é automática: **saldo, cartão e investimentos sobem primeiro**; o **BFF só
  inicia depois que os três estão saudáveis** (`depends_on: service_healthy`).

Para rodar em segundo plano (libera o terminal):
```bash
docker compose up --build -d
docker compose logs -f bff   # acompanha os logs do BFF
```

## Testar
```bash
# Dados agregados pelo BFF (deve responder com saldo, cartão e investimentos)
curl http://localhost:8083/dashboard

# Estado dos circuit breakers
curl http://localhost:8083/resiliencia/circuitos
```

## Rodar o frontend apontando para o BFF containerizado
Em outro terminal:
```bash
cd frontend
npm run dev
```
Abra o endereço que o Vite mostrar (ex.: http://localhost:5173). O proxy de dev do Vite
já encaminha as chamadas de API para `localhost:8083` — que agora é o **BFF no container**.

## Demonstrar a resiliência (Circuit Breaker entre containers)
Na página **Resiliência** do frontend, injete uma falha (Erro 500 ou Lentidão) num serviço
e clique em **Atualizar** no Painel. Ou via terminal:
```bash
# Injeta erro no serviço de cartão (passando pelo BFF)
curl -X POST "http://localhost:8083/resiliencia/falha/cartao/ativar?modo=erro"
# Volta ao normal
curl -X POST http://localhost:8083/resiliencia/falha/cartao/desativar
```
Os fallbacks e a abertura do circuito funcionam **entre os containers** exatamente como
funcionavam local — porque o BFF agora acha os serviços pelos nomes da rede interna
(`http://servico-saldo:8080`, etc.), graças às variáveis de ambiente do `compose.yml`.

## Parar
```bash
docker compose down          # para e remove os containers
docker compose down --rmi local   # também remove as imagens construídas
```

---

## Como funciona (resumo)
- **`docker/Dockerfile`** — um Dockerfile **multi-stage reutilizável**. O estágio *builder*
  (JDK) compila só o módulo pedido e extrai o jar em camadas; o estágio *runtime* (JRE)
  leva só o app pronto, roda como usuário não-root e com flags de JVM cientes de container.
- **`compose.yml`** — descreve os 4 serviços, mapeia as portas, define o healthcheck
  (por porta aberta) e a ordem de subida.
- **URLs**: o BFF lê `servicos.saldo/cartao/investimentos` (padrão `localhost` no
  `application.yml`, para o modo local). No Compose, as variáveis `SERVICOS_SALDO`, etc.
  sobrescrevem para os nomes dos serviços na rede interna.

## O modo local (sem Docker) continua igual
Nada mudou para rodar sem Docker: cada serviço ainda sobe com `./gradlew ... bootRun`
(no Windows, `gradlew.bat`) apontando para `localhost`. A containerização é uma camada
a mais, opcional.
