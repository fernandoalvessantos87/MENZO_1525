// Calcula o status real de uma conta num determinado mes/ano,
// cruzando o dia de vencimento com o registro de pagamento (se existir).
export function calcularStatus(diaVencimento, mes, ano, pagamento) {
  if (pagamento?.status === "pago") return "pago";
  const hoje = new Date();
  const vencimento = new Date(ano, mes - 1, diaVencimento);
  if (hoje > vencimento) return "vencido";
  return "no_prazo";
}
export const STATUS_LABEL = {
  pago: "Pago",
  no_prazo: "No prazo",
  vencido: "Vencido",
};
export const STATUS_CLASSES = {
  pago: "bg-stamp-green-bg text-stamp-green",
  no_prazo: "bg-stamp-amber-bg text-stamp-amber",
  vencido: "bg-stamp-red-bg text-stamp-red",
};
export function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
export function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
export const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Lista única de categorias, usada em TODAS as telas que lançam gasto
// (foto/voz, gasto variável manual, gasto no cartão manual, edição na
// fatura, contas). Centralizar aqui evita duplicidade tipo "Saude"/"Saúde"
// surgindo de digitação livre em telas diferentes.
//
// Renomeações feitas (nomes antigos ainda são reconhecidos automaticamente
// pra itens já lançados, ver normalizarCategoria em app/dashboard/page.js):
//   "Gastos com o carro" -> "Transporte"
//   "Estudos"            -> "Educação"
//   "Gastos com a MEI"   -> "Trabalho"
//   "Casa"               -> "Moradia"
//   "Alimentação"        -> "Restaurantes e Delivery"
//   "Mercado"/"Supermercado" -> "Alimentação" (trocou de sentido: agora é
//     a categoria de compra de mercado/supermercado, e "Restaurantes e
//     Delivery" ficou com o que era "Alimentação" antes)
//   "Estética"           -> "Cuidados Pessoais"
//
// "Reembolso" é uma categoria especial: entra no total da fatura do
// cartão (app/cartao) mas NÃO entra no total de gastos do dashboard,
// porque representa dinheiro que passou pelo seu cartão mas volta pra
// você (ex: passou o cartão pra um parente pagar depois).
export const CATEGORIAS = [
  "Alimentação",
  "Restaurantes e Delivery",
  "Saúde",
  "Cuidados Pessoais",
  "Vestuário",
  "Lazer",
  "Moradia",
  "Transporte",
  "Assinaturas",
  "Trabalho",
  "Educação",
  "Empréstimo",
  "Dívidas e Financiamentos",
  "Investimentos",
  "Eletrônicos",
  "Pets",
  "Presentes",
  "Impostos e Taxas",
  "Reembolso",
  "Outros",
];
