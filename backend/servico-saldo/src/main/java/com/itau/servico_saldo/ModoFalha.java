package com.itau.servico_saldo;

import org.springframework.stereotype.Component;

// ============================================================================
// RECURSO DE DEMONSTRAÇÃO (Fault Injection / Chaos Engineering)
// ============================================================================
// ATENÇÃO: esta classe NÃO faz parte da lógica de negócio do serviço.
// Ela existe só para a DEMONSTRAÇÃO de resiliência: permite "quebrar" o serviço
// ao vivo, sem reiniciar nada, para mostrar o Circuit Breaker do BFF reagindo.
//
// Em produção este componente não existiria. Mantemos ele isolado numa classe
// separada justamente para deixar claro que é um "interruptor de falha", não
// uma regra do banco.
//
// O QUE É FAULT INJECTION?
// É a prática de injetar falhas controladas num sistema para verificar como ele
// se comporta — a base da "chaos engineering" (popularizada pela Netflix com o
// Chaos Monkey). Em vez de esperar uma falha real de produção, nós a provocamos
// de propósito, num ambiente controlado, para PROVAR que os mecanismos de
// proteção (timeout, retry, circuit breaker) funcionam.
@Component
public class ModoFalha {

    // Os três comportamentos que conseguimos simular:
    // - NORMAL:   serviço responde certo (comportamento real).
    // - ERRO:     serviço responde HTTP 500 -> no BFF vira o fallback SERVICO_FORA.
    // - LENTIDAO: serviço dorme além do timeout do BFF -> no BFF vira o fallback TIMEOUT.
    public enum Modo { NORMAL, ERRO, LENTIDAO }

    // 'volatile' é importante aqui: o modo é alterado por uma thread (a requisição
    // POST /admin/falha/ativar) e LIDO por outra (a requisição GET /saldo que chega
    // logo em seguida). Sem o volatile, uma thread poderia não "enxergar" a mudança
    // feita pela outra, por causa de cache de CPU. O volatile garante visibilidade
    // imediata entre threads.
    private volatile Modo modoAtual = Modo.NORMAL;

    public void ativar(Modo modo) {
        this.modoAtual = modo;
    }

    public void desativar() {
        this.modoAtual = Modo.NORMAL;
    }

    public Modo getModo() {
        return modoAtual;
    }
}
