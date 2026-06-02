package com.itau.bff;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import java.util.HashMap;
import java.util.Map;

@RestController
public class BffController {

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/dashboard")
    public Map<String, Object> getDashboard() {

        Map<String, Object> dashboard = new HashMap<>();
        int falhas = 0;

        try {
            Map saldo = restTemplate.getForObject("http://localhost:8080/saldo", Map.class);
            dashboard.put("saldo", saldo);
        } catch (Exception e) {
            falhas++;
            dashboard.put("saldo", Map.of(
                "conta", "---",
                "titular", "indisponível",
                "saldo", 0,
                "status", "CIRCUIT BREAKER ATIVO"
            ));
        }

        try {
            Map cartao = restTemplate.getForObject("http://localhost:8081/cartao", Map.class);
            dashboard.put("cartao", cartao);
        } catch (Exception e) {
            falhas++;
            dashboard.put("cartao", Map.of(
                "fatura_atual", "indisponível",
                "mensagem", "Estamos atualizando sua fatura, tente novamente em instantes",
                "status", "CIRCUIT BREAKER ATIVO"
            ));
        }

        try {
            Map investimentos = restTemplate.getForObject("http://localhost:8082/investimentos", Map.class);
            dashboard.put("investimentos", investimentos);
        } catch (Exception e) {
            falhas++;
            dashboard.put("investimentos", Map.of(
                "titular", "indisponível",
                "tesouro_direto", 0,
                "acoes", 0,
                "total_investido", 0,
                "status", "CIRCUIT BREAKER ATIVO"
            ));
        }

        if (falhas == 0) {
            dashboard.put("status", "todos os serviços operacionais");
        } else {
            dashboard.put("status", "degradado — " + falhas + " serviço(s) indisponível(is)");
        }

        return dashboard;
    }
}
