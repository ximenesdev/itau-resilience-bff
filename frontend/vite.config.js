import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy de DEV: encaminha só as CHAMADAS DE API para o BFF (porta 8083).
    // IMPORTANTE: usamos os subcaminhos exatos da API ('/resiliencia/circuitos',
    // '/resiliencia/falha') em vez de '/resiliencia' inteiro. Se proxyássemos
    // '/resiliencia', a ROTA do SPA com esse mesmo nome (a página Resiliência)
    // seria encaminhada ao backend ao recarregar a página, devolvendo erro 404
    // do Spring em vez do app. Os prefixos de API não colidem com as rotas do SPA.
    proxy: {
      '/dashboard': 'http://localhost:8083',
      '/resiliencia/circuitos': 'http://localhost:8083',
      '/resiliencia/falha': 'http://localhost:8083',
      '/actuator': 'http://localhost:8083'
    }
  }
})
