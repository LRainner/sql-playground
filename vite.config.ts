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
  optimizeDeps: {
    // PGlite resolves pglite.data relative to its own module URL. Vite's
    // dependency pre-bundling moves the module into node_modules/.vite/deps
    // without copying that data file, so the request falls through to the SPA
    // HTML and PGlite reports an invalid FS bundle size.
    exclude: ["@electric-sql/pglite"],
  },
});
