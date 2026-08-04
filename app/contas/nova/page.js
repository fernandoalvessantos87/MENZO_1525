"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { CATEGORIAS } from "../../../lib/contas";

export default function NovaConta() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    categoria: CATEGORIAS[0],
    dia_vencimento: "",
    valor_esperado: "",
    forma_pagamento: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const valorNumerico = form.valor_esperado
      ? Number(String(form.valor_esperado).replace(",", "."))
      : null;

    const { error } = await supabase.from("contas").insert({
      nome: form.nome,
      categoria: form.categoria,
      dia_vencimento: Number(form.dia_vencimento),
      valor_esperado: valorNumerico,
      forma_pagamento: form.forma_pagamento || null,
    });

    if (error) {
      setErro("Nao foi possivel salvar. Verifique os dados e tente novamente.");
      setSalvando(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <p className="font-display text-2xl mb-6">Nova conta</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white/70 border border-[#D8D3C2] rounded-lg p-6">
        <div>
          <label className="text-sm text-ink-soft block mb-1" htmlFor="nome">
            Nome da conta
          </label>
          <input
            id="nome"
            required
            placeholder="Ex: Mensalidade academia"
            value={form.nome}
            onChange={(e) => atualizar("nome", e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-ink-soft block mb-1" htmlFor="categoria">
            Categoria
          </label>
          <select
            id="categoria"
            required
            value={form.categoria}
            onChange={(e) => atualizar("categoria", e.target.value)}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-ink-soft block mb-1" htmlFor="dia">
              Dia do vencimento
            </label>
            <input
              id="dia"
              type="number"
              min={1}
              max={31}
              required
              value={form.dia_vencimento}
              onChange={(e) => atualizar("dia_vencimento", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-ink-soft block mb-1" htmlFor="valor">
              Valor (R$)
            </label>
            <input
              id="valor"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor_esperado}
              onChange={(e) => atualizar("valor_esperado", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-ink-soft block mb-1" htmlFor="forma">
            Forma de pagamento
          </label>
          <select
            id="forma"
            value={form.forma_pagamento}
            onChange={(e) => atualizar("forma_pagamento", e.target.value)}
          >
            <option value="">Selecione</option>
            <option value="conta_corrente">Conta corrente</option>
            <option value="cartao_credito">Cartao de credito</option>
            <option value="debito_automatico">Debito automatico</option>
            <option value="boleto">Boleto</option>
          </select>
        </div>

        {erro && <p className="text-sm text-stamp-red">{erro}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="mt-2 bg-ledger hover:bg-ledger-dark text-white rounded-md py-2.5 font-medium disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar conta"}
        </button>
      </form>
    </main>
  );
}