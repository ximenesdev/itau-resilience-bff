package com.itau.servico_investimentos;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class InvestimentosController {

    @GetMapping("/investimentos")
    public Map<String, Object> getInvestimentos() {
        return Map.of(
            "titular", "Bruno Ximenes",
            "tesouro_direto", 8500.00,
            "acoes", 4200.00,
            "total_investido", 12700.00,
            "status", "ok"
        );
    }
}
