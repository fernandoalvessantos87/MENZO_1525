"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import {
  calcularStatus,
  STATUS_LABEL,
  STATUS_CLASSES,
  formatarMoeda,
  NOMES_MESES,
  slugify,
} from "../../lib/contas";

const FORMA_PAGAMENTO_LABEL = {
  cartao_credito: "Cartão de crédito",
  cartao: "Cartão de crédito",
  debito: "Débito automático",
  pix: "Pix",
  dinheiro: "Dinheiro",
};

const PALETA_CATEGORIAS = [
  "#E8B4B8",
  "#F4A261",
  "#E9C46A",
  "#8AB17D",
  "#2A9D8F",
  "#6FA8DC",
  "#9D8DF1",
  "#C77DFF",
  "#F28482",
  "#84A98C",
];

function corDaCategoria(nome, indice) {
  return PALETA_CATEGORIAS[indice % PALETA_CATEGORIAS.length];
}

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

function IconeChevron({ aberto }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`shrink-0 transition-transform duration-200 ${aberto ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// Gráfico de rosca (donut) em SVG puro. Cada categoria da legenda é
// clicável: ao clicar, expande a lista dos itens que compõem aquele total.
function GraficoCategorias({ dados }) {
  const [categoriaAberta, setCategoriaAberta] = useState(null);

  const total = dados.reduce((soma, d) => soma + d.valor, 0);
  if (total <= 0) return null;

  const raio = 60;
  const espessura = 22;
  const raioInterno = raio - espessura;
  const circunferencia = 2 * Math.PI * raio;

  let acumulado = 0;
  const fatias = dados.map((d, i) => {
    const fracao = d.valor / total;
    const comprimento = fracao * circunferencia;
    const offset = circunferencia * 0.25 - acumulado;
    acumulado += comprimento;
    return {
      ...d,
      cor: corDaCategoria(d.categoria, i),
      comprimento,
      offset,
      percentual: fracao * 100,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-start gap-6">
      <svg viewBox="0 0 140 140" width="180" height="180" className="shrink-0 mx-auto sm:mx-0">
        <circle cx="70" cy="70" r={raio} fill="none" stroke="var(--tw-color-surface-soft, #241a1c)" strokeWidth={espessura} />
        {fatias.map((f, i) => (
          <circle
            key={i}
            cx="70"
            cy="70"
            r={raio}
            fill="none"
            stroke={f.cor}
            strokeWidth={espessura}
            strokeDasharray={`${f.comprimento} ${circunferencia - f.comprimento}`}
            strokeDashoffset={f.offset}
            strokeLinecap="butt"
            opacity={categoriaAberta && categoriaAberta !== f.categoria ? 0.35 : 1}
            style={{ cursor: "pointer", transition: "opacity 0.15s" }}
            onClick={() => setCategoriaAberta((c) => (c === f.categoria ? null : f.categoria))}
          />
        ))}
        <circle cx="70" cy="70" r={raioInterno - 2} fill="none" />
        <text x="70" y="65" textAnchor="middle" className="fill-ink-soft" style={{ fontSize: "9px" }}>
          Total
        </text>
        <text x="70" y="80" textAnchor="middle" className="fill-ink" style={{ fontSize: "12px", fontWeight: 600 }}>
          {formatarMoeda(total).replace("R$", "").trim()}
        </text>
      </svg>

      <div className="w-full flex flex-col gap-1 min-w-0">
        {fatias.map((f, i) => {
          const aberta = categoriaAberta === f.categoria;
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setCategoriaAberta((c) => (c === f.categoria ? null : f.categoria))}
                className="w-full flex items-center gap-2 min-w-0 py-1 hover:bg-surface-soft rounded px-1 -mx-1 text-left transition-colors"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: f.cor }}
                />
                <span className="text-sm truncate flex-1">{f.categoria}</span>
                <span className="text-xs text-ink-soft shrink-0">{f.percentual.toFixed(0)}%</span>
                <span className="text-sm font-medium shrink-0 w-20 text-right">
                  {formatarMoeda(f.valor)}
                </span>
                <span className="text-ink-soft shrink-0">
                  <IconeChevron aberto={aberta} />
                </span>
              </button>

              {aberta && (
                <div className="ml-4 mb-2 border-l border-border pl-3 flex flex-col gap-1.5 py-1">
                  {f.itens.map((item, j) => (
                    <div key={j} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="text-ink break-words">{item.nome}</p>
                        <p className="text-ink-soft">{item.subtitulo}</p>
                      </div>
                      <p className="text-ink-soft shrink-0">{formatarMoeda(item.valor)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [contas, setContas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [parcelasPagas, setParcelasPagas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [totalGastosCartao, setTotalGastosCartao] = useState(0);
  const [gastosCartaoDetalhado, setGastosCartaoDetalhado] = useState([]);
  const [cartoesPorId, setCartoesPorId] = useState({});
  const [usuario, setUsuario] = useState(null);
  const [enviandoId, setEnviandoId] = useState(null);
  const [apagandoId, setApagandoId] = useState(null);
  const [erroUpload, setErroUpload] = useState(null);
  const [erroApagar, setErroApagar] = useState(null);
  const [graficoAberto, setGraficoAberto] = useState(true);
  const [reembolsoAberto, setReembolsoAberto] = useState(false);
  const inputsRef = useRef({});

  // --- Receitas ---
  const [receitas, setReceitas] = useState([]);
  const [receitasAberto, setReceitasAberto] = useState(true);
  const [edicaoReceitaId, setEdicaoReceitaId] = useState(null); // id existente, ou "novo_<tipo>" pra criar
  const [formReceita, setFormReceita] = useState({ nome: "", valor: "" });
  const [salvandoReceita, setSalvandoReceita] = useState(false);

  // --- Reembolso (adicionar/editar/excluir) ---
  const [formReembolsoAberto, setFormReembolsoAberto] = useState(false);
  const [edicaoReembolsoId, setEdicaoReembolsoId] = useState(null);
  const [formReembolso, setFormReembolso] = useState({
    cartao_id: "",
    descricao: "",
    valor: "",
    data_compra: new Date().toISOString().slice(0, 10),
  });
  const [salvandoReembolso, setSalvandoReembolso] = useState(false);

  const [gruposAbertos, setGruposAbertos] = useState({
    rotativas: false,
    fixas: false,
    variaveis: false,
  });

  function alternarGrupo(chave) {
    setGruposAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }));
  }

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      router.replace("/login");
      return;
    }
    setUsuario(sessao.session.user);

    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .order("dia_vencimento", { ascending: true });

    const contasSemCartoes = (contasData ?? []).filter((c) => !c.dia_fechamento);
    const cartoesData = (contasData ?? []).filter((c) => c.dia_fechamento);
    const idsCartoes = cartoesData.map((c) => c.id);

    const mapaCartoes = {};
    cartoesData.forEach((c) => {
      mapaCartoes[c.id] = c;
    });
    setCartoesPorId(mapaCartoes);

    const { data: pagamentosData } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("mes", mes)
      .eq("ano", ano);

    setContas(contasSemCartoes);
    setPagamentos(pagamentosData ?? []);

    const { data: receitasData } = await supabase
      .from("receitas")
      .select("*")
      .eq("mes", mes)
      .eq("ano", ano)
      .order("criado_em", { ascending: true });

    setReceitas(receitasData ?? []);

    if (idsCartoes.length > 0) {
      const { data: gastosCartaoData } = await supabase
        .from("gastos_cartao")
        .select("id, cartao_id, descricao, valor, categoria, data_compra, parcela_atual, parcela_total")
        .eq("fatura_mes", mes)
        .eq("fatura_ano", ano)
        .in("cartao_id", idsCartoes);

      const lista = gastosCartaoData ?? [];
      setGastosCartaoDetalhado(lista);
      const somaGastosCartao = lista.reduce((soma, g) => soma + Number(g.valor ?? 0), 0);
      setTotalGastosCartao(somaGastosCartao);
    } else {
      setGastosCartaoDetalhado([]);
      setTotalGastosCartao(0);
    }

    const idsComParcela = contasSemCartoes
      .filter((c) => c.parcela_total)
      .map((c) => c.id);

    if (idsComParcela.length > 0) {
      const { data: pagasData } = await supabase
        .from("pagamentos")
        .select("conta_id")
        .eq("status", "pago")
        .in("conta_id", idsComParcela);

      const contagem = {};
      (pagasData ?? []).forEach((p) => {
        contagem[p.conta_id] = (contagem[p.conta_id] ?? 0) + 1;
      });
      setParcelasPagas(contagem);
    } else {
      setParcelasPagas({});
    }

    setCarregando(false);
  }, [mes, ano, router]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function marcarComoPago(conta) {
    const existente = pagamentos.find((p) => p.conta_id === conta.id);
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

    if (existente) {
      await supabase.from("pagamentos").update(payload).eq("id", existente.id);
    } else {
      await supabase.from("pagamentos").insert(payload);
    }
    carregarDados();
  }

  async function desfazerPagamento(conta) {
    const existente = pagamentos.find((p) => p.conta_id === conta.id);
    if (!existente) return;

    const confirmar = window.confirm(
      `Desfazer o pagamento de "${conta.nome}" neste mes? Isso limpa o status, valor e comprovante marcados.`
    );
    if (!confirmar) return;

    await supabase.from("pagamentos").delete().eq("id", existente.id);
    carregarDados();
  }

  async function anexarComprovante(conta, arquivo) {
    if (!arquivo || !usuario) return;
    setErroUpload(null);
    setEnviandoId(conta.id);

    const extensao = arquivo.name.split(".").pop();
    const caminho = `${usuario.id}/${slugify(conta.nome)}/${ano}-${String(mes).padStart(2, "0")}.${extensao}`;

    const { error: erroEnvio } = await supabase.storage
      .from("comprovantes")
      .upload(caminho, arquivo, { upsert: true });

    if (erroEnvio) {
      setErroUpload("Nao foi possivel enviar o comprovante. Tente novamente.");
      setEnviandoId(null);
      return;
    }

    const existente = pagamentos.find((p) => p.conta_id === conta.id);
    const payload = {
      conta_id: conta.id,
      mes,
      ano,
      comprovante_url: caminho,
    };

    if (existente) {
      await supabase.from("pagamentos").update(payload).eq("id", existente.id);
    } else {
      await supabase.from("pagamentos").insert({ ...payload, status: "no_prazo" });
    }

    setEnviandoId(null);
    carregarDados();
  }

  async function abrirComprovante(caminho) {
    const { data, error } = await supabase.storage
      .from("comprovantes")
      .createSignedUrl(caminho, 60);

    if (!error && data) {
      window.open(data.signedUrl, "_blank");
    }
  }

  async function apagarConta(conta) {
    const confirmar = window.confirm(
      `Tem certeza que deseja apagar a conta "${conta.nome}"? Isso também apaga os pagamentos e comprovantes registrados dela. Essa ação não pode ser desfeita.`
    );
    if (!confirmar) return;

    setErroApagar(null);
    setApagandoId(conta.id);

    const { error: erroPagamentos } = await supabase
      .from("pagamentos")
      .delete()
      .eq("conta_id", conta.id);

    if (erroPagamentos) {
      setErroApagar("Nao foi possivel apagar os pagamentos dessa conta. Tente novamente.");
      setApagandoId(null);
      return;
    }

    const { error: erroConta } = await supabase
      .from("contas")
      .delete()
      .eq("id", conta.id);

    if (erroConta) {
      setErroApagar("Nao foi possivel apagar a conta. Tente novamente.");
      setApagandoId(null);
      return;
    }

    setApagandoId(null);
    carregarDados();
  }

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // --- Receitas ---

  function iniciarEdicaoReceita(receita, tipo, nomePadrao) {
    if (receita) {
      setEdicaoReceitaId(receita.id);
      setFormReceita({ nome: receita.nome, valor: String(receita.valor ?? "") });
    } else {
      setEdicaoReceitaId(`novo_${tipo}`);
      setFormReceita({ nome: nomePadrao, valor: "" });
    }
  }

  function cancelarEdicaoReceita() {
    setEdicaoReceitaId(null);
  }

  async function salvarReceita(tipo) {
    if (!formReceita.nome.trim() || !formReceita.valor) {
      alert("Preencha o nome e o valor.");
      return;
    }
    setSalvandoReceita(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSalvandoReceita(false);
      alert("Sessão expirada. Atualize a página e faça login novamente.");
      return;
    }

    const payload = {
      usuario_id: user.id,
      tipo,
      nome: formReceita.nome.trim(),
      valor: parseFloat(String(formReceita.valor).replace(",", ".")),
      mes,
      ano,
    };

    const ehNova = String(edicaoReceitaId).startsWith("novo_");
    const { error } = ehNova
      ? await supabase.from("receitas").insert(payload)
      : await supabase.from("receitas").update(payload).eq("id", edicaoReceitaId);

    setSalvandoReceita(false);

    if (error) {
      alert("Erro ao salvar a receita: " + error.message);
      return;
    }

    setEdicaoReceitaId(null);
    carregarDados();
  }

  async function excluirReceita(receita) {
    const confirmar = window.confirm(`Excluir a receita "${receita.nome}"?`);
    if (!confirmar) return;

    const { error } = await supabase.from("receitas").delete().eq("id", receita.id);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }
    carregarDados();
  }

  // --- Reembolso ---

  function abrirNovoReembolso() {
    const primeiroCartaoId = Object.keys(cartoesPorId)[0] ?? "";
    setEdicaoReembolsoId(null);
    setFormReembolso({
      cartao_id: primeiroCartaoId,
      descricao: "",
      valor: "",
      data_compra: new Date().toISOString().slice(0, 10),
    });
    setFormReembolsoAberto(true);
  }

  function iniciarEdicaoReembolso(item) {
    setEdicaoReembolsoId(item.id);
    setFormReembolso({
      cartao_id: item.cartao_id,
      descricao: item.descricao ?? "",
      valor: String(item.valor ?? ""),
      data_compra: item.data_compra ?? new Date().toISOString().slice(0, 10),
    });
    setFormReembolsoAberto(true);
  }

  function cancelarFormReembolso() {
    setFormReembolsoAberto(false);
    setEdicaoReembolsoId(null);
  }

  async function salvarReembolso() {
    if (!formReembolso.cartao_id || !formReembolso.descricao.trim() || !formReembolso.valor) {
      alert("Escolha o cartão e preencha a descrição e o valor.");
      return;
    }
    setSalvandoReembolso(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSalvandoReembolso(false);
      alert("Sessão expirada. Atualize a página e faça login novamente.");
      return;
    }

    const payload = {
      user_id: user.id,
      cartao_id: formReembolso.cartao_id,
      descricao: formReembolso.descricao.trim(),
      valor: parseFloat(String(formReembolso.valor).replace(",", ".")),
      categoria: "Reembolso",
      data_compra: formReembolso.data_compra,
    };

    const { error } = edicaoReembolsoId
      ? await supabase.from("gastos_cartao").update(payload).eq("id", edicaoReembolsoId)
      : await supabase.from("gastos_cartao").insert(payload);

    setSalvandoReembolso(false);

    if (error) {
      alert("Erro ao salvar o reembolso: " + error.message);
      return;
    }

    setFormReembolsoAberto(false);
    setEdicaoReembolsoId(null);
    carregarDados();
  }

  async function excluirReembolso(item) {
    const confirmar = window.confirm(`Excluir o reembolso "${item.descricao}"?`);
    if (!confirmar) return;

    const { error } = await supabase.from("gastos_cartao").delete().eq("id", item.id);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }
    carregarDados();
  }

  const linhas = contas.map((conta) => {
    const pagamento = pagamentos.find((p) => p.conta_id === conta.id);
    const status = calcularStatus(conta.dia_vencimento, mes, ano, pagamento);
    return { conta, pagamento, status };
  });

  const linhasFixasRotativas = linhas.filter((l) => l.conta.tipo !== "variavel");
  const linhasVariaveisDoMes = linhas.filter(
    (l) => l.conta.tipo === "variavel" && l.pagamento
  );
  const linhasVisiveis = [...linhasFixasRotativas, ...linhasVariaveisDoMes];

  const total =
    linhasFixasRotativas.reduce((soma, l) => soma + Number(l.conta.valor_esperado ?? 0), 0) +
    linhasVariaveisDoMes.reduce((soma, l) => soma + Number(l.conta.valor_esperado ?? 0), 0) +
    totalGastosCartao;

  const contagem = {
    pago: linhasVisiveis.filter((l) => l.status === "pago").length,
    no_prazo: linhasVisiveis.filter((l) => l.status === "no_prazo").length,
    vencido: linhasVisiveis.filter((l) => l.status === "vencido").length,
  };

  // Monta o total por categoria E a lista dos itens que compõem cada uma,
  // pra alimentar o gráfico com drill-down.
  const totaisPorCategoriaMap = {};

  // Normaliza nomes de categoria que vieram divergentes do cadastro livre,
  // ou que foram renomeados/fundidos depois, pra não duplicar fatia no
  // gráfico e pra dados antigos já salvos com o nome velho aparecerem com
  // o nome novo:
  // - "Assinatura"/"assinaturas"/"Seguro" -> "Assinaturas"
  // - "Comprar"/"Compras" -> "Outros"
  // - "Gasto(s) do/com o carro" -> "Transporte" (nome antigo da categoria)
  // - "Mensalidade(s)"/"Gastos com a MEI"/"MEI" -> "Trabalho" (nome antigo)
  // - "Estudo"/"Estudos" -> "Educação" (nome antigo da categoria)
  // - "Casa" -> "Moradia" (nome antigo da categoria)
  // - "Mercado"/"Supermercado" -> "Alimentação" (sentido novo, mercado/supermercado)
  // - "Estética" -> "Cuidados Pessoais" (nome antigo da categoria)
  function normalizarCategoria(categoriaBruta) {
    const cat = (categoriaBruta || "Outros").trim();
    const catLower = cat.toLowerCase();
    if (catLower === "assinatura" || catLower === "assinaturas" || catLower === "seguro") {
      return "Assinaturas";
    }
    if (catLower === "comprar" || catLower === "compras") return "Outros";
    if (
      catLower === "gasto do carro" ||
      catLower === "gastos do carro" ||
      catLower === "gasto com o carro" ||
      catLower === "gastos com o carro" ||
      catLower === "transporte"
    ) {
      return "Transporte";
    }
    if (
      catLower === "mensalidade" ||
      catLower === "mensalidades" ||
      catLower === "gastos com a mei" ||
      catLower === "gasto com a mei" ||
      catLower === "mei" ||
      catLower === "trabalho"
    ) {
      return "Trabalho";
    }
    if (catLower === "estudo" || catLower === "estudos" || catLower === "educação" || catLower === "educacao") {
      return "Educação";
    }
    if (catLower === "casa" || catLower === "moradia") return "Moradia";
    if (catLower === "estética" || catLower === "estetica" || catLower === "cuidados pessoais") {
      return "Cuidados Pessoais";
    }
    // "Mercado"/"Supermercado" viram a nova "Alimentação" (compra de
    // mercado) — isso é seguro porque são palavras diferentes.
    if (catLower === "mercado" || catLower === "supermercado") return "Alimentação";
    // OBS: não existe mais uma regra automática pra "Alimentação" pura,
    // porque o texto "Alimentação" agora tem dois sentidos possíveis
    // (o antigo, tipo restaurante, e o novo, tipo mercado) e não dá pra
    // adivinhar qual é qual só pelo texto salvo. Itens antigos que eram
    // "Alimentação" no sentido de restaurante precisam ser editados à
    // mão pra "Restaurantes e Delivery" se for o caso.
    return cat;
  }

  function adicionarItem(categoriaBruta, item) {
    const cat = normalizarCategoria(categoriaBruta);
    if (!totaisPorCategoriaMap[cat]) {
      totaisPorCategoriaMap[cat] = { categoria: cat, valor: 0, itens: [] };
    }
    totaisPorCategoriaMap[cat].valor += item.valor;
    totaisPorCategoriaMap[cat].itens.push(item);
  }

  linhasVisiveis.forEach((l) => {
    adicionarItem(l.conta.categoria, {
      nome: l.conta.nome,
      valor: Number(l.conta.valor_esperado ?? 0),
      subtitulo:
        l.conta.tipo === "variavel"
          ? "Gasto variável"
          : `Todo dia ${l.conta.dia_vencimento}`,
    });
  });

  gastosCartaoDetalhado.forEach((g) => {
    adicionarItem(g.categoria, {
      nome: g.descricao,
      valor: Number(g.valor ?? 0),
      subtitulo:
        new Date(g.data_compra + "T00:00:00").toLocaleDateString("pt-BR") +
        (g.parcela_total > 1 ? ` · Parcela ${g.parcela_atual}/${g.parcela_total}` : " · Cartão"),
    });
  });

  const totaisPorCategoria = Object.values(totaisPorCategoriaMap)
    .filter((d) => d.valor > 0)
    .map((d) => ({ ...d, itens: d.itens.sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => b.valor - a.valor);

  // "Reembolso" é dinheiro que passou pelo cartão mas volta pra você (ex:
  // emprestou o cartão pra alguém pagar depois). Ele conta no total da
  // fatura do cartão (app/cartao), mas fica de fora do total de gastos
  // do dashboard — por isso é retirado daqui antes de alimentar o
  // gráfico de rosca, e mostrado à parte, só como informação.
  const totaisParaGrafico = totaisPorCategoria.filter((d) => d.categoria !== "Reembolso");

  // Itens de reembolso com os dados brutos (id, cartao_id) do gasto no
  // cartão, pra dar pra editar e excluir direto aqui no dashboard.
  const reembolsos = gastosCartaoDetalhado.filter((g) => g.categoria === "Reembolso");
  const totalReembolsos = reembolsos.reduce((soma, g) => soma + Number(g.valor ?? 0), 0);

  // Receitas do mês: fixa (titular), fixa (outra) e variáveis (afiliados
  // etc, podem ter vários itens no mesmo mês).
  const receitaTitular = receitas.find((r) => r.tipo === "fixa_titular") ?? null;
  const receitaOutra = receitas.find((r) => r.tipo === "fixa_outra") ?? null;
  const receitasVariaveis = receitas.filter((r) => r.tipo === "variavel");
  const totalReceitas =
    Number(receitaTitular?.valor ?? 0) +
    Number(receitaOutra?.valor ?? 0) +
    receitasVariaveis.reduce((soma, r) => soma + Number(r.valor ?? 0), 0);
  const saldoPrevisto = totalReceitas - total;

  function mudarMes(delta) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno += 1; }
    if (novoMes < 1) { novoMes = 12; novoAno -= 1; }
    setMes(novoMes);
    setAno(novoAno);
  }

  const grupoRotativas = linhasVisiveis.filter((l) => l.conta.rotativo);
  const grupoFixas = linhasVisiveis.filter((l) => !l.conta.rotativo && l.conta.tipo !== "variavel");

  const grupoVariaveis = linhasVisiveis.filter(
    (l) => !l.conta.rotativo && l.conta.tipo === "variavel"
  );

  function renderLinha({ conta, pagamento, status }) {
    const responsavelCalculado = conta.rotativo
      ? calcularResponsavelRotativo(conta, mes, ano)
      : null;
    const responsavel = pagamento?.responsavel || responsavelCalculado;
    const parcelasPagasConta =
      (conta.parcelas_pagas_manual ?? 0) + (parcelasPagas[conta.id] ?? 0);
    const quitado = conta.parcela_total && parcelasPagasConta >= conta.parcela_total;

    return (
      <div
        key={conta.id}
        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
      >
        <div className="min-w-0">
          <p className="font-medium break-words">{conta.nome}</p>
          <p className="text-xs text-ink-soft">
            Dia {conta.dia_vencimento} - {conta.categoria}
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {conta.forma_pagamento && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-ledger-bg text-ledger">
                {FORMA_PAGAMENTO_LABEL[conta.forma_pagamento] ?? conta.forma_pagamento}
              </span>
            )}
            {responsavel && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-lime-bg text-lime">
                Vez de: {responsavel}
              </span>
            )}
            {conta.parcela_total && quitado && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-stamp-green-bg text-stamp-green">
                Quitado ✓
              </span>
            )}
            {conta.parcela_total && !quitado && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-surface-soft text-ink-soft">
                Parcela {Math.min(parcelasPagasConta + (status === "pago" ? 0 : 1), conta.parcela_total)} de {conta.parcela_total}
                {" "}(faltam {Math.max(conta.parcela_total - parcelasPagasConta, 0)})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{formatarMoeda(conta.valor_esperado)}</p>
            <span className={`stamp ${STATUS_CLASSES[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:justify-end">
          {status !== "pago" && !quitado && (
            <button
              onClick={() => marcarComoPago(conta)}
              className="text-xs text-ledger underline"
            >
              Marcar pago
            </button>
          )}

          {status === "pago" && (
            <button
              onClick={() => desfazerPagamento(conta)}
              className="text-xs text-stamp-amber underline"
            >
              Desfazer
            </button>
          )}

          <input
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            ref={(el) => (inputsRef.current[conta.id] = el)}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) anexarComprovante(conta, arquivo);
              e.target.value = "";
            }}
          />

          {pagamento?.comprovante_url ? (
            <button
              onClick={() => abrirComprovante(pagamento.comprovante_url)}
              className="text-xs text-ink-soft underline"
            >
              Ver comprovante
            </button>
          ) : null}

          <button
            onClick={() => inputsRef.current[conta.id]?.click()}
            disabled={enviandoId === conta.id}
            className="text-xs text-ledger underline disabled:opacity-60"
          >
            {enviandoId === conta.id
              ? "Enviando..."
              : pagamento?.comprovante_url
              ? "Trocar comprovante"
              : "Anexar comprovante"}
          </button>

          <Link
            href={`/contas/${conta.id}/comprovantes`}
            className="text-xs text-ink-soft underline"
          >
            Comprovantes
          </Link>

          <Link
            href={`/contas/${conta.id}/editar`}
            className="text-xs text-ledger underline"
          >
            Editar
          </Link>

          <button
            onClick={() => apagarConta(conta)}
            disabled={apagandoId === conta.id}
            className="text-xs text-stamp-red underline disabled:opacity-60"
          >
            {apagandoId === conta.id ? "Apagando..." : "Apagar"}
          </button>
        </div>
      </div>
    );
  }

  function renderGrupo(chave, titulo, itens) {
    if (itens.length === 0) return null;

    const aberto = gruposAbertos[chave];
    const totalGrupo = itens.reduce((soma, l) => soma + Number(l.conta.valor_esperado ?? 0), 0);
    const pagas = itens.filter((l) => l.status === "pago").length;
    const vencidas = itens.filter((l) => l.status === "vencido").length;
    const pendentes = itens.length - pagas;

    return (
      <div className="mb-4 bg-surface border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => alternarGrupo(chave)}
          aria-expanded={aberto}
          className="w-full flex flex-col gap-3 px-4 py-4 text-left hover:bg-surface-soft transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-ink-soft">
              <IconeChevron aberto={aberto} />
            </span>
            <div>
              <p className="font-display text-lg leading-tight">{titulo}</p>
              <p className="text-xs text-ink-soft">
                {itens.length} {itens.length === 1 ? "item" : "itens"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pl-8 sm:pl-0 sm:justify-end sm:gap-6">
            <div className="text-left sm:text-right">
              <p className="text-[11px] text-ink-soft">Total do bloco</p>
              <p className="font-display text-base">{formatarMoeda(totalGrupo)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              <span className="text-[11px] px-2 py-0.5 rounded bg-stamp-green-bg text-stamp-green whitespace-nowrap">
                {pagas} paga{pagas === 1 ? "" : "s"}
              </span>
              {pendentes > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-stamp-amber-bg text-stamp-amber whitespace-nowrap">
                  {pendentes} pendente{pendentes === 1 ? "" : "s"}
                </span>
              )}
              {vencidas > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-stamp-red-bg text-stamp-red whitespace-nowrap">
                  {vencidas} vencida{vencidas === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        </button>

        {aberto && (
          <div className="border-t border-border divide-y divide-border">
            {itens.map(renderLinha)}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-2xl">Minhas Contas</p>
          {usuario && <p className="text-xs text-ink-soft">{usuario.email}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2 sm:justify-end">
          <Link
            href="/calendario"
            className="text-sm text-ledger px-3 py-2 font-medium text-center sm:text-left"
          >
            Calendario
          </Link>
          <Link
            href="/cartao"
            className="text-sm text-ledger px-3 py-2 font-medium text-center sm:text-left"
          >
            Fatura do cartão
          </Link>
          <Link
            href="/contas/nova"
            className="text-sm bg-ledger text-white px-3 py-2 rounded-md font-medium hover:bg-ledger-dark text-center"
          >
            + Nova conta
          </Link>
          <Link
            href="/gastos/novo"
            className="text-sm border border-ledger text-ledger px-3 py-2 rounded-md font-medium text-center"
          >
            + Gasto variável
          </Link>
          <Link
            href="/gastos/ia"
            className="text-sm border border-ledger text-ledger px-3 py-2 rounded-md font-medium text-center"
          >
            + Foto/voz
          </Link>
          <button onClick={sair} className="text-sm text-ink-soft px-3 py-2">
            Sair
          </button>
        </div>
      </header>

      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => mudarMes(-1)} aria-label="Mes anterior" className="px-2 text-ink-soft">
          &larr;
        </button>
        <p className="font-medium">{NOMES_MESES[mes - 1]} {ano}</p>
        <button onClick={() => mudarMes(1)} aria-label="Proximo mes" className="px-2 text-ink-soft">
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-ink-soft mb-1">Receita do mes</p>
          <p className="font-display text-xl text-lime">{formatarMoeda(totalReceitas)}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-ink-soft mb-1">Saldo previsto</p>
          <p className={`font-display text-xl ${saldoPrevisto >= 0 ? "text-ledger" : "text-stamp-red"}`}>
            {formatarMoeda(saldoPrevisto)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-ink-soft mb-1">Total do mes</p>
          <p className="font-display text-xl">{formatarMoeda(total)}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-ink-soft mb-1">Pagas</p>
          <p className="font-display text-xl text-stamp-green">{contagem.pago}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-ink-soft mb-1">No prazo</p>
          <p className="font-display text-xl text-stamp-amber">{contagem.no_prazo}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-ink-soft mb-1">Vencidas</p>
          <p className="font-display text-xl text-stamp-red">{contagem.vencido}</p>
        </div>
      </div>

      {!carregando && (
        <div className="mb-6 bg-surface border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setReceitasAberto((a) => !a)}
            aria-expanded={receitasAberto}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-surface-soft transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-ink-soft">
                <IconeChevron aberto={receitasAberto} />
              </span>
              <p className="font-display text-lg leading-tight">Receitas</p>
            </div>
            <p className="text-sm font-medium text-lime">{formatarMoeda(totalReceitas)}</p>
          </button>

          {receitasAberto && (
            <div className="border-t border-border divide-y divide-border">
              {/* Receita fixa: Titular */}
              <div className="px-4 py-3">
                {edicaoReceitaId === receitaTitular?.id || edicaoReceitaId === "novo_fixa_titular" ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={formReceita.nome}
                      onChange={(e) => setFormReceita({ ...formReceita, nome: e.target.value })}
                      placeholder="Nome (ex: Receita Titular)"
                      className="text-sm"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formReceita.valor}
                      onChange={(e) => setFormReceita({ ...formReceita, valor: e.target.value })}
                      placeholder="Lucro do mes no Veloxis"
                      className="text-sm"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => salvarReceita("fixa_titular")}
                        disabled={salvandoReceita}
                        className="text-xs text-ledger underline"
                      >
                        {salvandoReceita ? "Salvando..." : "Salvar"}
                      </button>
                      <button onClick={cancelarEdicaoReceita} className="text-xs text-ink-soft underline">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{receitaTitular?.nome ?? "Receita Titular"}</p>
                      <p className="text-xs text-ink-soft">
                        Receita fixa · Titular · fecha no ultimo dia do mes
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-medium">{formatarMoeda(receitaTitular?.valor ?? 0)}</p>
                      <button
                        onClick={() =>
                          iniciarEdicaoReceita(receitaTitular, "fixa_titular", "Receita Titular")
                        }
                        className="text-xs text-ledger underline"
                      >
                        editar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Receita fixa: Outra */}
              <div className="px-4 py-3">
                {edicaoReceitaId === receitaOutra?.id || edicaoReceitaId === "novo_fixa_outra" ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={formReceita.nome}
                      onChange={(e) => setFormReceita({ ...formReceita, nome: e.target.value })}
                      placeholder="Nome (ex: Receita Outros)"
                      className="text-sm"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formReceita.valor}
                      onChange={(e) => setFormReceita({ ...formReceita, valor: e.target.value })}
                      placeholder="Valor recebido"
                      className="text-sm"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => salvarReceita("fixa_outra")}
                        disabled={salvandoReceita}
                        className="text-xs text-ledger underline"
                      >
                        {salvandoReceita ? "Salvando..." : "Salvar"}
                      </button>
                      <button onClick={cancelarEdicaoReceita} className="text-xs text-ink-soft underline">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{receitaOutra?.nome ?? "Receita Outros"}</p>
                      <p className="text-xs text-ink-soft">Receita fixa · Outra · recebida todo dia 05</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-medium">{formatarMoeda(receitaOutra?.valor ?? 0)}</p>
                      <button
                        onClick={() => iniciarEdicaoReceita(receitaOutra, "fixa_outra", "Receita Outros")}
                        className="text-xs text-ledger underline"
                      >
                        editar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Receitas variaveis */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-medium">Receitas variaveis</p>
                  <p className="text-sm font-medium">
                    {formatarMoeda(receitasVariaveis.reduce((s, r) => s + Number(r.valor ?? 0), 0))}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {receitasVariaveis.map((r) =>
                    edicaoReceitaId === r.id ? (
                      <div key={r.id} className="flex flex-col gap-2 border-l border-border pl-3">
                        <input
                          type="text"
                          value={formReceita.nome}
                          onChange={(e) => setFormReceita({ ...formReceita, nome: e.target.value })}
                          placeholder="Ex: Mercado Livre"
                          className="text-sm"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formReceita.valor}
                          onChange={(e) => setFormReceita({ ...formReceita, valor: e.target.value })}
                          placeholder="Valor"
                          className="text-sm"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => salvarReceita("variavel")}
                            disabled={salvandoReceita}
                            className="text-xs text-ledger underline"
                          >
                            {salvandoReceita ? "Salvando..." : "Salvar"}
                          </button>
                          <button onClick={cancelarEdicaoReceita} className="text-xs text-ink-soft underline">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-2 border-l border-border pl-3"
                      >
                        <p className="text-xs">{r.nome}</p>
                        <div className="flex items-center gap-3 shrink-0">
                          <p className="text-xs font-medium">{formatarMoeda(r.valor)}</p>
                          <button
                            onClick={() => iniciarEdicaoReceita(r, "variavel", r.nome)}
                            className="text-[11px] text-ledger underline"
                          >
                            editar
                          </button>
                          <button
                            onClick={() => excluirReceita(r)}
                            className="text-[11px] text-stamp-red underline"
                          >
                            excluir
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {edicaoReceitaId === "novo_variavel" ? (
                    <div className="flex flex-col gap-2 border-l border-border pl-3">
                      <input
                        type="text"
                        value={formReceita.nome}
                        onChange={(e) => setFormReceita({ ...formReceita, nome: e.target.value })}
                        placeholder="Ex: Mercado Livre, Amazon, Magalu"
                        className="text-sm"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formReceita.valor}
                        onChange={(e) => setFormReceita({ ...formReceita, valor: e.target.value })}
                        placeholder="Valor"
                        className="text-sm"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => salvarReceita("variavel")}
                          disabled={salvandoReceita}
                          className="text-xs text-ledger underline"
                        >
                          {salvandoReceita ? "Salvando..." : "Salvar"}
                        </button>
                        <button onClick={cancelarEdicaoReceita} className="text-xs text-ink-soft underline">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => iniciarEdicaoReceita(null, "variavel", "")}
                      className="text-xs text-ledger underline text-left"
                    >
                      + nova receita variavel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!carregando && totaisParaGrafico.length > 0 && (
        <div className="mb-6 bg-surface border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setGraficoAberto((a) => !a)}
            aria-expanded={graficoAberto}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-surface-soft transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-ink-soft">
                <IconeChevron aberto={graficoAberto} />
              </span>
              <p className="font-display text-lg leading-tight">Gastos por categoria</p>
            </div>
            <p className="text-xs text-ink-soft">{totaisParaGrafico.length} categorias</p>
          </button>

          {graficoAberto && (
            <div className="border-t border-border p-4">
              <p className="text-[11px] text-ink-soft mb-3">
                Clique numa categoria (ou na fatia do gráfico) pra ver o que tem dentro dela.
              </p>
              <GraficoCategorias dados={totaisParaGrafico} />
            </div>
          )}
        </div>
      )}

      {!carregando && Object.keys(cartoesPorId).length > 0 && (
        <div className="mb-6 bg-surface border border-dashed border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setReembolsoAberto((a) => !a)}
            aria-expanded={reembolsoAberto}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-surface-soft transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-ink-soft">
                <IconeChevron aberto={reembolsoAberto} />
              </span>
              <div>
                <p className="font-display text-lg leading-tight">Reembolso</p>
                <p className="text-[11px] text-ink-soft">Não entra no total de gastos acima</p>
              </div>
            </div>
            <p className="text-sm font-medium">{formatarMoeda(totalReembolsos)}</p>
          </button>

          {reembolsoAberto && (
            <div className="border-t border-border p-4 flex flex-col gap-3">
              {reembolsos.length === 0 && !formReembolsoAberto && (
                <p className="text-sm text-ink-soft">Nenhum reembolso lançado neste mês.</p>
              )}

              {reembolsos.map((item) =>
                edicaoReembolsoId === item.id && formReembolsoAberto ? null : (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-ink break-words">{item.descricao}</p>
                      <p className="text-[11px] text-ink-soft">
                        {new Date(item.data_compra + "T00:00:00").toLocaleDateString("pt-BR")} ·{" "}
                        {cartoesPorId[item.cartao_id]?.nome ?? "Cartão"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="font-medium">{formatarMoeda(item.valor)}</p>
                      <button
                        onClick={() => iniciarEdicaoReembolso(item)}
                        className="text-[11px] text-ledger underline"
                      >
                        editar
                      </button>
                      <button
                        onClick={() => excluirReembolso(item)}
                        className="text-[11px] text-stamp-red underline"
                      >
                        excluir
                      </button>
                    </div>
                  </div>
                )
              )}

              {formReembolsoAberto ? (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <select
                    value={formReembolso.cartao_id}
                    onChange={(e) => setFormReembolso({ ...formReembolso, cartao_id: e.target.value })}
                    className="text-sm"
                  >
                    {Object.values(cartoesPorId).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formReembolso.descricao}
                    onChange={(e) => setFormReembolso({ ...formReembolso, descricao: e.target.value })}
                    placeholder="Descricao (ex: Almoço - amigo pagou no Pix)"
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formReembolso.valor}
                      onChange={(e) => setFormReembolso({ ...formReembolso, valor: e.target.value })}
                      placeholder="Valor"
                      className="w-1/2 text-sm"
                    />
                    <input
                      type="date"
                      value={formReembolso.data_compra}
                      onChange={(e) => setFormReembolso({ ...formReembolso, data_compra: e.target.value })}
                      className="w-1/2 text-sm"
                    />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={salvarReembolso}
                      disabled={salvandoReembolso}
                      className="text-xs text-ledger underline"
                    >
                      {salvandoReembolso ? "Salvando..." : "Salvar"}
                    </button>
                    <button onClick={cancelarFormReembolso} className="text-xs text-ink-soft underline">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={abrirNovoReembolso} className="text-xs text-ledger underline text-left">
                  + adicionar reembolso
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {erroUpload && <p className="text-sm text-stamp-red mb-4">{erroUpload}</p>}
      {erroApagar && <p className="text-sm text-stamp-red mb-4">{erroApagar}</p>}

      {carregando ? (
        <p className="text-ink-soft text-sm">Carregando...</p>
      ) : linhasVisiveis.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-ink-soft mb-3">Nenhuma conta cadastrada ainda.</p>
          <Link href="/contas/nova" className="text-ledger font-medium underline">
            Cadastrar a primeira conta
          </Link>
        </div>
      ) : (
        <>
          {renderGrupo("rotativas", "Despesas Rotativas", grupoRotativas)}
          {renderGrupo("fixas", "Despesas Fixas", grupoFixas)}
          {renderGrupo("variaveis", "Despesas Variáveis", grupoVariaveis)}
        </>
      )}
    </main>
  );
}
