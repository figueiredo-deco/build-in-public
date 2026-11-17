import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esconde o selo de dev do Next, que cobre o perfil no rodapé da barra lateral.
  devIndicators: false,
  // O Agent SDK sobe o Claude Code como subprocesso; não deve ser empacotado pelo Next.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
