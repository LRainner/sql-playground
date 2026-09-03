import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function staticDirectoryIndex(): Plugin {
  return {
    name: "static-directory-index",
    configureServer(server) {
      const publicRoot = resolve(process.cwd(), "public");
      server.middlewares.use((request, _response, next) => {
        if (!request.url) return next();
        const url = new URL(request.url, "http://localhost");
        if (url.pathname === "/" || !url.pathname.endsWith("/")) return next();

        const indexFile = resolve(publicRoot, `.${url.pathname}`, "index.html");
        if (indexFile.startsWith(`${publicRoot}${sep}`) && existsSync(indexFile)) {
          request.url = `${url.pathname}index.html${url.search}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [staticDirectoryIndex(), react()],
  base: process.env.VITE_BASE_PATH || "/",
});
