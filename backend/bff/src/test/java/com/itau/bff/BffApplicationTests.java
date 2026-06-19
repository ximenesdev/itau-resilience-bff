package com.itau.bff;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// Teste de fumaça (smoke test): verifica que o contexto Spring sobe sem erros.
// Se este teste passar, significa que:
// - Todas as dependências foram encontradas (Resilience4j, Actuator, AspectJ)
// - O application.yml está sintaticamente correto
// - Nenhum bean tem dependência faltando ou circular
// RANDOM_PORT evita conflito de porta caso o teste rode junto com outros
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BffApplicationTests {

    @Test
    void contextLoads() {
        // Se o contexto subir sem exceção, este teste passa.
        // É simples, mas prova que toda a configuração do Resilience4j está correta.
    }
}
