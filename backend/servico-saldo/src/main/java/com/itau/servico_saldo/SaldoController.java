package com.itau.servico_saldo;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class SaldoController {

    @GetMapping("/saldo")
    public Map<String, Object> getSaldo() {
        return Map.of(
            "conta", "001-234567-8",
            "titular", "Bruno Ximenes",
            "saldo", 12450.75,
            "status", "ok"
        );
    }
}
