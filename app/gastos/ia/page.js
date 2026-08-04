"use client";

/**
 * Lançamento de gasto por foto ou por voz.
 *
 * ONDE COLOCAR:
 *   app/gastos/ia/page.js
 *
 * COMO FUNCIONA:
 * 1) O usuário tira/anexa uma foto de um comprovante, OU aperta "Falar" e
 *    descreve o gasto em voz alta (transcrito no próprio navegador, sem
 *    custo, via Web Speech API).
 * 2) A foto (em base64) ou o texto transcrito é enviado pra
 *    /api/ia/extrair-gasto, que usa o Gemini (camada gratuita) pra
 *    extrair: descrição, valor, data, categoria, forma de pagamento,
 *    parcelamento (se houver) e, se der, o cartão usado.
 * 3) Os campos extraídos aparecem em um formulário editável — o usuário
 *    confere/corrige e confirma. A categoria usa a mesma lista fixa
 *    (CATEGORIAS, em lib/contas.js) usada em todas as outras telas do
 *    app, pra nunca surgir categoria digitada diferente/duplicada.
 * 4) Ao salvar:
 *    - se for "cartão de crédito" e um cartão for selecionado, grava em
 *      `gastos_cartao` uma linha PARA CADA PARCELA (mesmo padrão de
 *      app/cartao/novo/page.js): cada linha usa o valor da parcela, a
 *      data avançada um mês por vez, e todas compartilham o mesmo
 *      `grupo_parcela`. O trigger do banco calcula sozinho o
 *      fatura_mes/fatura_ano de cada uma a partir da data_compra;
 *    - senão, grava como gasto variável em `contas` + `pagamentos`, já
 *      marcado como pago (mesmo padrão de app/gastos/novo/page.js).
 *
 * REQUISITO: variável de ambiente GEMINI_API_KEY configurada no servidor
 * (gerada de graça em https://aistudio.google.com/apikey).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { CATEGORIAS } from "../../../lib/contas";

// Reduz a foto antes de enviar (fotos de celular costumam vir enormes).
// Isso deixa o envio mais rápido e mais barato pra IA.
function comprimirImagem(arquivo, larguraMax = 1280, qualidade = 0.75) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const escala = Math.min(1, larguraMax / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", qualidade);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = leitor.result;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

function formatarMoedaSimples(valor) {
  if (!Number.isFinite(valor)) return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Soma `meses` à data mantendo o dia, com clamp pro último dia do mês
// quando o mês de destino for mais curto (ex: dia 31 em fevereiro -> 28/29).
// Mesma função usada em app/cartao/novo/page.js, pra manter o mesmo
// comportamento de fatura entre os dois jeitos de lançar gasto no cartão.
function somarMeses(dataISO, meses) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  const ultimoDiaDoMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(dia, ultimoDiaDoMes));
  return data.toISOString().slice(0, 10);
}

export default function LancarGastoPorIA() {
  const router = useRouter();

  const [cartoes, setCartoes] = useState([]);
  const [previewFoto, setPreviewFoto] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagemOk, setMensagemOk] = useState(null);

  const [form, setForm] = useState(null); // null até a IA extrair algo
  const reconhecimentoRef = useRef(null);
  const suportaVoz =
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    async function carregarCartoes() {
      const { data } = await supabase
        .from("contas")
        .select("id, nome, dia_fechamento")
        .not("dia_fechamento", "is", null)
        .order("nome");
      setCartoes(data ?? []);
    }
    carregarCartoes();
  }, []);

  async function extrair(payload) {
    setErro(null);
    setMensagemOk(null);
    setProcessando(true);
    setForm(null);
    try {
      const resposta = await fetch("/api/ia/extrair-gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resposta.json();
      if (!resposta.ok) {
        setErro(json.error || "Não consegui entender esse gasto. Tente de novo.");
        return;
      }
      const d = json.dados;
      const parcelasDetectadas =
        Number.isFinite(d.numero_parcelas) && d.numero_parcelas > 1 ? String(d.numero_parcelas) : "1";
      setForm({
        descricao: d.descricao ?? "",
        valor: d.valor != null ? String(d.valor) : "",
        data: d.data_compra ?? new Date().toISOString().slice(0, 10),
        categoria: CATEGORIAS.includes(d.categoria) ? d.categoria : "Outros",
        formaPagamento: d.forma_pagamento ?? "pix",
        cartaoId: "",
        cartaoSugerido: d.cartao_sugerido ?? null,
        parcelas: parcelasDetectadas,
      });
    } catch (err) {
      setErro("Não consegui falar com a IA agora. Confira sua internet e tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleFoto(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const dataUrl = await comprimirImagem(arquivo);
    setPreviewFoto(dataUrl);
    const base64 = dataUrl.split(",")[1];
    extrair({ imagemBase64: base64, mimeType: "image/jpeg" });
  }

  function iniciarGravacao() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setGravando(true);
    rec.onerror = () => setGravando(false);
    rec.onend = () => setGravando(false);
    rec.onresult = (event) => {
      const transcricao = event.results[0][0].transcript;
      setPreviewFoto(null);
      extrair({ texto: transcricao });
    };

    reconhecimentoRef.current = rec;
    rec.start();
  }

  function pararGravacao() {
    reconhecimentoRef.current?.stop();
  }

  // Se a IA identificou o nome de um cartão no comprovante (ex: "Nubank"),
  // tenta casar automaticamente com um dos cartões cadastrados.
  useEffect(() => {
    if (!form || form.cartaoId || !form.cartaoSugerido || cartoes.length === 0) return;
    const sugerido = form.cartaoSugerido.toLowerCase();
    const encontrado = cartoes.find((c) => c.nome.toLowerCase().includes(sugerido));
    if (encontrado) {
      setForm((f) => (f ? { ...f, cartaoId: encontrado.id, formaPagamento: "cartao_credito" } : f));
    }
  }, [form, cartoes]);

  const valorNumericoAtual = form ? Number(String(form.valor).replace(",", ".")) : NaN;
  const parcelasAtual = form ? Math.max(1, parseInt(form.parcelas, 10) || 1) : 1;
  const valorPorParcela =
    Number.isFinite(valorNumericoAtual) && parcelasAtual > 0 ? valorNumericoAtual / parcelasAtual : NaN;

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    if (!form.descricao.trim() || !form.valor) {
      setErro("Preencha ao menos a descrição e o valor.");
      return;
    }
    const valorNumerico = Number(String(form.valor).replace(",", "."));
    if (!valorNumerico || valorNumerico <= 0) {
      setErro("Informe um valor válido.");
      return;
    }

    setSalvando(true);

    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      router.replace("/login");
      return;
    }

    if (form.formaPagamento === "cartao_credito" && form.cartaoId) {
      const parcelas = Math.max(1, parseInt(form.parcelas, 10) || 1);
      const valorParcela = Number((valorNumerico / parcelas).toFixed(2));
      const grupoParcela = parcelas > 1 ? crypto.randomUUID() : null;

      // Uma linha por parcela, cada uma num mes seguinte, igual ao fluxo
      // manual de app/cartao/novo/page.js. Sem isso, so a 1a parcela era
      // lancada e as seguintes nunca apareciam nas faturas futuras.
      const linhas = Array.from({ length: parcelas }).map((_, i) => ({
        user_id: sessao.session.user.id,
        cartao_id: form.cartaoId,
        descricao:
          parcelas > 1 ? `${form.descricao.trim()} (${i + 1}/${parcelas})` : form.descricao.trim(),
        valor: valorParcela,
        categoria: form.categoria,
        data_compra: somarMeses(form.data, i),
        parcela_atual: i + 1,
        parcela_total: parcelas,
        grupo_parcela: grupoParcela,
      }));

      const { error } = await supabase.from("gastos_cartao").insert(linhas);
      setSalvando(false);
      if (error) {
        setErro("Erro ao salvar: " + error.message);
        return;
      }
      setMensagemOk(
        parcelas > 1
          ? `Gasto lançado no cartão! ${parcelas}x de ${formatarMoedaSimples(valorParcela)}.`
          : "Gasto lançado no cartão!"
      );
      setForm(null);
      setPreviewFoto(null);
      return;
    }

    // Sem cartão selecionado: entra como gasto variável já pago, igual ao
    // fluxo de app/gastos/novo/page.js.
    const dataObj = new Date(form.data + "T00:00:00");
    const { data: contaCriada, error: erroConta } = await supabase
      .from("contas")
      .insert({
        user_id: sessao.session.user.id,
        nome: form.descricao.trim(),
        categoria: form.categoria,
        dia_vencimento: dataObj.getDate(),
        valor_esperado: valorNumerico,
        forma_pagamento: form.formaPagamento,
        tipo: "variavel",
      })
      .select()
      .single();

    if (erroConta) {
      setSalvando(false);
      setErro("Erro ao salvar: " + erroConta.message);
      return;
    }

    await supabase.from("pagamentos").insert({
      conta_id: contaCriada.id,
      mes: dataObj.getMonth() + 1,
      ano: dataObj.getFullYear(),
      status: "pago",
      valor_pago: valorNumerico,
      data_pagamento: form.data,
    });

    setSalvando(false);
    setMensagemOk("Gasto lançado!");
    setForm(null);
    setPreviewFoto(null);
  }

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-xs text-ledger underline">
        &larr; Voltar ao dashboard
      </Link>
      <p className="font-display text-2xl mt-2 mb-1">Lançar por foto ou voz</p>
      <p className="text-xs text-ink-soft mb-6">
        Tire uma foto do comprovante ou fale o gasto — a IA preenche o resto.
      </p>

      {!form && (
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-ledger/50 transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-soft">
              <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <circle cx="12" cy="12.5" r="3.5" />
            </svg>
            <span className="text-sm text-ink-soft">Tirar foto / anexar comprovante</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFoto}
              className="hidden"
            />
          </label>

          {suportaVoz && (
            <button
              type="button"
              onClick={gravando ? pararGravacao : iniciarGravacao}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-colors ${
                gravando
                  ? "bg-stamp-red-bg text-stamp-red border border-stamp-red/30"
                  : "bg-surface-soft text-ink border border-border hover:border-ledger/50"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 21v-4" />
              </svg>
              {gravando ? "Ouvindo... toque pra parar" : "Falar o gasto"}
            </button>
          )}

          {previewFoto && (
            <img src={previewFoto} alt="Comprovante" className="rounded-lg border border-border max-h-64 object-contain" />
          )}

          {processando && <p className="text-sm text-ink-soft text-center">Lendo o gasto...</p>}
          {erro && <p className="text-sm text-stamp-red text-center">{erro}</p>}
          {mensagemOk && <p className="text-sm text-stamp-green text-center">{mensagemOk}</p>}
        </div>
      )}

      {form && (
        <form onSubmit={salvar} className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          {previewFoto && (
            <img src={previewFoto} alt="Comprovante" className="rounded-lg border border-border max-h-48 object-contain" />
          )}

          <p className="text-xs text-ledger">A IA já preencheu — confira antes de salvar.</p>

          <div>
            <label className="text-xs text-ink-soft block mb-1">Descrição</label>
            <input
              type="text"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="w-full border border-border bg-surface-soft rounded-md px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-soft block mb-1">Valor total (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className="w-full border border-border bg-surface-soft rounded-md px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-xs text-ink-soft block mb-1">Data</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="w-full border border-border bg-surface-soft rounded-md px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-soft block mb-1">Categoria</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full border border-border bg-surface-soft rounded-md px-3 py-2 text-sm text-ink"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-ink-soft block mb-1">Forma de pagamento</label>
            <select
              value={form.formaPagamento}
              onChange={(e) => setForm({ ...form, formaPagamento: e.target.value, cartaoId: "" })}
              className="w-full border border-border bg-surface-soft rounded-md px-3 py-2 text-sm text-ink"
            >
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </div>

          {form.formaPagamento === "cartao_credito" && (
            <div>
              <label className="text-xs text-ink-soft block mb-1">Qual cartão?</label>
              <select
                value={form.cartaoId}
                onChange={(e) => setForm({ ...form, cartaoId: e.target.value })}
                className="w-full border border-border bg-surface-soft rounded-md px-3 py-2 text-sm text-ink"
              >
                <option value="">Não lançar em nenhum cartão (gasto avulso)</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <p className="text-[11px] text-ink-soft mt-1">
                Escolhendo um cartão, o gasto entra direto na fatura dele em <code>/cartao</code>.
              </p>

              {form.cartaoId && (
                <div className="mt-3">
                  <label className="text-xs text-ink-soft block mb-1">Em quantas vezes foi parcelado?</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.parcelas}
                    onChange={(e) => setForm({ ...form, parcelas: e.target.value })}
                    className="w-full border border-border bg-surface-soft rounded-md px-3 py-2 text-sm text-ink"
                  />
                  {parcelasAtual > 1 && Number.isFinite(valorPorParcela) && (
                    <p className="text-[11px] text-ink-soft mt-1">
                      Vai entrar na fatura como {parcelasAtual}x de {formatarMoedaSimples(valorPorParcela)},
                      {" "}uma parcela por mês (não o valor total de uma vez).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {erro && <p className="text-sm text-stamp-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-ledger hover:bg-ledger-dark text-[#07090B] rounded-md py-2.5 font-semibold transition-colors disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Confirmar e salvar"}
            </button>
            <button
              type="button"
              onClick={() => { setForm(null); setPreviewFoto(null); setErro(null); }}
              disabled={salvando}
              className="px-4 rounded-md border border-border text-ink-soft text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
