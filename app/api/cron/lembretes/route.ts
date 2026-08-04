import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Roda em ambiente Node (necessário para o SDK do Supabase/Resend)
export const runtime = "nodejs";

type Conta = {
  id: string;
  nome: string;
  categoria: string;
  dia_vencimento: number;
  valor_esperado: number;
  forma_pagamento: string;
  user_id: string;
};

// Retorna o último dia do mês (considera fevereiro, meses de 30/31 dias, etc.)
function getUltimoDiaDoMes(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate();
}

// Pega a data de "hoje" no horário de Brasília, mesmo rodando em servidor UTC
function getHojeSaoPaulo() {
  const now = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [ano, mes, dia] = partes.split("-").map(Number);
  return { ano, mes, dia };
}

export async function GET(request: NextRequest) {
  // Protege o endpoint: só aceita chamadas que tenham o segredo correto
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { ano, mes, dia } = getHojeSaoPaulo();

  // Busca todas as contas cadastradas
  const { data: contas, error: erroContas } = await supabaseAdmin
    .from("contas")
    .select("id, nome, categoria, dia_vencimento, valor_esperado, forma_pagamento, user_id");

  if (erroContas) {
    return NextResponse.json({ error: erroContas.message }, { status: 500 });
  }

  // Busca quais contas já foram pagas neste mês/ano
  const { data: pagamentos, error: erroPagamentos } = await supabaseAdmin
    .from("pagamentos")
    .select("conta_id")
    .eq("mes", mes)
    .eq("ano", ano)
    .eq("status", "pago");

  if (erroPagamentos) {
    return NextResponse.json({ error: erroPagamentos.message }, { status: 500 });
  }

  const idsPagos = new Set((pagamentos ?? []).map((p) => p.conta_id));

  const vencidas: Conta[] = [];
  const vencemHoje: Conta[] = [];
  const vencemEm3Dias: Conta[] = [];

  const ultimoDia = getUltimoDiaDoMes(ano, mes);

  for (const conta of (contas ?? []) as Conta[]) {
    if (idsPagos.has(conta.id)) continue;

    // Se o dia de vencimento não existe no mês atual (ex: 31 em abril), usa o último dia
    const diaVenc = Math.min(conta.dia_vencimento, ultimoDia);
    const diasParaVencer = diaVenc - dia;

    if (diasParaVencer === 0) vencemHoje.push(conta);
    else if (diasParaVencer === 3) vencemEm3Dias.push(conta);
    else if (diasParaVencer < 0) vencidas.push(conta);
  }

  const total = vencidas.length + vencemHoje.length + vencemEm3Dias.length;

  if (total === 0) {
    return NextResponse.json({ message: "Nenhum lembrete necessário hoje." });
  }

  const formatarLista = (lista: Conta[], titulo: string) => {
    if (lista.length === 0) return "";
    const itens = lista
      .map(
        (c) =>
          `<li>${c.nome} — R$ ${Number(c.valor_esperado).toFixed(2)} (${c.forma_pagamento})</li>`
      )
      .join("");
    return `<h3>${titulo}</h3><ul>${itens}</ul>`;
  };

  const corpoHtml = `
    <h2>Resumo de contas — Menzo</h2>
    ${formatarLista(vencidas, "🔴 Contas vencidas e não pagas")}
    ${formatarLista(vencemHoje, "🟡 Vencem hoje")}
    ${formatarLista(vencemEm3Dias, "🟢 Vencem em 3 dias")}
    <p><a href="https://menzo-tau.vercel.app/dashboard">Abrir o Menzo</a></p>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { error: erroEmail } = await resend.emails.send({
    from: "Menzo <onboarding@resend.dev>",
    to: process.env.EMAIL_DESTINO!,
    subject: `Menzo: ${total} lembrete(s) de conta`,
    html: corpoHtml,
  });

  if (erroEmail) {
    return NextResponse.json({ error: erroEmail.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Lembretes enviados com sucesso",
    vencidas: vencidas.length,
    vencemHoje: vencemHoje.length,
    vencemEm3Dias: vencemEm3Dias.length,
  });
}
