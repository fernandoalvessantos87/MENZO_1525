"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { CATEGORIAS } from "../../../lib/contas";

export default function NovoGastoVariavel() {
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);

  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    const valorNumerico = Number(valor.replace(",", "."));

    if (!nome.trim() || !valor || !valorNumerico || valorNumerico <= 0) {
      setErro("Preencha ao menos o nome e um valor válido.");
      return;
    }

    setSalvando(true);

    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      router.replace("/login");
      return;
    }

    const dataObj = new Date(data + "T00:00:00");
    const dia = dataObj.getDate();
    const mes = dataObj.getMonth() + 1;
    const ano = dataObj.getFullYear();

    const { data: contaCriada, error: erroConta } = await supabase
      .from("contas")
      .insert({
        user_id: sessao.session.user.id,
        nome: nome.trim(),
        categoria,
        dia_vencimento: dia,
        valor_esperado: valorNumerico,
        forma_pagamento: formaPagamento,
        tipo: "variavel",
      })
      .select()
      .single();

    if (erroConta) {
      setErro("Nao foi possivel salvar o gasto. Tente novamente.");
      setSalvando(false);
      return;
    }

    // Gasto variavel ja nasce como pago, pois foi um gasto pontual do dia
    await supabase.from("pagamentos").insert({
      conta_id: contaCriada.id,
      mes,
      ano,
      status: "pago",
      valor_pago: valorNumerico,
      data_pagamento: data,
    });

    router.replace("/dashboard");
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-xs text-ledger underline">
        &larr; Voltar ao dashboard
      </Link>
      <p className="font-display text-2xl mt-2 mb-6">Novo gasto variável</p>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-ink-soft block mb-1">O que foi?</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Supermercado, Farmácia..."
            className="w-full border border-[#D8D3C2] rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-ink-soft block mb-1">Valor (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="w-full border border-[#D8D3C2] rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-ink-soft block mb-1">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full border border-[#D8D3C2] rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-ink-soft block mb-1">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full border border-[#D8D3C2] rounded-md px-3 py-2 text-sm"
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-ink-soft block mb-1">Forma de pagamento</label>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            className="w-full border border-[#D8D3C2] rounded-md px-3 py-2 text-sm"
          >
            <option value="pix">Pix</option>
            <option value="debito">Débito</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
        </div>

        {erro && <p className="text-sm text-stamp-red">{erro}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="bg-ledger text-white px-4 py-2 rounded-md font-medium hover:bg-ledger-dark disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar gasto"}
        </button>
      </form>
    </main>
  );
}
