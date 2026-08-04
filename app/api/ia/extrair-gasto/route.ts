import { NextRequest, NextResponse } from "next/server";

/**
 * Extrai os dados de um gasto (descrição, valor, data, categoria, forma de
 * pagamento e, se der pra identificar, o cartão) a partir de:
 *  - uma foto de comprovante/nota/print (imagemBase64 + mimeType), ou
 *  - uma frase falada já transcrita pelo navegador (texto).
 *
 * Usa o Gemini (camada gratuita). Precisa da env var GEMINI_API_KEY,
 * gerada em https://aistudio.google.com/apikey e configurada no Vercel
 * (Project Settings -> Environment Variables) e no .env.local local.
 *
 * A lista de categorias abaixo é a MESMA usada em lib/contas.js
 * (CATEGORIAS) e em todas as telas de lançamento do app. Se mudar uma,
 * mude a outra também, pra não voltar a gerar categorias divergentes.
 */

export const runtime = "nodejs";

const MODELO = "gemini-3.5-flash-lite";

const CATEGORIAS_VALIDAS = [
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

const SCHEMA = {
  type: "OBJECT",
  properties: {
    descricao: { type: "STRING" },
    valor: { type: "NUMBER" },
    data_compra: { type: "STRING", description: "Data da compra no formato AAAA-MM-DD" },
    categoria: {
      type: "STRING",
      enum: CATEGORIAS_VALIDAS,
    },
    forma_pagamento: {
      type: "STRING",
      enum: ["cartao_credito", "pix", "debito", "dinheiro"],
    },
    cartao_sugerido: { type: "STRING", nullable: true },
    numero_parcelas: {
      type: "NUMBER",
      description: "Quantidade de parcelas da compra. Se a compra foi feita à vista (sem parcelamento), use 1.",
    },
    valor_parcela: {
      type: "NUMBER",
      description: "Valor de CADA parcela (valor total dividido pelo número de parcelas). Se não houver parcelamento, é igual ao valor total.",
    },
  },
  required: ["descricao", "valor", "data_compra", "categoria", "forma_pagamento", "numero_parcelas", "valor_parcela"],
};

function montarInstrucao(hoje: string) {
  return `Você é um assistente que lê comprovantes de compra (foto de nota fiscal, cupom fiscal, print de pagamento por Pix/cartão) ou uma frase falada em português descrevendo um gasto, e extrai os dados em JSON.

Regras:
- "valor" é sempre o valor TOTAL da compra, em número (ex: 45.9), nunca com "R$" ou texto junto.
- Procure no comprovante por indicações de parcelamento no crédito, como "10X", "10 X", "10 VEZES", "PARC 10/10", "PARCELADO EM 10". Se encontrar:
  - "numero_parcelas" é esse número de parcelas (ex: 10).
  - "valor_parcela" é o valor de cada parcela. Se o comprovante mostrar o valor da parcela diretamente, use-o. Caso contrário, calcule dividindo o valor total pelo número de parcelas (ex: total 1150.00 em 10x = 115.00 por parcela).
- Se NÃO houver nenhuma indicação de parcelamento (compra à vista, débito, pix, dinheiro), use "numero_parcelas": 1 e "valor_parcela" igual ao valor total.
- "data_compra" é a data da compra no formato AAAA-MM-DD. Se não conseguir identificar no comprovante/frase, use a data de hoje: ${hoje}.
- "categoria" deve ser uma destas, a que fizer mais sentido: ${CATEGORIAS_VALIDAS.join(", ")}. Use "Transporte" para manutenção, seguro de veículo, combustível, multas, etc. Use "Moradia" para seguro residencial e contas da casa (água, luz, internet). Use "Alimentação" para mercado/supermercado, e "Restaurantes e Delivery" para comida pronta (restaurante, ifood, lanchonete). Use "Trabalho" para MEI, DAS, ferramentas de trabalho. Use "Cuidados Pessoais" para salão, barbeiro, estética. Use "Reembolso" apenas se o texto deixar claro que é um valor adiantado pra outra pessoa pagar depois (ex: "passei o cartão pro meu primo, ele me paga depois"). Se nenhuma categoria específica fizer sentido, use "Outros".
- "forma_pagamento" deve ser uma destas: cartao_credito, pix, debito, dinheiro. Se o comprovante mostrar claramente um pagamento no crédito, use cartao_credito.
- "cartao_sugerido" só deve ser preenchido se for possível identificar claramente o nome do banco/cartão usado (ex: "Bradesco", "Nubank"). Caso contrário, retorne null.
- "descricao" deve ser curta: o nome do estabelecimento ou do item comprado (ex: "Supermercado Extra", "Uber", "Farmácia São João").

Responda SOMENTE com o JSON pedido, sem nenhum texto adicional.`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada no servidor. Veja o README para configurar." },
      { status: 500 }
    );
  }

  let body: { imagemBase64?: string; mimeType?: string; texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { imagemBase64, mimeType, texto } = body;

  if (!imagemBase64 && !texto?.trim()) {
    return NextResponse.json({ error: "Envie uma foto ou um texto." }, { status: 400 });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const parts: Array<Record<string, unknown>> = [{ text: montarInstrucao(hoje) }];

  if (imagemBase64) {
    parts.push({
      inline_data: {
        mime_type: mimeType || "image/jpeg",
        data: imagemBase64,
      },
    });
    parts.push({ text: "Extraia os dados do gasto a partir dessa foto de comprovante." });
  } else {
    parts.push({ text: `Extraia os dados do gasto a partir dessa frase falada: "${texto}"` });
  }

  try {
    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
          },
        }),
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      const msg = dados?.error?.message || "Erro ao consultar a IA.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const textoResposta: string | undefined = dados?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoResposta) {
      return NextResponse.json(
        { error: "A IA não retornou nenhum dado. Tente uma foto mais nítida ou descreva de novo." },
        { status: 502 }
      );
    }

    const extraido = JSON.parse(textoResposta);
    return NextResponse.json({ dados: extraido });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha ao processar: ${mensagem}` }, { status: 500 });
  }
}
