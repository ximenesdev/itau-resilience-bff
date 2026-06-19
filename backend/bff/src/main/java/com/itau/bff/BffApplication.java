package com.itau.bff;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

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
}
