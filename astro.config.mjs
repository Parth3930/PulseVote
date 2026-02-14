import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";
import path from "path";

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: "server",
  adapter: vercel(),
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    ssr: {
      noExternal: ["@fingerprintjs/fingerprintjs"],
    },
    resolve: {
      alias: {
        "@": path.resolve("./src"),
      },
    },
  },
});
