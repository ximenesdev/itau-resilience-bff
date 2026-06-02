// data.js — dados mockados (fixos) usados pela tela de Extrato
// Em um sistema real, viriam de um endpoint do backend.
// Aqui ficam no frontend só para dar vida à navegação.

export const transacoes = [
  { id: 1, tipo: 'saida',   titulo: 'iFood',                categoria: 'Alimentação',  data: '01 jun', valor: -54.90 },
  { id: 2, tipo: 'entrada', titulo: 'Salário',              categoria: 'Renda',        data: '01 jun', valor: 4800.00 },
  { id: 3, tipo: 'saida',   titulo: 'Spotify',              categoria: 'Assinaturas',  data: '31 mai', valor: -21.90 },
  { id: 4, tipo: 'saida',   titulo: 'Posto Shell',          categoria: 'Transporte',   data: '30 mai', valor: -180.00 },
  { id: 5, tipo: 'entrada', titulo: 'Pix recebido — Higor', categoria: 'Transferência',data: '29 mai', valor: 120.00 },
  { id: 6, tipo: 'saida',   titulo: 'Amazon',               categoria: 'Compras',      data: '28 mai', valor: -239.99 },
  { id: 7, tipo: 'saida',   titulo: 'Farmácia Pague Menos', categoria: 'Saúde',        data: '27 mai', valor: -67.40 },
  { id: 8, tipo: 'entrada', titulo: 'Rendimento poupança',  categoria: 'Investimento', data: '26 mai', valor: 38.21 },
  { id: 9, tipo: 'saida',   titulo: 'Uber',                 categoria: 'Transporte',   data: '25 mai', valor: -32.50 },
  { id: 10,tipo: 'saida',   titulo: 'Mercado Livre',        categoria: 'Compras',      data: '24 mai', valor: -89.90 },
];

// Helper para formatar valores como Real brasileiro (R$)
export const brl = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
