package com.itau.bff;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class BffController {

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/dashboard")
    public Map<String, Object> getDashboard() {
        Map<String, Object> dashboard = new HashMap<>();
        List<String> indisponiveis = new ArrayList<>();

        // ── Saldo ──────────────────────────────────────────────────────
        try {
            Map<?, ?> saldo = restTemplate.getForObject("http://localhost:8080/saldo", Map.class);
            dashboard.put("saldo", saldo);
        } catch (Exception e) {
            indisponiveis.add("saldo");
            dashboard.put("saldo", Map.of(
                "conta", "---",
                "titular", "indisponível",
                "saldo", 0,
                "mensagem", "Serviço de saldo temporariamente indisponível.",
                "status", "CIRCUIT BREAKER ATIVO"
            ));
        }

        // ── Cartão ─────────────────────────────────────────────────────
        try {
            Map<?, ?> cartao = restTemplate.getForObject("http://localhost:8081/cartao", Map.class);
            dashboard.put("cartao", cartao);
        } catch (Exception e) {
            indisponiveis.add("cartão");
            dashboard.put("cartao", Map.of(
                "titular", "indisponível",
                "fatura_atual", 0,
                "limite", 0,
                "vencimento", "---",
                "mensagem", "Serviço de cartão temporariamente indisponível.",
                "status", "CIRCUIT BREAKER ATIVO"
            ));
        }

        // ── Investimentos ──────────────────────────────────────────────
        try {
            Map<?, ?> inv = restTemplate.getForObject("http://localhost:8082/investimentos", Map.class);
            dashboard.put("investimentos", inv);
        } catch (Exception e) {
            indisponiveis.add("investimentos");
            dashboard.put("investimentos", Map.of(
                "titular", "indisponível",
                "tesouro_direto", 0,
                "acoes", 0,
                "total_investido", 0,
                "mensagem", "Serviço de investimentos temporariamente indisponível.",
                "status", "CIRCUIT BREAKER ATIVO"
            ));
        }

        // ── Status geral ───────────────────────────────────────────────
        if (indisponiveis.isEmpty()) {
            dashboard.put("status", "todos os serviços operacionais");
        } else {
            String nomes = String.join(" e ", indisponiveis);
            dashboard.put("status", "degradado — " + indisponiveis.size()
                + " serviço(s) indisponível(is)");
            dashboard.put("servicosIndisponiveis", indisponiveis);
        }

        return dashboard;
    }
}
