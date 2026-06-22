package com.itau.bff;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// ============================================================================
// MEMÓRIA DO ÚLTIMO MOTIVO DE FALLBACK POR CIRCUITO
// ============================================================================
// Por que esta classe existe?
// O CircuitBreakerRegistry do Resilience4j sabe o ESTADO (CLOSED/OPEN/HALF_OPEN)
// e métricas numéricas (taxa de falha, nº de chamadas), MAS não guarda o "motivo"
// humano do último fallback (SERVICO_FORA, TIMEOUT, CIRCUITO_ABERTO).
//
// O painel de resiliência quer mostrar esse motivo. Então guardamos aqui, em
// memória, o último motivo registrado por cada circuito. O ServicoBackend escreve
// (quando um fallback acontece) e o ResilienciaController lê (quando o painel pede).
//
// Usamos ConcurrentHashMap porque várias threads (as 3 chamadas paralelas do
// /dashboard) podem escrever ao mesmo tempo — o ConcurrentHashMap é seguro para
// acesso concorrente sem precisarmos sincronizar na mão.
@Component
public class EstadoResiliencia {

    private final Map<String, String> ultimoMotivoPorCircuito = new ConcurrentHashMap<>();

    // Chamado pelo ServicoBackend sempre que um fallback é acionado.
    public void registrarMotivo(String circuito, String motivo) {
        ultimoMotivoPorCircuito.put(circuito, motivo);
    }

    // Chamado pelo ResilienciaController para montar a resposta do painel.
    // Retorna null se aquele circuito nunca disparou um fallback.
    public String getUltimoMotivo(String circuito) {
        return ultimoMotivoPorCircuito.get(circuito);
    }
}
