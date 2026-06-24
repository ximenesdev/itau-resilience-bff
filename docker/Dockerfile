# syntax=docker/dockerfile:1
# =============================================================================
# Dockerfile REUTILIZÁVEL (multi-stage) para os 4 serviços backend.
# =============================================================================
# Um único Dockerfile serve os 4 serviços — o compose.yml passa qual módulo
# compilar via ARG MODULE (ex.: backend:bff). Evita 4 arquivos quase idênticos.
#
# São DOIS estágios:
#   1) BUILDER  = a cozinha bagunçada: tem o JDK inteiro, baixa dependências,
#                 compila o código e gera o .jar. Fica pesada, mas é descartada.
#   2) RUNTIME  = o prato limpo que vai à mesa: só o JRE (leve) + o app pronto.
# A imagem final leva SÓ o estágio 2 — nada da bagunça do builder vai junto.
# =============================================================================

# ---------- Estágio 1: BUILDER (a cozinha) ----------
FROM eclipse-temurin:25-jdk AS builder
WORKDIR /workspace

# Qual módulo este build vai compilar (ex.: backend:bff). Vem do compose.yml.
ARG MODULE

# 1) Copia PRIMEIRO só os arquivos que DESCREVEM o build (não o código-fonte).
#    PORQUÊ: o Docker cacheia cada etapa em camadas. Se o código muda mas as
#    dependências não, ele reaproveita a camada de dependências já baixadas —
#    builds seguintes ficam muito mais rápidos. É como deixar a despensa
#    abastecida antes de começar a cozinhar.
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
COPY backend/bff/build.gradle ./backend/bff/build.gradle
COPY backend/servico-saldo/build.gradle ./backend/servico-saldo/build.gradle
COPY backend/servico-cartao/build.gradle ./backend/servico-cartao/build.gradle
COPY backend/servico-investimentos/build.gradle ./backend/servico-investimentos/build.gradle

# Corrige quebras de linha do Windows (CRLF) no gradlew e dá permissão de execução.
# Sem isso, o script falha no Linux com "bad interpreter: No such file or directory".
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew

# Baixa as dependências do módulo alvo (aquece o cache do Gradle).
# --mount=type=cache mantém o ~/.gradle ENTRE builds (não rebaixa tudo sempre).
# "|| true": se a task variar, não queremos quebrar aqui — o objetivo é só baixar.
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew :${MODULE}:dependencies --no-daemon || true

# 2) Agora copia o código-fonte e compila SÓ o módulo alvo (bootJar = jar executável).
COPY backend ./backend
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew :${MODULE}:bootJar --no-daemon

# 3) Extrai o jar em CAMADAS (Spring Boot 4 usa jarmode=tools; o antigo layertools
#    foi deprecado). Separar as dependências (mudam pouco) do código da aplicação
#    (muda muito) deixa as imagens mais eficientes para rebuild e push.
#    grep -v plain ignora o jar "magro" auxiliar e pega o executável de verdade.
RUN JAR=$(ls backend/*/build/libs/*.jar | grep -v plain | head -n 1) \
 && cp "$JAR" application.jar \
 && java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# ---------- Estágio 2: RUNTIME (o prato limpo) ----------
FROM eclipse-temurin:25-jre AS runtime
WORKDIR /application

# Porta exposta (documentação). Vem do compose.yml.
ARG PORTA=8080

# Cria um usuário NÃO-ROOT dedicado. PORQUÊ: se a aplicação for comprometida,
# o invasor não cai como root dentro do container. Boa prática de segurança.
RUN groupadd --system spring && useradd --system --gid spring spring

# Copia as 4 camadas extraídas (cada COPY vira uma layer Docker separada, então
# o Docker só rebaixa o que mudou). A pasta application/ traz o application.jar.
COPY --from=builder /workspace/extracted/dependencies/ ./
COPY --from=builder /workspace/extracted/spring-boot-loader/ ./
COPY --from=builder /workspace/extracted/snapshot-dependencies/ ./
COPY --from=builder /workspace/extracted/application/ ./

USER spring:spring
EXPOSE ${PORTA}

# Flags de JVM cientes de CONTAINER (boa prática 2026):
# - UseContainerSupport: a JVM respeita os limites de CPU/RAM DO CONTAINER
#   (sem isso, ela enxerga a máquina inteira e pode estourar a memória).
# - MaxRAMPercentage=75: usa até 75% da RAM do container para o heap.
# - ExitOnOutOfMemoryError: se faltar memória, o processo MORRE (e o Docker
#   reinicia) em vez de ficar num estado zumbi, mascarando o problema.
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "application.jar"]
