"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { CATEGORIAS } from "../../../../lib/contas";

export default function EditarConta() {
  const router = useRouter();
  const params = useParams();
  const contaId = params.id;

  const [form, setForm] = useState({
    nome: "",
    categoria: "",
    dia_vencimento: "",
    valor_esperado: "",
    forma_pagamento: "",
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);

  useEffect(() => {
    async function carregarConta() {
      const { data, error } = await supabase
        .from("contas")
        .select("*")
        .eq("id", contaId)
        .single();

      if (error || !data) {
        setNaoEncontrada(true);
        setCarregando(false);
        return;
      }

      setForm({
        nome: data.nome ?? "",
        categoria: data.categoria ?? "",
        dia_vencimento: data.dia_vencimento ?? "",
        valor_esperado: data.valor_esperado ?? "",
        forma_pagamento: data.forma_pagamento ?? "",
      });
      setCarregando(false);
    }

    if (contaId) carregarConta();
  }, [contaId]);

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

    const { error } = await supabase
      .from("contas")
      .update({
        nome: form.nome,
        categoria: form.categoria,
        dia_vencimento: Number(form.dia_vencimento),
        valor_esperado: valorNumerico,
        forma_pagamento: form.forma_pagamento || null,
      })
      .eq("id", contaId);

    if (error) {
      setErro("Nao foi possivel salvar. Verifique os dados e tente novamente.");
      setSalvando(false);
      return;
    }

    router.push("/dashboard");
  }

  if (carregando) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-ink-soft text-sm">Carregando...</p>
      </main>
    );
  }

  if (naoEncontrada) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-sm text-stamp-red mb-4">
          Essa conta não foi encontrada. Ela pode já ter sido apagada.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-ledger underline text-sm"
        >
          Voltar para o painel
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <p className="font-display text-2xl mb-6">Editar conta</p>

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
            {form.categoria && !CATEGORIAS.includes(form.categoria) && (
              <option value={form.categoria}>{form.categoria} (categoria antiga)</option>
            )}
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

        <div className="flex gap-3 mt-2">
          <button
            type="submit"
            disabled={salvando}
            className="flex-1 bg-ledger hover:bg-ledger-dark text-white rounded-md py-2.5 font-medium disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar alteracoes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="px-4 rounded-md border border-[#D8D3C2] text-sm text-ink-soft"
          >
            Cancelar
          </button>
        </div>
      </form>
    </main>
  );
}