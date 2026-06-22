package com.itau.servico_investimentos;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Map;

// ============================================================================
// PAINEL DE ADMINISTRAÇÃO DA DEMONSTRAÇÃO (Fault Injection)
// ============================================================================
// Endpoints para LIGAR/DESLIGAR o modo de falha deste serviço ao vivo.
// Tudo isto é recurso de DEMONSTRAÇÃO (ver ModoFalha) — não é regra de negócio.
//
// Endpoints:
//   POST /admin/falha/ativar?modo=erro      -> passa a responder HTTP 500
//   POST /admin/falha/ativar?modo=lentidao  -> passa a dormir além do timeout
//   POST /admin/falha/desativar             -> volta ao normal
//   GET  /admin/falha/status                -> diz o estado atual
@RestController
@CrossOrigin(origins = "*")
public class AdminFalhaController {

    private final ModoFalha modoFalha;

    // Spring injeta o mesmo bean ModoFalha que o InvestimentosController usa.
    // É um singleton: o estado ligado aqui é o mesmo que o /investimentos vai ler.
    public AdminFalhaController(ModoFalha modoFalha) {
        this.modoFalha = modoFalha;
    }

    @PostMapping("/admin/falha/ativar")
    public Map<String, Object> ativar(@RequestParam String modo) {
        // Converte o texto recebido ("erro"/"lentidao") para o enum.
        // Se vier algo inválido, devolvemos 400 (Bad Request) em vez de quebrar.
        ModoFalha.Modo novoModo;
        switch (modo.toLowerCase()) {
            case "erro"     -> novoModo = ModoFalha.Modo.ERRO;
            case "lentidao" -> novoModo = ModoFalha.Modo.LENTIDAO;
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Modo inválido: '" + modo + "'. Use 'erro' ou 'lentidao'.");
        }
        modoFalha.ativar(novoModo);
        return status();
    }

    @PostMapping("/admin/falha/desativar")
    public Map<String, Object> desativar() {
        modoFalha.desativar();
        return status();
    }

    @GetMapping("/admin/falha/status")
    public Map<String, Object> status() {
        return Map.of(
            "servico", "investimentos",
            "modo", modoFalha.getModo().name()
        );
    }
}
