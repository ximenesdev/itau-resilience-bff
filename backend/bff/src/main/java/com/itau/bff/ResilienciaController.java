package com.itau.bff;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// ============================================================================
// CONTROLADOR DO PAINEL DE RESILIÊNCIA (suporta a tela "Modo Demonstração")
// ============================================================================
// Este controller é o "cérebro" do painel ao vivo. Ele faz duas coisas:
//
// 1) OBSERVAR  -> GET /resiliencia/circuitos
//    Lê o estado e as métricas de cada circuit breaker e devolve um JSON limpo
//    para o frontend desenhar (CLOSED/OPEN/HALF_OPEN, taxa de falha, etc).
//
// 2) CONTROLAR -> POST /resiliencia/falha/{servico}/ativar|desativar
//    Repassa o comando de injeção de falha para o serviço de backend certo.
//
// POR QUE PASSAR O CONTROLE DE FALHA PELO BFF?
// Esse é o próprio espírito do padrão BFF (Backend For Frontend): o frontend
// conversa com UM só backend (o BFF, porta 8083) e não precisa saber em que
// porta cada microsserviço vive. Isso evita também problemas de CORS e deixa
// o frontend mais simples. O BFF é quem conhece o "mapa" dos serviços.
//
// POR QUE NÃO USAR /actuator/circuitbreakers DIRETO?
// Aquele endpoint do Actuator só devolve a LISTA DE NOMES dos circuitos, não os
// estados. E o /actuator/health vira HTTP 503 quando um circuito abre — o que
// faria o painel parecer "quebrado" justo na hora da demonstração. Por isso
// expomos aqui uma visão própria, limpa e estável, lendo o registry direto.
@RestController
@CrossOrigin(origins = "*")
public class ResilienciaController {

    private final CircuitBreakerRegistry registry;
    private final EstadoResiliencia estadoResiliencia;
    private final RestTemplate restTemplate;

    // Mapa "nome do serviço -> endereço base". O BFF é quem conhece as portas.
    // LinkedHashMap mantém a ordem (saldo, cartao, investimentos) na resposta.
    private static final Map<String, String> ENDERECOS = new LinkedHashMap<>();
    static {
        ENDERECOS.put("saldo", "http://localhost:8080");
        ENDERECOS.put("cartao", "http://localhost:8081");
        ENDERECOS.put("investimentos", "http://localhost:8082");
    }

    public ResilienciaController(CircuitBreakerRegistry registry,
                                 EstadoResiliencia estadoResiliencia,
                                 RestTemplate restTemplate) {
        this.registry = registry;
        this.estadoResiliencia = estadoResiliencia;
        this.restTemplate = restTemplate;
    }

    // ------------------------------------------------------------------------
    // 1) OBSERVAR — estado e métricas de cada circuito
    // ------------------------------------------------------------------------
    @GetMapping("/resiliencia/circuitos")
    public Map<String, Object> getCircuitos() {
        List<Map<String, Object>> circuitos = ENDERECOS.keySet().stream()
            .map(this::montarInfoCircuito)
            .toList();

        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("circuitos", circuitos);
        return resposta;
    }

    // Lê um circuito do registry e monta o "retrato" dele para o painel.
    private Map<String, Object> montarInfoCircuito(String nome) {
        CircuitBreaker cb = registry.circuitBreaker(nome);
        CircuitBreaker.Metrics m = cb.getMetrics();

        Map<String, Object> info = new LinkedHashMap<>();
        info.put("nome", nome);
        // Estado: CLOSED (saudável), OPEN (isolado), HALF_OPEN (testando recuperação).
        info.put("estado", cb.getState().name());
        // Taxa de falha em %. Vem -1 quando ainda não houve chamadas suficientes
        // (minimumNumberOfCalls) para o cálculo ser confiável.
        info.put("taxaFalha", m.getFailureRate());
        // Quantas chamadas estão na janela deslizante agora.
        info.put("chamadasNaJanela", m.getNumberOfBufferedCalls());
        info.put("chamadasComFalha", m.getNumberOfFailedCalls());
        info.put("chamadasComSucesso", m.getNumberOfSuccessfulCalls());
        // Motivo do último fallback (SERVICO_FORA / TIMEOUT / CIRCUITO_ABERTO) ou null.
        info.put("ultimoMotivo", estadoResiliencia.getUltimoMotivo(nome));
        return info;
    }

    // ------------------------------------------------------------------------
    // 2) CONTROLAR — liga/desliga a injeção de falha de cada serviço
    // ------------------------------------------------------------------------
    @PostMapping("/resiliencia/falha/{servico}/ativar")
    public Map<String, Object> ativarFalha(@PathVariable String servico,
                                           @RequestParam String modo) {
        String base = resolverEndereco(servico);
        // Repassa o comando para o serviço de backend correspondente.
        return repassar(base + "/admin/falha/ativar?modo=" + modo, servico);
    }

    @PostMapping("/resiliencia/falha/{servico}/desativar")
    public Map<String, Object> desativarFalha(@PathVariable String servico) {
        String base = resolverEndereco(servico);
        return repassar(base + "/admin/falha/desativar", servico);
    }

    // ------------------------------------------------------------------------
    // STATUS agregado dos modos de falha dos 3 serviços (para o painel sincronizar)
    // ------------------------------------------------------------------------
    @GetMapping("/resiliencia/falha/status")
    public Map<String, Object> statusFalhas() {
        Map<String, Object> resultado = new LinkedHashMap<>();
        for (var entrada : ENDERECOS.entrySet()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> status = restTemplate.getForObject(
                        entrada.getValue() + "/admin/falha/status", Map.class);
                resultado.put(entrada.getKey(),
                        status != null ? status.get("modo") : "DESCONHECIDO");
            } catch (Exception e) {
                // Se o serviço estiver fora (processo parado), reportamos isso —
                // não é um modo de falha "ativado", é o processo realmente morto.
                resultado.put(entrada.getKey(), "INDISPONIVEL");
            }
        }
        return resultado;
    }

    // ------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------

    // Garante que só aceitamos serviços conhecidos; senão devolve 400 em vez de NPE.
    private String resolverEndereco(String servico) {
        String base = ENDERECOS.get(servico);
        if (base == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Serviço desconhecido: '" + servico + "'. Use saldo, cartao ou investimentos.");
        }
        return base;
    }

    // Faz a chamada POST ao serviço e devolve a resposta. Se o serviço estiver
    // fora, devolve uma mensagem clara em vez de estourar uma exceção crua.
    @SuppressWarnings("unchecked")
    private Map<String, Object> repassar(String url, String servico) {
        try {
            Map<String, Object> resposta = restTemplate.postForObject(url, null, Map.class);
            return resposta != null ? resposta : Map.of("servico", servico, "modo", "DESCONHECIDO");
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Não foi possível falar com o serviço '" + servico + "'. Ele está rodando?");
        }
    }
}
