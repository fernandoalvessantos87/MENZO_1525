"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState("entrar"); // "entrar" | "cadastrar"
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setCarregando(true);
    setMensagem(null);

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        setMensagem({ tipo: "erro", texto: "E-mail ou senha incorretos." });
      } else {
        router.push("/dashboard");
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) {
        setMensagem({ tipo: "erro", texto: error.message });
      } else {
        setMensagem({
          tipo: "sucesso",
          texto: "Conta criada. Verifique seu e-mail para confirmar antes de entrar.",
        });
      }
    }
    setCarregando(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center flex flex-col items-center">
          <Image
            src="/logo-menzo.png"
            alt="Menzo"
            width={72}
            height={72}
            className="mb-3 drop-shadow-[0_0_18px_rgba(47,201,188,0.35)]"
            priority
          />
          <p className="font-display text-3xl text-ink">Minhas Contas</p>
          <p className="text-ink-soft text-sm mt-1">Seu livro-caixa pessoal, sempre em dia.</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="flex mb-6 text-sm border-b border-border">
            <button
              type="button"
              onClick={() => setModo("entrar")}
              className={`flex-1 pb-3 transition-colors ${
                modo === "entrar"
                  ? "border-b-2 border-ledger text-ledger font-medium"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setModo("cadastrar")}
              className={`flex-1 pb-3 transition-colors ${
                modo === "cadastrar"
                  ? "border-b-2 border-ledger text-ledger font-medium"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-ink-soft block mb-1.5" htmlFor="email">
                E-mail
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="!pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-ink-soft block mb-1.5" htmlFor="senha">
                Senha
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="senha"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="!pl-9"
                />
              </div>
            </div>

            {mensagem && (
              <p
                className={`text-sm rounded-md px-3 py-2 border ${
                  mensagem.tipo === "erro"
                    ? "text-stamp-red bg-stamp-red-bg border-stamp-red/30"
                    : "text-stamp-green bg-stamp-green-bg border-stamp-green/30"
                }`}
              >
                {mensagem.texto}
              </p>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="mt-2 bg-ledger hover:bg-ledger-dark text-[#07090B] rounded-md py-2.5 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-soft/70 mt-6">
          Seus dados ficam protegidos e visíveis só para você.
        </p>
      </div>
    </main>
  );
}
