/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@chatbot-saas/ui", "@chatbot-saas/types", "@chatbot-saas/validation"],
  // Saída autocontida (server.js + só os módulos realmente usados) — o que o
  // Dockerfile de produção copia para a imagem final, sem precisar levar
  // node_modules do monorepo inteiro (ver apps/web/Dockerfile).
  output: "standalone",
};

module.exports = nextConfig;
