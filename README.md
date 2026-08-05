# Menzo

> Projeto pessoal desenvolvido por **Fernando Alves Santos**, disponibilizado
> aqui apenas para fins de demonstração/portfólio. Código sob todos os
> direitos reservados — ver [`LICENSE`](./LICENSE).

App pessoal de controle financeiro — contas, cartão de crédito e gastos do
dia a dia, organizados por categoria, com login próprio e dados salvos na
nuvem (Supabase).

## Funcionalidades

- **Login e cadastro** de usuário (e-mail/senha), cada conta é individual
  e só enxerga os próprios dados.
- **Dashboard mensal** com status colorido de cada conta (pago / no prazo
  / vencido) e navegação entre meses.
- **Gráfico de gastos por categoria** (rosca), com detalhamento dos itens
  ao clicar em cada fatia.
- **Categorias personalizáveis**: Alimentação, Restaurantes e Delivery,
  Saúde, Cuidados Pessoais, Vestuário, Lazer, Moradia, Transporte,
  Assinaturas, Trabalho, Educação, Empréstimo, Dívidas e Financiamentos,
  Investimentos, Eletrônicos, Pets, Presentes, Impostos e Taxas,
  Reembolso e Outros.
- **Reembolso**: categoria especial para valores que passam pelo cartão
  mas voltam pra você (ex: emprestou o cartão pra alguém pagar depois) —
  entra no total da fatura, mas não conta como gasto seu no dashboard.
- **Fatura de cartão de crédito**: lançamento de gastos avulsos ou
  parcelados, agrupados por cartão, com edição e exclusão.
- **Contas fixas, variáveis e rotativas** (contas divididas entre mais de
  uma pessoa, alternando quem paga a cada mês).
- **Calendário visual** de vencimentos.
- **Upload de comprovantes** por conta.
- **Lançamento por foto ou voz com IA**: tira uma foto de um comprovante
  ou fala o gasto em voz alta, e o app preenche descrição, valor, data,
  categoria e parcelamento automaticamente.
- **Lembretes automáticos por e-mail** de contas vencendo (via job
  agendado).

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) — autenticação e banco de dados
- [Tailwind CSS](https://tailwindcss.com)
- Deploy na [Vercel](https://vercel.com)

## Rodando localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.local.example` para `.env.local` e preencha com os dados
   do **seu próprio** projeto Supabase (Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica-aqui
   ```
3. (Opcional) Se for usar o lançamento por foto/voz com IA e os lembretes
   por e-mail, adicione também as variáveis necessárias pra essas
   funções — consulte os comentários no topo dos arquivos em
   `app/api/`.
4. Rode o projeto:
   ```bash
   npm run dev
   ```
5. Acesse http://localhost:3000

## Deploy

1. Suba o repositório pro GitHub.
2. Na Vercel, clique em **Add New Project** e selecione o repositório.
3. Em **Environment Variables**, adicione as mesmas variáveis do seu
   `.env.local`.
4. Clique em **Deploy**.

## Observações

- Nenhuma chave de API, senha ou dado pessoal deve ser commitada no
  repositório — todas as credenciais ficam em variáveis de ambiente
  (arquivo `.env.local`, que já está no `.gitignore`).
- Este é um projeto pessoal; os dados de cada usuário ficam isolados por
  conta (sem compartilhamento entre contas).
