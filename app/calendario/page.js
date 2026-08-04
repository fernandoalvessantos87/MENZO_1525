"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import {
  calcularStatus,
  STATUS_LABEL,
  formatarMoeda,
  NOMES_MESES,
} from "../../lib/contas";

const STATUS_BG = {
  pago: "bg-stamp-green-bg text-stamp-green",
  no_prazo: "bg-stamp-amber-bg text-stamp-amber",
  vencido: "bg-stamp-red-bg text-stamp-red",
};

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function Calendario() {
  const router = useRouter();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [contas, setContas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      router.replace("/login");
      return;
    }

    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .order("dia_vencimento", { ascending: true });

    // Esconde do calendário as linhas que representam o próprio cartão
    // (identificadas por terem dia_fechamento preenchido). São só um registro
    // interno de configuração do cartão, não uma conta real — por isso nunca
    // são marcadas como pagas e viravam "vencido" sozinhas no calendário.
    // As mensalidades vinculadas a um cartão (via cartao_id) continuam
    // aparecendo normalmente. Mesmo filtro usado em app/dashboard/page.js.
    const contasSemCartoes = (contasData ?? []).filter((c) => !c.dia_fechamento);

    const { data: pagamentosData } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("mes", mes)
      .eq("ano", ano);

    setContas(contasSemCartoes);
    setPagamentos(pagamentosData ?? []);
    setDiaSelecionado(null);
    setCarregando(false);
  }, [mes, ano, router]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  function mudarMes(delta) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    setMes(novoMes);
    setAno(novoAno);
  }

  const contasComStatus = contas.map((conta) => {
    const pagamento = pagamentos.find((p) => p.conta_id === conta.id);
    const status = calcularStatus(conta.dia_vencimento, mes, ano, pagamento);
    return { conta, pagamento, status };
  });

  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const celulas = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  function statusDoDia(dia) {
    const doDia = contasComStatus.filter((l) => l.conta.dia_vencimento === dia);
    if (doDia.length === 0) return null;
    if (doDia.every((l) => l.status === "pago")) return "pago";
    if (doDia.some((l) => l.status === "vencido")) return "vencido";
    return "no_prazo";
  }

  const contasDoDiaSelecionado = diaSelecionado
    ? contasComStatus.filter((l) => l.conta.dia_vencimento === diaSelecionado)
    : [];

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <p className="font-display text-2xl">Calendario</p>
        <Link href="/dashboard" className="text-sm text-ledger underline">
          Voltar ao painel
        </Link>
      </header>

      <div className="flex items-center justify-center gap-4 mb-4">
        <button onClick={() => mudarMes(-1)} aria-label="Mes anterior" className="px-2 text-ink-soft">
          &larr;
        </button>
        <p className="font-medium">{NOMES_MESES[mes - 1]} {ano}</p>
        <button onClick={() => mudarMes(1)} aria-label="Proximo mes" className="px-2 text-ink-soft">
          &rarr;
        </button>
      </div>

      {carregando ? (
        <p className="text-ink-soft text-sm text-center">Carregando...</p>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="grid grid-cols-7 gap-1 text-xs text-ink-soft text-center mb-2">
              {DIAS_SEMANA.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((dia, i) => {
                if (dia === null) return <div key={i} />;
                const status = statusDoDia(dia);
                const ehHoje =
                  dia === hoje.getDate() &&
                  mes === hoje.getMonth() + 1 &&
                  ano === hoje.getFullYear();
                return (
                  <button
                    key={i}
                    onClick={() => status && setDiaSelecionado(dia)}
                    className={`aspect-square rounded-md text-sm flex flex-col items-center justify-center gap-0.5
                      ${status ? STATUS_BG[status] : "text-ink-soft"}
                      ${ehHoje ? "ring-2 ring-ledger" : ""}`}
                  >
                    <span className="font-medium">{dia}</span>
                    {status && (
                      <span className="text-[9px] leading-none">
                        {STATUS_LABEL[status]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4 mt-4 text-xs text-ink-soft justify-center">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-stamp-green-bg" /> Pago
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-stamp-amber-bg" /> No prazo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-stamp-red-bg" /> Vencido
            </span>
          </div>

          {diaSelecionado && (
            <div className="mt-6 bg-surface border border-border rounded-lg p-4">
              <p className="font-medium mb-3">Dia {diaSelecionado}</p>
              <div className="flex flex-col gap-2">
                {contasDoDiaSelecionado.map(({ conta, status }) => (
                  <div key={conta.id} className="flex items-center justify-between text-sm">
                    <span>{conta.nome}</span>
                    <span className="flex items-center gap-2">
                      {formatarMoeda(conta.valor_esperado)}
                      <span className={`stamp ${STATUS_BG[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}