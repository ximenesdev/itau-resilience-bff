package com.itau.servico_cartao;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class CartaoController {

    @GetMapping("/cartao")
    public Map<String, Object> getCartao() {
        return Map.of(
            "titular", "Bruno Ximenes",
            "fatura_atual", 2387.50,
            "limite", 15000.00,
            "vencimento", "15/07/2025",
            "mensagem", "Serviço operacional",
            "status", "ok"
        );
    }
}
