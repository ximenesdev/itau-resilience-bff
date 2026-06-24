package com.itau.bff;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeoutException;

// @Service registra esta classe como bean do Spring.
// Por que a lógica de resiliência fica num @Service separado do @RestController?
// As anotações @CircuitBreaker, @Retry e @TimeLimiter são interceptadas pelo AOP do Spring.
// O AOP funciona criando um PROXY: quando o Spring injeta este @Service no controller,
// ele entrega um "envelope" (proxy) que executa a lógica de resiliência ANTES de chamar
// o método real. Se a lógica ficasse no próprio controller chamando "this.metodo()",
// a chamada IGNORA o proxy e vai direto ao método — o AOP é bypassado e o
// Circuit Breaker nunca atua.
@Service
public class ServicoBackend {

    private final RestTemplate restTemplate;
    private final EstadoResiliencia estadoResiliencia;

    // URLs BASE de cada serviço de backend. Lidas da configuração com PADRÃO = localhost.
    // PORQUÊ: rodando local (sem Docker), o BFF acha os serviços em localhost:8080/8081/8082.
    // Dentro do Docker Compose, cada container só é alcançado pelo NOME do serviço na rede
    // interna (ex.: http://servico-saldo:8080) — o Compose sobrescreve estes valores via
    // variáveis de ambiente (SERVICOS_SALDO, SERVICOS_CARTAO, SERVICOS_INVESTIMENTOS).
    // O "relaxed binding" do Spring liga servicos.saldo <-> SERVICOS_SALDO automaticamente.
    // Assim o MESMO código roda nos dois ambientes sem alteração.
    @Value("${servicos.saldo:http://localhost:8080}")
    private String urlSaldo;
    @Value("${servicos.cartao:http://localhost:8081}")
    private String urlCartao;
    @Value("${servicos.investimentos:http://localhost:8082}")
    private String urlInvestimentos;

    // Spring injeta o RestTemplate (BffApplication) e o EstadoResiliencia (@Component).
    // O EstadoResiliencia guarda o motivo do último fallback para o painel ler.
    public ServicoBackend(RestTemplate restTemplate, EstadoResiliencia estadoResiliencia) {
        this.restTemplate = restTemplate;
        this.estadoResiliencia = estadoResiliencia;
    }

    // ==========================================================================
    // SERVIÇO DE SALDO
    // ==========================================================================

    // As 3 anotações formam uma cadeia de proteção em volta do método:
    //
    // @CircuitBreaker: monitora falhas. Se a taxa ultrapassar o threshold,
    //   o circuito "abre" e as próximas chamadas são bloqueadas imediatamente
    //   (sem nem tentar chegar ao serviço), chamando o fallbackSaldo.
    //
    // @TimeLimiter: limita o tempo de espera por uma resposta.
    //   Se o serviço demorar mais que timeoutDuration, cancela e dispara fallback.
    //   Requer que o método retorne CompletableFuture (execução assíncrona).
    //
    // @Retry: em caso de falha transitória (ex: serviço reiniciando), tenta
    //   novamente antes de desistir e registrar a falha no circuit breaker.
    @CircuitBreaker(name = "saldo", fallbackMethod = "fallbackSaldo")
    @TimeLimiter(name = "saldo")
    @Retry(name = "saldo")
    public CompletableFuture<Map<String, Object>> buscarSaldo() {
        // supplyAsync executa a chamada HTTP em outra thread (não bloqueia o servidor).
        // Isso é necessário para o @TimeLimiter conseguir cancelar a tarefa se demorar demais.
        return CompletableFuture.supplyAsync(() -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> resultado = (Map<String, Object>)
                restTemplate.getForObject(urlSaldo + "/saldo", Map.class);
            return resultado != null ? resultado : Map.of();
        });
    }

    // Fallback: chamado automaticamente quando buscarSaldo() falha por qualquer motivo.
    // A assinatura DEVE ter o mesmo nome-base + "Throwable" como parâmetro extra.
    // O tipo de retorno DEVE ser igual ao do método original (CompletableFuture<Map<...>>).
    public CompletableFuture<Map<String, Object>> fallbackSaldo(Throwable t) {
        Map<String, Object> fallback = new HashMap<>();
        // Campos que o frontend espera para o card de saldo
        fallback.put("conta", "---");
        fallback.put("titular", "indisponível");
        fallback.put("saldo", 0);
        fallback.put("status", "CIRCUIT BREAKER ATIVO");
        preencherMotivo("saldo", fallback, t);
        return CompletableFuture.completedFuture(fallback);
    }

    // ==========================================================================
    // SERVIÇO DE CARTÃO
    // ==========================================================================

    @CircuitBreaker(name = "cartao", fallbackMethod = "fallbackCartao")
    @TimeLimiter(name = "cartao")
    @Retry(name = "cartao")
    public CompletableFuture<Map<String, Object>> buscarCartao() {
        return CompletableFuture.supplyAsync(() -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> resultado = (Map<String, Object>)
                restTemplate.getForObject(urlCartao + "/cartao", Map.class);
            return resultado != null ? resultado : Map.of();
        });
    }

    public CompletableFuture<Map<String, Object>> fallbackCartao(Throwable t) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("fatura_atual", "indisponível");
        fallback.put("titular", "indisponível");
        fallback.put("limite", 0);
        fallback.put("vencimento", "---");
        fallback.put("status", "CIRCUIT BREAKER ATIVO");
        preencherMotivo("cartao", fallback, t);
        return CompletableFuture.completedFuture(fallback);
    }

    // ==========================================================================
    // SERVIÇO DE INVESTIMENTOS
    // ==========================================================================

    @CircuitBreaker(name = "investimentos", fallbackMethod = "fallbackInvestimentos")
    @TimeLimiter(name = "investimentos")
    @Retry(name = "investimentos")
    public CompletableFuture<Map<String, Object>> buscarInvestimentos() {
        return CompletableFuture.supplyAsync(() -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> resultado = (Map<String, Object>)
                restTemplate.getForObject(urlInvestimentos + "/investimentos", Map.class);
            return resultado != null ? resultado : Map.of();
        });
    }

    public CompletableFuture<Map<String, Object>> fallbackInvestimentos(Throwable t) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("titular", "indisponível");
        fallback.put("tesouro_direto", 0);
        fallback.put("acoes", 0);
        fallback.put("total_investido", 0);
        fallback.put("status", "CIRCUIT BREAKER ATIVO");
        preencherMotivo("investimentos", fallback, t);
        return CompletableFuture.completedFuture(fallback);
    }

    // ==========================================================================
    // HELPER: diferencia o motivo da falha
    // ==========================================================================

    // Por que diferenciar os motivos?
    // Em uma entrevista: demonstra que você entende os 3 estados do circuit breaker.
    // No dashboard: o frontend pode mostrar mensagens específicas ao usuário.
    // O campo "status" permanece "CIRCUIT BREAKER ATIVO" em todos os casos
    // para manter compatibilidade com o frontend (que checa esse valor para pintar
    // o card de vermelho). O campo "motivo" é o detalhe técnico.
    private void preencherMotivo(String circuito, Map<String, Object> fallback, Throwable t) {
        if (t instanceof CallNotPermittedException) {
            // Circuito ABERTO: Resilience4j bloqueou a chamada sem nem tentar.
            // Isso acontece quando a taxa de falha ultrapassou o failureRateThreshold.
            // O objetivo é proteger o sistema: não faz sentido continuar batendo num
            // serviço que está consistentemente falhando.
            fallback.put("motivo", "CIRCUITO_ABERTO");
            fallback.put("mensagem", "Muitas falhas detectadas — circuito aberto para proteger o sistema");

        } else if (t instanceof TimeoutException || t instanceof CancellationException) {
            // TIMEOUT: o serviço não respondeu dentro do prazo configurado (timeoutDuration).
            // CancellationException também pode ocorrer quando o TimeLimiter cancela a tarefa
            // assíncrona por estouro de tempo.
            fallback.put("motivo", "TIMEOUT");
            fallback.put("mensagem", "Serviço não respondeu a tempo — tente novamente em instantes");

        } else {
            // SERVIÇO FORA: conexão recusada, erro HTTP 5xx, ou qualquer outra exceção.
            // Este é o caso mais comum quando o processo Java do serviço está parado.
            fallback.put("motivo", "SERVICO_FORA");
            fallback.put("mensagem", "Serviço temporariamente indisponível — exibindo dados de contingência");
        }

        // Guarda o motivo deste fallback para o painel de resiliência poder exibir
        // "último motivo" de cada circuito. (O registry do Resilience4j não guarda isto.)
        estadoResiliencia.registrarMotivo(circuito, (String) fallback.get("motivo"));
    }
}
