package com.itau.servico_cartao;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class CartaoController {

    private final ModoFalha modoFalha;

    // Injetamos o "interruptor de falha" (recurso de demonstração).
    // Em condições normais ele está em NORMAL e não muda nada.
    public CartaoController(ModoFalha modoFalha) {
        this.modoFalha = modoFalha;
    }

    @GetMapping("/cartao")
    public Map<String, Object> getCartao() {
        // Antes de responder, checamos se a demonstração ativou alguma falha.
        aplicarFalhaSeAtiva();

        // Comportamento NORMAL: dados reais do cartão.
        return Map.of(
            "titular", "Bruno Ximenes",
            "fatura_atual", 2387.50,
            "limite", 15000.00,
            "vencimento", "15/07/2025",
            "status", "ok"
        );
    }

    // ------------------------------------------------------------------------
    // LÓGICA DE DEMONSTRAÇÃO — separada da resposta de negócio acima.
    // ------------------------------------------------------------------------
    // Por que isto fica num método à parte? Para deixar visível que é um
    // "enxerto" de demonstração, fácil de ler e de remover, sem se misturar
    // com a regra real do serviço.
    private void aplicarFalhaSeAtiva() {
        switch (modoFalha.getModo()) {

            // ERRO: lança HTTP 500. Do lado do BFF, o RestTemplate recebe um
            // erro 5xx, o @Retry tenta de novo, falha, e o @CircuitBreaker
            // registra a falha -> fallback com motivo SERVICO_FORA.
            case ERRO -> throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Falha simulada (modo de demonstração) — serviço fora do ar");

            // LENTIDAO: dorme 5s. O BFF tem timeout de 2s (@TimeLimiter), então
            // ele cancela a espera e dispara o fallback com motivo TIMEOUT.
            // Dormimos bem acima do timeout para a falha ser determinística.
            case LENTIDAO -> dormir(5000);

            // NORMAL: não faz nada, segue para a resposta real.
            case NORMAL -> { }
        }
    }

    // Helper que dorme tratando a InterruptedException (exigida pelo Thread.sleep).
    private void dormir(long milissegundos) {
        try {
            Thread.sleep(milissegundos);
        } catch (InterruptedException e) {
            // Restaura o "interrupted flag" — boa prática ao engolir InterruptedException.
            Thread.currentThread().interrupt();
        }
    }
}
