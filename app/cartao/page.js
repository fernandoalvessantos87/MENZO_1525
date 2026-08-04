"use client";

/**
 * Tela de fatura consolidada dos cartões de crédito.
 *
 * ONDE COLOCAR:
 *   app/cartao/page.js  (substitui o arquivo antigo)
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { calcularStatus, STATUS_LABEL, STATUS_CLASSES, formatarMoeda, NOMES_MESES, CATEGORIAS } from "../../lib/contas";

function calcularResponsavelRotativo(conta, mes, ano) {
  if (!conta.rotativo || !Array.isArray(conta.ordem_rotativo) || conta.ordem_rotativo.length === 0) {
    return null;
  }
  if (!conta.rotativo_inicio_mes || !conta.rotativo_inicio_ano) return null;

  const offset =
    (ano - conta.rotativo_inicio_ano) * 12 + (mes - conta.rotativo_inicio_mes);
  if (offset < 0) return null;

  const idx = offset % conta.ordem_rotativo.length;
  return conta.ordem_rotativo[idx];
}

function mesAnoVencimento(mes, ano) {
  let m = mes + 1;
  let a = ano;
  if (m > 12) { m = 1; a += 1; }
  return { mes: m, ano: a };
}

function coresDoCartao(nome) {
  const n = (nome || "").toLowerCase();

  if (n.includes("bradesco")) {
    return {
      header: "bg-[#CC092F]",
      headerText: "text-white",
      card: "bg-[#1A0A0D] border-[#4A1620]",
      accent: "text-[#FF6B7A]",
      badge: "bg-[#3A1219] text-[#FF9AA6]",
      divide: "divide-[#3A1A20]",
    };
  }

  if (n.includes("nubank")) {
    return {
      header: "bg-[#8A05BE]",
      headerText: "text-white",
      card: "bg-[#160A1C] border-[#3E1D52]",
      accent: "text-[#D89EFF]",
      badge: "bg-[#2A1235] text-[#D89EFF]",
      divide: "divide-[#341A44]",
    };
  }

  return {
    header: "bg-surface-soft",
    headerText: "text-ink",
    card: "bg-surface border-border",
    accent: "text-ledger",
    badge: "bg-surface-soft text-ink-soft",
    divide: "divide-border",
  };
}

export default function FaturaCartao() {
  const router = useRouter();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const [cartoes, setCartoes] = useState([]);
  const [mensalidadesPorCartao, setMensalidadesPorCartao] = useState({});
  const [gastosPorCartao, setGastosPorCartao] = useState({});
  const [carregando, setCarregando] = useState(true);

  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: CATEGORIAS[0], data_compra: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      router.replace("/login");
      return;
    }

    const { data: cartoesData } = await supabase
      .from("contas")
      .select("id, nome, dia_fechamento, dia_vencimento")
      .not("dia_fechamento", "is", null)
      .order("nome", { ascending: true });

    const listaCartoes = cartoesData ?? [];
    setCartoes(listaCartoes);

    if (listaCartoes.length === 0) {
      setMensalidadesPorCartao({});
      setGastosPorCartao({});
      setCarregando(false);
      return;
    }

    const idsCartao = listaCartoes.map((c) => c.id);

    const { data: mensalidadesData } = await supabase
      .from("contas")
      .select("*")
      .in("cartao_id", idsCartao);

    const idsMensalidades = (mensalidadesData ?? []).map((c) => c.id);

    let pagamentosData = [];
    if (idsMensalidades.length > 0) {
      const { data } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("mes", mes)
        .eq("ano", ano)
        .in("conta_id", idsMensalidades);
      pagamentosData = data ?? [];
    }

    const mensalidadesAgrupadas = {};
    (mensalidadesData ?? []).forEach((conta) => {
      const pagamento = pagamentosData.find((p) => p.conta_id === conta.id);
      const valor = pagamento?.valor_pago ?? conta.valor_esperado ?? 0;
      const status = calcularStatus(conta.dia_vencimento, mes, ano, pagamento);
      if (!mensalidadesAgrupadas[conta.cartao_id]) mensalidadesAgrupadas[conta.cartao_id] = [];
      mensalidadesAgrupadas[conta.cartao_id].push({ conta, pagamento, valor, status });
    });
    setMensalidadesPorCartao(mensalidadesAgrupadas);

    const { data: gastosData } = await supabase
      .from("gastos_cartao")
      .select(
        "id, cartao_id, descricao, valor, categoria, data_compra, parcela_atual, parcela_total, grupo_parcela"
      )
      .eq("fatura_mes", mes)
      .eq("fatura_ano", ano)
      .in("cartao_id", idsCartao)
      .order("data_compra");

    const gastosAgrupados = {};
    (gastosData ?? []).forEach((item) => {
      if (!gastosAgrupados[item.cartao_id]) gastosAgrupados[item.cartao_id] = [];
      gastosAgrupados[item.cartao_id].push(item);
    });
    setGastosPorCartao(gastosAgrupados);

    setCarregando(false);
  }, [mes, ano, router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mudarMes(delta) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    setMes(novoMes);
    setAno(novoAno);
    setEditandoId(null);
  }

  function iniciarEdicao(item) {
    setEditandoId(item.id);
    setForm({
      descricao: item.descricao ?? "",
      valor: String(item.valor ?? ""),
      categoria: CATEGORIAS.includes(item.categoria) ? item.categoria : CATEGORIAS[CATEGORIAS.length - 1],
      data_compra: item.data_compra ?? "",
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
  }

  async function salvarEdicao(item) {
    if (!form.descricao.trim() || !form.valor) {
      alert("Preencha ao menos a descrição e o valor.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("gastos_cartao")
      .update({
        descricao: form.descricao.trim(),
        valor: parseFloat(form.valor.toString().replace(",", ".")),
        categoria: form.categoria || null,
        data_compra: form.data_compra,
      })
      .eq("id", item.id);
    setSalvando(false);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }
    setEditandoId(null);
    carregar();
  }

  async function excluirGasto(item) {
    if (item.parcela_total && item.parcela_total > 1) {
      const excluirTudo = window.confirm(
        `"${item.descricao}" está em ${item.parcela_total} parcelas.\n\n` +
          `Clique em OK para excluir TODAS as parcelas dessa compra.\n` +
          `Clique em Cancelar se quiser excluir só a parcela ${item.parcela_atual}/${item.parcela_total}.`
      );

      if (excluirTudo) {
        if (item.grupo_parcela) {
          const { error } = await supabase
            .from("gastos_cartao")
            .delete()
            .eq("grupo_parcela", item.grupo_parcela);
          if (error) {
            alert("Erro ao excluir: " + error.message);
            return;
          }
        } else {
          const { error } = await supabase.from("gastos_cartao").delete().eq("id", item.id);
          if (error) {
            alert("Erro ao excluir: " + error.message);
            return;
          }
        }
      } else {
        const confirmaUnica = window.confirm(
          `Confirma excluir só a parcela ${item.parcela_atual}/${item.parcela_total} de "${item.descricao}"?`
        );
        if (!confirmaUnica) return;
        const { error } = await supabase.from("gastos_cartao").delete().eq("id", item.id);
        if (error) {
          alert("Erro ao excluir: " + error.message);
          return;
        }
      }
    } else {
      const confirma = window.confirm(`Excluir "${item.descricao}"?`);
      if (!confirma) return;
      const { error } = await supabase.from("gastos_cartao").delete().eq("id", item.id);
      if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
      }
    }

    if (editandoId === item.id) setEditandoId(null);
    carregar();
  }

  async function marcarComoPago(conta) {
    const responsavelCalculado = calcularResponsavelRotativo(conta, mes, ano);

    const payload = {
      conta_id: conta.id,
      mes,
      ano,
      status: "pago",
      valor_pago: conta.valor_esperado,
      data_pagamento: new Date().toISOString().slice(0, 10),
      ...(responsavelCalculado ? { responsavel: responsavelCalculado } : {}),
    };

    const { data: existente } = await supabase
      .from("pagamentos")
      .select("id")
      .eq("conta_id", conta.id)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (existente) {
      await supabase.from("pagamentos").update(payload).eq("id", existente.id);
    } else {
      await supabase.from("pagamentos").insert(payload);
    }
    carregar();
  }

  async function desfazerPagamento(conta) {
    const confirmar = window.confirm(
      `Desfazer o pagamento de "${conta.nome}" neste mês?`
    );
    if (!confirmar) return;

    await supabase
      .from("pagamentos")
      .delete()
      .eq("conta_id", conta.id)
      .eq("mes", mes)
      .eq("ano", ano);
    carregar();
  }

  const vencimento = mesAnoVencimento(mes, ano);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-xs text-ledger underline">
          &larr; Voltar ao dashboard
        </Link>
      </div>

      <p className="font-display text-2xl mb-1">Fatura dos cartões</p>
      <p className="text-xs text-ink-soft mb-6">
        Mensalidades fixas + gastos avulsos, somados por cartão
      </p>

      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => mudarMes(-1)} aria-label="Mes anterior" className="px-2 text-ink-soft">
          &larr;
        </button>
        <p className="font-medium">{NOMES_MESES[mes - 1]} {ano}</p>
        <button onClick={() => mudarMes(1)} aria-label="Proximo mes" className="px-2 text-ink-soft">
          &rarr;
        </button>
      </div>

      {carregando && <p className="text-ink-soft text-sm">Carregando...</p>}

      {!carregando && cartoes.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-ink-soft">Nenhum cartão cadastrado ainda.</p>
        </div>
      )}

      <div className="space-y-6">
        {cartoes.map((cartao) => {
          const mensalidades = mensalidadesPorCartao[cartao.id] || [];
          const gastos = gastosPorCartao[cartao.id] || [];
          const cores = coresDoCartao(cartao.nome);

          const totalMensalidades = mensalidades.reduce((s, m) => s + Number(m.valor ?? 0), 0);
          const totalGastos = gastos.reduce((s, g) => s + Number(g.valor ?? 0), 0);
          const total = totalMensalidades + totalGastos;

          return (
            <div
              key={cartao.id}
              className={`rounded-lg border overflow-hidden ${cores.card}`}
            >
              <div className={`flex items-center justify-between px-4 py-3 ${cores.header}`}>
                <p className={`font-display text-lg ${cores.headerText}`}>{cartao.nome}</p>
                <p className={`font-display text-2xl ${cores.headerText}`}>{formatarMoeda(total)}</p>
              </div>

              <div className="p-4">
                <p className="text-xs text-ink-soft mb-4">
                  Fecha dia {cartao.dia_fechamento} · Vence dia {cartao.dia_vencimento} de{" "}
                  {NOMES_MESES[vencimento.mes - 1]}/{vencimento.ano}
                </p>

                {mensalidades.length === 0 && gastos.length === 0 ? (
                  <p className="text-sm text-ink-soft">Nenhum lançamento nessa fatura.</p>
                ) : (
                  <>
                    {mensalidades.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                          Mensalidades
                        </p>
                        <div className={`divide-y ${cores.divide}`}>
                          {mensalidades.map(({ conta, pagamento, valor, status }) => (
                            <div key={conta.id} className="flex items-start justify-between py-2 gap-2">
                              <p className="text-sm break-words min-w-0 flex-1">{conta.nome}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[11px] px-2 py-0.5 rounded ${STATUS_CLASSES[status]}`}>
                                  {STATUS_LABEL[status]}
                                </span>
                                <p className="text-sm font-medium">{formatarMoeda(valor)}</p>
                                {status === "pago" ? (
                                  <button
                                    onClick={() => desfazerPagamento(conta)}
                                    className="text-[11px] text-ink-soft underline"
                                  >
                                    desfazer
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => marcarComoPago(conta)}
                                    className={`text-[11px] font-medium underline ${cores.accent}`}
                                  >
                                    marcar pago
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {gastos.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                          Gastos avulsos
                        </p>
                        <div className={`divide-y ${cores.divide}`}>
                          {gastos.map((item) => {
                            const emEdicao = editandoId === item.id;

                            if (emEdicao) {
                              return (
                                <div key={item.id} className="py-3 space-y-2">
                                  <input
                                    type="text"
                                    value={form.descricao}
                                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                                    placeholder="Descrição"
                                    className="w-full text-sm px-2 py-1 rounded border border-border bg-surface-soft text-ink"
                                  />
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={form.valor}
                                      onChange={(e) => setForm({ ...form, valor: e.target.value })}
                                      placeholder="Valor"
                                      className="w-1/2 text-sm px-2 py-1 rounded border border-border bg-surface-soft text-ink"
                                    />
                                    <input
                                      type="date"
                                      value={form.data_compra}
                                      onChange={(e) => setForm({ ...form, data_compra: e.target.value })}
                                      className="w-1/2 text-sm px-2 py-1 rounded border border-border bg-surface-soft text-ink"
                                    />
                                  </div>
                                  <select
                                    value={form.categoria}
                                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                                    className="w-full text-sm px-2 py-1 rounded border border-border bg-surface-soft text-ink"
                                  >
                                    {CATEGORIAS.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                  {item.parcela_total > 1 && (
                                    <p className="text-[11px] text-ink-soft">
                                      Isso edita só a parcela {item.parcela_atual}/{item.parcela_total}. As demais
                                      parcelas não são alteradas.
                                    </p>
                                  )}
                                  <div className="flex gap-3 pt-1">
                                    <button
                                      onClick={() => salvarEdicao(item)}
                                      disabled={salvando}
                                      className={`text-xs font-medium underline ${cores.accent}`}
                                    >
                                      {salvando ? "Salvando..." : "Salvar"}
                                    </button>
                                    <button
                                      onClick={cancelarEdicao}
                                      disabled={salvando}
                                      className="text-xs text-ink-soft underline"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={item.id} className="flex items-start justify-between py-2 gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm break-words">{item.descricao}</p>
                                  <p className="text-[11px] text-ink-soft">
                                    {new Date(item.data_compra + "T00:00:00").toLocaleDateString("pt-BR")}
                                    {item.categoria ? ` · ${item.categoria}` : ""}
                                    {item.parcela_total > 1
                                      ? ` · Parcela ${item.parcela_atual}/${item.parcela_total}`
                                      : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <p className="text-sm font-medium">{formatarMoeda(item.valor)}</p>
                                  <button
                                    onClick={() => iniciarEdicao(item)}
                                    aria-label="Editar"
                                    className="text-xs text-ink-soft underline"
                                  >
                                    editar
                                  </button>
                                  <button
                                    onClick={() => excluirGasto(item)}
                                    aria-label="Excluir"
                                    className="text-xs text-stamp-red/80 underline"
                                  >
                                    excluir
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center flex flex-col items-center gap-2">
        <Link href="/cartao/novo" className="text-sm text-ledger underline">
          + Lançar gasto avulso no cartão
        </Link>
        <Link href="/gastos/ia" className="text-xs text-ink-soft underline">
          ou lançar por foto/voz
        </Link>
      </div>
    </main>
  );
}
