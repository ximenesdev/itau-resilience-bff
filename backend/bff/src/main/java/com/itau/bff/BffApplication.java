package com.itau.bff;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@SpringBootApplication
public class BffApplication {

	public static void main(String[] args) {
		SpringApplication.run(BffApplication.class, args);
	}

	// Registra o RestTemplate como bean gerenciado pelo Spring.
	// Por que isso importa? Os testes usam @MockitoBean para substituir este bean
	// por um mock que simula o serviço fora/lento. Se o RestTemplate fosse criado
	// com "new RestTemplate()" dentro do ServicoBackend, o Spring não conseguiria
	// substituí-lo — o mock seria ignorado e os testes não funcionariam.
	@Bean
	public RestTemplate restTemplate() {
		return new RestTemplate();
	}

	// Executor DEDICADO (virtual threads, Java 21+) para as chamadas assíncronas do BFF.
	// POR QUÊ: CompletableFuture.supplyAsync(...) SEM executor roda no
	// ForkJoinPool.commonPool() — um pool COMPARTILHADO por toda a JVM (parallel
	// streams, etc.). Quando o @TimeLimiter cancela após 2s, a thread trabalhadora
	// NÃO é interrompida: ela fica presa no I/O do RestTemplate até o serviço lento
	// responder. Se isso acontecesse no commonPool, uma dependência lenta poderia
	// drená-lo e degradar o resto da aplicação.
	// Com virtual threads: cada tarefa roda numa thread virtual (barata, não segura
	// uma thread de plataforma). A eventual "thread órfã" presa em I/O deixa de ser
	// risco de esgotamento, e o trabalho fica ISOLADO do commonPool compartilhado.
	// O Spring fecha este ExecutorService no shutdown (infere o método close/shutdown).
	@Bean
	public ExecutorService executorTarefasBackend() {
		return Executors.newVirtualThreadPerTaskExecutor();
	}
}
