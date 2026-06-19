package com.itau.bff;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
// @CrossOrigin permite que o browser chame este endpoint de outra origem (ex: localhost:5173).
// Sem isso, o browser bloquearia a resposta por política CORS.
@CrossOrigin(origins = "*")
public class BffController {

    private final ServicoBackend servicoBackend;

    // Spring injeta o ServicoBackend (que é um proxy AOP — veja a explicação no ServicoBackend.java)
    public BffController(ServicoBackend servicoBackend) {
        this.servicoBackend = servicoBackend;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> getDashboard() throws Exception {

        // CHAMADAS EM PARALELO — por que isso importa?
        // Se chamássemos os 3 serviços em sequência e cada um demorasse 1s,
        // o /dashboard demoraria 3s no total.
        // Em paralelo, o tempo total = tempo do serviço MAIS LENTO (máx ~1s).
        // CompletableFuture.supplyAsync() já está sendo chamado dentro de ServicoBackend,
        // então as 3 tarefas começam ao mesmo tempo quando chamamos os 3 métodos seguidos.
        CompletableFuture<Map<String, Object>> saldoFuture        = servicoBackend.buscarSaldo();
        CompletableFuture<Map<String, Object>> cartaoFuture       = servicoBackend.buscarCartao();
        CompletableFuture<Map<String, Object>> investimentosFuture = servicoBackend.buscarInvestimentos();

        // allOf() cria um Future que só completa quando TODOS os 3 completarem.
        // join() bloqueia a thread atual até isso acontecer.
        // Cada future sempre completa (com dados reais ou com o fallback do @CircuitBreaker),
        // então join() não vai lançar exceção nos casos normais.
        CompletableFuture.allOf(saldoFuture, cartaoFuture, investimentosFuture).join();

        Map<String, Object> saldo        = saldoFuture.get();
        Map<String, Object> cartao       = cartaoFuture.get();
        Map<String, Object> investimentos = investimentosFuture.get();

        Map<String, Object> dashboard = new HashMap<>();
        dashboard.put("saldo", saldo);
        dashboard.put("cartao", cartao);
        dashboard.put("investimentos", investimentos);

        // Status geral: "operacional" só se os 3 estiverem respondendo normalmente.
        // O frontend usa este campo para mostrar o banner de alerta no topo.
        boolean todosOk = "ok".equals(saldo.get("status"))
                && "ok".equals(cartao.get("status"))
                && "ok".equals(investimentos.get("status"));

        if (todosOk) {
            dashboard.put("status", "todos os serviços operacionais");
        } else {
            long indisponiveis = java.util.stream.Stream.of(saldo, cartao, investimentos)
                    .filter(m -> !"ok".equals(m.get("status")))
                    .count();
            dashboard.put("status", "degradado — " + indisponiveis + " serviço(s) indisponível(is)");
        }

        return dashboard;
    }
}
