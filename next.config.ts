import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Agent SDK sobe o Claude Code como subprocesso; não deve ser empacotado pelo Next.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
