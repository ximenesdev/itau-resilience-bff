package com.itau.bff;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// Teste PURO com Mockito — sem Spring, sem contexto, sem servidor.
// Por que assim? É muito mais rápido (milissegundos vs segundos) e testa
// apenas a lógica do controller, sem ruído de infraestrutura.
// A "desvantagem" é que as anotações @CircuitBreaker não atuam aqui —
// isso é correto, porque este teste não é sobre o CB, é sobre a lógica
// de montar o JSON de resposta do /dashboard.
class BffControllerTest {

    private ServicoBackend servicoBackend;
    private BffController controller;

    @BeforeEach
    void setUp() {
        // Instancia tudo manualmente — sem Spring, sem @Autowired
        servicoBackend = mock(ServicoBackend.class);
        controller = new BffController(servicoBackend);
    }

    @Test
    void dashboardRetornaStatusOperacionalQuandoTodosOsServicosResponderam() throws Exception {
        // Arrange: os 3 mocks retornam dados normais com status "ok"
        when(servicoBackend.buscarSaldo()).thenReturn(
            CompletableFuture.completedFuture(Map.of("status", "ok", "saldo", 12450.75)));
        when(servicoBackend.buscarCartao()).thenReturn(
            CompletableFuture.completedFuture(Map.of("status", "ok", "fatura_atual", 2387.50)));
        when(servicoBackend.buscarInvestimentos()).thenReturn(
            CompletableFuture.completedFuture(Map.of("status", "ok", "total_investido", 12700.0)));

        // Act
        Map<String, Object> resultado = controller.getDashboard();

        // Assert: os 3 blocos de dados estão presentes e o status é operacional
        assertThat(resultado).containsKeys("saldo", "cartao", "investimentos");
        assertThat(resultado.get("status")).isEqualTo("todos os serviços operacionais");
    }

    @Test
    void dashboardRetornaStatusDegradadoQuandoSaldoEstaFora() throws Exception {
        // Arrange: saldo retorna fallback (como o @CircuitBreaker faria em produção)
        when(servicoBackend.buscarSaldo()).thenReturn(
            CompletableFuture.completedFuture(Map.of("status", "CIRCUIT BREAKER ATIVO", "motivo", "SERVICO_FORA")));
        when(servicoBackend.buscarCartao()).thenReturn(
            CompletableFuture.completedFuture(Map.of("status", "ok")));
        when(servicoBackend.buscarInvestimentos()).thenReturn(
            CompletableFuture.completedFuture(Map.of("status", "ok")));

        // Act
        Map<String, Object> resultado = controller.getDashboard();

        // Assert: status reflete que 1 serviço está indisponível
        assertThat(resultado.get("status").toString()).contains("degradado");
        assertThat(resultado.get("status").toString()).contains("1");
    }

    @Test
    void dashboardRetornaStatusDegradadoQuandoTodosEstaoFora() throws Exception {
        // Arrange: os 3 retornam fallback
        Map<String, Object> fallback = Map.of("status", "CIRCUIT BREAKER ATIVO");
        when(servicoBackend.buscarSaldo()).thenReturn(CompletableFuture.completedFuture(fallback));
        when(servicoBackend.buscarCartao()).thenReturn(CompletableFuture.completedFuture(fallback));
        when(servicoBackend.buscarInvestimentos()).thenReturn(CompletableFuture.completedFuture(fallback));

        // Act
        Map<String, Object> resultado = controller.getDashboard();

        // Assert: 3 indisponíveis
        assertThat(resultado.get("status").toString()).contains("3");
    }
}
