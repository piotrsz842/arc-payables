import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load Circle's App Kit packages from node_modules at runtime instead of
  // bundling them. The bundler otherwise fails on the adapter's optional
  // Solana support (`@solana/kit`), which we don't use and don't install.
  serverExternalPackages: ["@circle-fin/app-kit", "@circle-fin/adapter-circle-wallets"],
};

export default nextConfig;
