'use client'

/**
 * Formulário de lançamento de gasto no cartão de crédito.
 *
 * ONDE COLOCAR:
 *   app/cartao/novo/page.js
 *
 * O QUE ELE FAZ:
 * - Lista os cartões (contas que têm dia_fechamento preenchido).
 * - Você só informa descrição, valor, data da compra, categoria (lista
 *   fixa, igual às outras telas do app) e, se for parcelado, quantas
 *   parcelas.
 * - Se for parcelado, gera uma linha por mês na tabela gastos_cartao,
 *   todas com o mesmo grupo_parcela. O trigger do banco calcula
 *   sozinho fatura_mes/fatura_ano de cada parcela.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CATEGORIAS } from '../../../lib/contas';

// Soma `meses` à data mantendo o dia, com clamp pro último dia do mês
// quando o mês de destino for mais curto (ex: dia 31 em fevereiro -> 28/29).
function somarMeses(dataISO, meses) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  const ultimoDiaDoMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(dia, ultimoDiaDoMes));
  return data.toISOString().slice(0, 10);
}

export default function NovoGastoCartaoPage() {
  const [cartoes, setCartoes] = useState([]);
  const [cartaoId, setCartaoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [dataCompra, setDataCompra] = useState(() => new Date().toISOString().slice(0, 10));
  const [parcelado, setParcelado] = useState(false);
  const [parcelaTotal, setParcelaTotal] = useState(2);

  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    async function carregarCartoes() {
      const { data, error } = await supabase
        .from('contas')
        .select('id, nome, dia_fechamento')
        .not('dia_fechamento', 'is', null)
        .order('nome');

      if (!error && data) {
        setCartoes(data);
        if (data.length > 0) setCartaoId(data[0].id);
      }
    }
    carregarCartoes();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem(null);

    const valorNumerico = Number(valor.replace(',', '.'));
    if (!cartaoId || !descricao || !valorNumerico || valorNumerico <= 0) {
      setMensagem({ tipo: 'erro', texto: 'Preencha cartão, descrição e um valor válido.' });
      return;
    }

    setEnviando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMensagem({ tipo: 'erro', texto: 'Sessão expirada. Faça login novamente.' });
      setEnviando(false);
      return;
    }

    const totalParcelas = parcelado ? Math.max(2, parcelaTotal) : 1;
    const valorParcela = Number((valorNumerico / totalParcelas).toFixed(2));
    const grupoParcela = totalParcelas > 1 ? crypto.randomUUID() : null;

    const linhas = Array.from({ length: totalParcelas }).map((_, i) => ({
      user_id: user.id,
      cartao_id: cartaoId,
      descricao: totalParcelas > 1 ? `${descricao} (${i + 1}/${totalParcelas})` : descricao,
      valor: valorParcela,
      categoria,
      data_compra: somarMeses(dataCompra, i),
      parcela_atual: i + 1,
      parcela_total: totalParcelas,
      grupo_parcela: grupoParcela,
    }));

    const { error } = await supabase.from('gastos_cartao').insert(linhas);

    setEnviando(false);

    if (error) {
      setMensagem({ tipo: 'erro', texto: `Erro ao salvar: ${error.message}` });
      return;
    }

    setMensagem({
      tipo: 'ok',
      texto:
        totalParcelas > 1
          ? `Gasto lançado em ${totalParcelas} parcelas de R$ ${valorParcela.toFixed(2)}.`
          : 'Gasto lançado com sucesso.',
    });
    setDescricao('');
    setValor('');
    setCategoria(CATEGORIAS[0]);
    setParcelado(false);
    setParcelaTotal(2);
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Novo gasto no cartão</h1>
      <p className="mb-6 text-sm text-neutral-500">
        A fatura é calculada automaticamente pela data da compra.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Cartão</label>
          <select
            value={cartaoId}
            onChange={(e) => setCartaoId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {cartoes.length === 0 && <option value="">Nenhum cartão cadastrado</option>}
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} (fecha dia {c.dia_fechamento})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Supermercado, Notebook..."
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Valor total (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Data da compra</label>
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            id="parcelado"
            type="checkbox"
            checked={parcelado}
            onChange={(e) => setParcelado(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          <label htmlFor="parcelado" className="text-sm text-neutral-700">
            Compra parcelada
          </label>
        </div>

        {parcelado && (
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Número de parcelas</label>
            <input
              type="number"
              min={2}
              max={48}
              value={parcelaTotal}
              onChange={(e) => setParcelaTotal(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {mensagem && (
          <p className={`text-sm ${mensagem.tipo === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {mensagem.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {enviando ? 'Salvando...' : 'Lançar gasto'}
        </button>
      </form>
    </div>
  );
}
