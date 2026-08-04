/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fundo e superfícies (antes: paper creme)
        paper: "#07090B",
        surface: "#12171A",
        "surface-soft": "#181F22",
        border: "#1F2A2C",
        "border-soft": "#242E30",

        // Texto (antes: ink escuro sobre creme)
        ink: "#EDEFEF",
        "ink-soft": "#8A9A9C",

        // Cor principal do app — antes era "ledger" azul-marinho, agora ciano do logo
        ledger: "#2FC9BC",
        "ledger-dark": "#02A08F",
        "ledger-bg": "#0E2422",

        // Verde-limão do logo, usado como segunda cor de destaque
        lime: "#BEE537",
        "lime-dark": "#8FB01F",
        "lime-bg": "#1B2408",

        // Selos de status (quitado / pendente / atrasado)
        stamp: {
          green: "#BEE537",
          "green-bg": "#1B2408",
          amber: "#F2B84B",
          "amber-bg": "#2A2108",
          red: "#FF6B5D",
          "red-bg": "#2A1210",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
