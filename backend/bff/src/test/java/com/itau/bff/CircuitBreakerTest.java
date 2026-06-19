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
}
