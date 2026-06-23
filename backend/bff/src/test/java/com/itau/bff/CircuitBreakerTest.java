package com.itau.bff;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atMost;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// @SpringBootTest sobe o contexto Spring COMPLETO, incluindo os proxies AOP do Resilience4j.
// Isso é necessário para que @CircuitBreaker e @Retry realmente atuem nas chamadas.
// É mais lento que testes com Mockito puro, mas é o único jeito de testar o comportamento
// real do circuit breaker sem reimplementar toda a lógica do Resilience4j.
@SpringBootTest
class CircuitBreakerTest {

    // O Spring injeta o ServicoBackend ENVOLVIDO pelo proxy AOP do Resilience4j.
    // Quando chamamos servicoBackend.buscarSaldo(), a chamada passa pelos interceptors
    // de @CircuitBreaker, @TimeLimiter e @Retry antes de chegar ao método real.
    @Autowired
    private ServicoBackend servicoBackend;

    // @MockitoBean substitui o bean RestTemplate registrado em BffApplication
    // por um mock do Mockito dentro do contexto Spring.
    // Isso permite controlar exatamente o que o RestTemplate "responde" em cada teste.
    // (Substitui o @MockBean do Spring Boot 3 — no Boot 4, usa-se @MockitoBean)
    @MockitoBean
    private RestTemplate restTemplate;

    // O CircuitBreakerRegistry guarda o estado (OPEN/CLOSED/HALF_OPEN) de cada circuito.
    // Usamos para verificar o estado após os testes E para resetar entre testes.
    @Autowired
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @BeforeEach
    void resetarCircuito() {
        // Reseta o circuito para CLOSED antes de cada teste.
        // Sem isso, um teste que abre o circuito "contamina" os testes seguintes.
        circuitBreakerRegistry.circuitBreaker("saldo").reset();
        circuitBreakerRegistry.circuitBreaker("cartao").reset();
        circuitBreakerRegistry.circuitBreaker("investimentos").reset();
    }

    @Test
    void fallbackRetornaMotivoCertoQuandoServicoEstaFora() throws Exception {
        // Arrange: mock lança exceção (simula serviço com processo Java parado)
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenThrow(new RuntimeException("Connection refused: localhost/127.0.0.1:8080"));

        // Act: chama o método (que vai falhar e acionar o fallback via @CircuitBreaker)
        Map<String, Object> resultado = servicoBackend.buscarSaldo().get();

        // Assert: fallback foi acionado com o motivo correto
        assertThat(resultado.get("status")).isEqualTo("CIRCUIT BREAKER ATIVO");
        assertThat(resultado.get("motivo")).isEqualTo("SERVICO_FORA");
        assertThat(resultado.get("mensagem")).asString().isNotBlank();
        // Campos esperados pelo frontend
        assertThat(resultado).containsKeys("conta", "titular", "saldo");
    }

    @Test
    void circuitoAbreAposMinimumNumberOfCallsFalhas() throws Exception {
        // Arrange: mock sempre lança exceção
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenThrow(new RuntimeException("Service Unavailable"));

        // Act: chama 5 vezes (= minimumNumberOfCalls configurado no application.yml).
        // Com maxAttempts=2 no @Retry, cada chamada ao servicoBackend dispara até
        // 2 tentativas ao restTemplate — mas o CircuitBreaker vê apenas 1 resultado
        // por chamada ao servicoBackend (o resultado final após retries).
        for (int i = 0; i < 5; i++) {
            Map<String, Object> r = servicoBackend.buscarSaldo().get();
            // Cada uma das 5 chamadas deve retornar fallback de serviço fora
            assertThat(r.get("status")).isEqualTo("CIRCUIT BREAKER ATIVO");
        }

        // Assert: após 5 falhas (100% > 50% threshold), circuito deve estar ABERTO
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("saldo");
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.OPEN);

        // A próxima chamada é bloqueada pelo circuito ABERTO — nem chega ao RestTemplate
        Map<String, Object> resultadoBloqueado = servicoBackend.buscarSaldo().get();
        assertThat(resultadoBloqueado.get("status")).isEqualTo("CIRCUIT BREAKER ATIVO");
        assertThat(resultadoBloqueado.get("motivo")).isEqualTo("CIRCUITO_ABERTO");

        // Prova que a 6ª chamada NÃO chegou ao RestTemplate (circuito bloqueou).
        // Com @Retry maxAttempts=2, as 5 chamadas anteriores = 10 tentativas ao mock.
        // A 6ª é bloqueada antes de chegar ao RestTemplate.
        verify(restTemplate, atMost(10)).getForObject(anyString(), eq(Map.class));
    }

    // ==========================================================================
    // PROVA DA ORDEM DOS ASPECTOS: CircuitBreaker é o MAIS EXTERNO
    // ==========================================================================
    // Este teste é a "prova" da decisão de design registrada no application.yml.
    // Configuramos a cadeia CircuitBreaker( Retry( TimeLimiter( chamada ) ) ).
    // Por que essa ordem importa tanto?
    //   - O fallback mora no @CircuitBreaker. No padrão do Resilience4j o Retry
    //     fica POR FORA do CB e, quando o CB devolve o fallback como "sucesso",
    //     o Retry nunca enxerga a falha e NÃO tenta de novo (maxAttempts vira
    //     config morta). Colocando o CB por fora, o Retry passa a ver a falha crua.
    // Duas coisas são provadas aqui:
    //   1) o Retry REALMENTE refaz a chamada (2 chamadas HTTP);
    //   2) o CircuitBreaker conta isso como UMA ÚNICA falha (requisição lógica),
    //      não uma por tentativa.
    @Test
    void circuitBreakerContaUmaFalhaPorRequisicaoMesmoComRetry() throws Exception {
        // Arrange: o serviço sempre falha → o @Retry (maxAttempts=2) deve tentar 2x
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenThrow(new RuntimeException("Connection refused"));

        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("saldo");

        // Act: UMA única chamada lógica ao BFF
        servicoBackend.buscarSaldo().get();

        // Assert 1: o RestTemplate foi chamado 2x → o Retry está POR DENTRO do CB
        // e enxergou a falha crua, então refez a chamada (prova que maxAttempts=2
        // está realmente em vigor, e não é configuração morta).
        verify(restTemplate, times(2)).getForObject(anyString(), eq(Map.class));

        // Assert 2: apesar das 2 chamadas HTTP, o disjuntor registrou EXATAMENTE
        // 1 falha. Prova que o CB envolve o Retry: ele só enxerga o resultado FINAL
        // da requisição lógica, não cada tentativa individual. (As métricas do CB
        // são zeradas no @BeforeEach via reset(), então esta contagem é só deste teste.)
        assertThat(cb.getMetrics().getNumberOfFailedCalls()).isEqualTo(1);
    }

    // ==========================================================================
    // TIMEOUT: serviço lento aciona o fallback com motivo TIMEOUT
    // ==========================================================================
    @Test
    void timeoutAcionaFallbackComMotivoTimeout() throws Exception {
        // Arrange: o serviço "responde", mas DEMORA mais que o timeoutDuration (2s).
        // Simulamos isso fazendo o mock dormir 3s antes de devolver a resposta.
        // O @TimeLimiter deve cancelar a espera em 2s e tratar como falha.
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenAnswer(invocation -> {
                Thread.sleep(3000);
                return Map.of("status", "ok");
            });

        // Act: como o serviço nunca responde a tempo, o fallback é acionado
        Map<String, Object> resultado = servicoBackend.buscarSaldo().get();

        // Assert: o fallback foi acionado especificamente por TIMEOUT.
        // Prova que o @TimeLimiter está protegendo o BFF de threads presas em
        // serviços lentos — e que distinguimos esse caso de um serviço fora do ar.
        assertThat(resultado.get("status")).isEqualTo("CIRCUIT BREAKER ATIVO");
        assertThat(resultado.get("motivo")).isEqualTo("TIMEOUT");
    }

    // ==========================================================================
    // CICLO DE RECUPERAÇÃO: OPEN -> HALF_OPEN -> CLOSED
    // ==========================================================================
    // Demonstra o estado HALF_OPEN, que é o que torna o circuit breaker
    // "auto-curável": depois de um tempo aberto, ele deixa passar algumas chamadas
    // de teste; se o serviço se recuperou, o circuito fecha sozinho.
    @Test
    void circuitoFechaNovamenteQuandoServicoSeRecuperaNoHalfOpen() throws Exception {
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("saldo");

        // Arrange 1: serviço fora do ar. Usamos doThrow(...).when(...) (em vez de
        // when(...).thenThrow) porque vamos RE-configurar o mock no meio do teste —
        // e o estilo when(...) executaria o stub que lança exceção durante a própria
        // reconfiguração, quebrando o teste.
        doThrow(new RuntimeException("Service Unavailable"))
            .when(restTemplate).getForObject(anyString(), eq(Map.class));

        // Act 1: 5 falhas (= minimumNumberOfCalls, 100% > 50%) → circuito ABRE
        for (int i = 0; i < 5; i++) {
            servicoBackend.buscarSaldo().get();
        }
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.OPEN);

        // Act 2: forçamos a transição para HALF_OPEN. Em produção isso ocorre
        // sozinho após waitDurationInOpenState (10s); no teste forçamos para não
        // precisar esperar 10 segundos reais.
        cb.transitionToHalfOpenState();
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.HALF_OPEN);

        // Arrange 2: o serviço se RECUPEROU — agora volta a responder normalmente.
        doReturn(Map.of("status", "ok", "saldo", 100))
            .when(restTemplate).getForObject(anyString(), eq(Map.class));

        // Act 3: no HALF_OPEN são permitidas permittedNumberOfCallsInHalfOpenState=3
        // chamadas de teste. Como todas têm sucesso, o circuito deve fechar.
        for (int i = 0; i < 3; i++) {
            Map<String, Object> r = servicoBackend.buscarSaldo().get();
            assertThat(r.get("status")).isEqualTo("ok");
        }

        // Assert: serviço recuperado + chamadas de teste OK → circuito volta a CLOSED,
        // restabelecendo o tráfego normal automaticamente.
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }
}
