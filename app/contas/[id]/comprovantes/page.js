"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import { formatarMoeda, NOMES_MESES } from "../../../../lib/contas";

export default function ComprovantesConta() {
  const router = useRouter();
  const params = useParams();
  const contaId = params.id;

  const [conta, setConta] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      router.replace("/login");
      return;
    }

    const { data: contaData } = await supabase
      .from("contas")
      .select("*")
      .eq("id", contaId)
      .single();

    const { data: pagamentosData } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("conta_id", contaId)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });

    setConta(contaData ?? null);
    setHistorico(pagamentosData ?? []);
    setCarregando(false);
  }, [contaId, router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrirComprovante(caminho) {
    const { data, error } = await supabase.storage
      .from("comprovantes")
      .createSignedUrl(caminho, 60);

    if (!error && data) {
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-xs text-ledger underline">
          &larr; Voltar ao dashboard
        </Link>
        <p className="font-display text-2xl mt-2">
          {conta ? `Comprovantes - ${conta.nome}` : "Comprovantes"}
        </p>
        {conta && (
          <p className="text-xs text-ink-soft mt-1">
            Historico completo de pagamentos e comprovantes desta conta
          </p>
        )}
      </div>

      {carregando ? (
        <p className="text-ink-soft text-sm">Carregando...</p>
      ) : historico.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#D8D3C2] rounded-lg">
          <p className="text-ink-soft">Nenhum pagamento registrado ainda para esta conta.</p>
        </div>
      ) : (
        <div className="bg-white/70 border border-[#D8D3C2] rounded-lg divide-y divide-[#E4E0D2]">
          {historico.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium">
                  {NOMES_MESES[p.mes - 1]} {p.ano}
                </p>
                <p className="text-xs text-ink-soft">
                  {p.status === "pago" ? "Pago" : p.status === "vencido" ? "Vencido" : "No prazo"}
                  {p.data_pagamento ? ` - em ${p.data_pagamento}` : ""}
                  {p.responsavel ? ` - responsavel: ${p.responsavel}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {p.valor_pago != null && (
                  <p className="text-sm">{formatarMoeda(p.valor_pago)}</p>
                )}
                {p.comprovante_url ? (
                  <button
                    onClick={() => abrirComprovante(p.comprovante_url)}
                    className="text-xs text-ledger underline"
                  >
                    Ver comprovante
                  </button>
                ) : (
                  <span className="text-xs text-ink-soft">sem comprovante</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
