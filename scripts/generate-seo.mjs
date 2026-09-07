import { readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const siteUrl = (process.env.SITE_URL || "https://sql-playground.lrainner.workers.dev").replace(
  /\/+$/,
  "",
);
const basePathSegment = (process.env.VITE_BASE_PATH || "/").replace(/^\/+|\/+$/g, "");
const basePath = basePathSegment ? `/${basePathSegment}/` : "/";
const revision = process.env.GITHUB_SHA || "HEAD";
const readGitValue = (args, fallback) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
};
const commitHash =
  process.env.GITHUB_SHA?.slice(0, 7) ||
  readGitValue(["rev-parse", "--short=7", "HEAD"], "unknown");
const modifiedDate = readGitValue(
  ["show", "-s", "--format=%cs", revision],
  new Date().toISOString().slice(0, 10),
);
const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function processHtml(directory, segments = []) {
  const routes = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      routes.push(...(await processHtml(path, [...segments, entry.name])));
    } else if (entry.name.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      await writeFile(
        path,
        html
          .replaceAll("__SITE_URL__", siteUrl)
          .replaceAll("__BASE_PATH__", basePath)
          .replaceAll("__MODIFIED_DATE__", modifiedDate)
          .replaceAll("__COMMIT_HASH__", commitHash),
      );
      const isVerificationFile =
        segments.length === 0 && /^google[a-z0-9_-]+\.html$/i.test(entry.name);
      const isErrorPage = segments.length === 0 && entry.name === "404.html";
      if (!isVerificationFile && !isErrorPage) {
        routes.push(
          entry.name === "index.html"
            ? segments.length
              ? `/${segments.join("/")}/`
              : "/"
            : `/${[...segments, entry.name].join("/")}`,
        );
      }
    }
  }
  return routes;
}

const routes = (await processHtml("dist")).sort((a, b) => {
  if (a === "/") return -1;
  if (b === "/") return 1;
  return a.localeCompare(b);
});
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
  .map((route) => `  <url>\n    <loc>${escapeXml(`${siteUrl}${route}`)}</loc>\n  </url>`)
  .join("\n")}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
const llms = `# SQL Playground

> A private SQL workspace that runs SQLite, DuckDB, and PostgreSQL directly in the browser.

SQL Playground lets users execute SQL, inspect tables and columns, import local database or data files, and export query results as CSV. Database engines run on the user's device; imported files are not uploaded to a server.

## Engine guides

- [SQLite Online](${siteUrl}/en/sqlite-online/): Open SQLite database files and run SQLite queries locally.
- [DuckDB Online](${siteUrl}/en/duckdb-online/): Query CSV, JSON, Parquet, and DuckDB files in the browser.
- [PostgreSQL Online](${siteUrl}/en/postgresql-online/): Run PostgreSQL with PGlite and import UTF-8 SQL files.
- [SQLite 在线](${siteUrl}/zh/sqlite-online/)
- [DuckDB 在线](${siteUrl}/zh/duckdb-online/)
- [PostgreSQL 在线](${siteUrl}/zh/postgresql-online/)

## Source

- [GitHub repository](https://github.com/LRainner/sql-playground)
- Source revision: ${commitHash} (${modifiedDate})
`;

await writeFile("dist/sitemap.xml", sitemap);
await writeFile("dist/robots.txt", robots);
await writeFile("dist/llms.txt", llms);
console.log(`Generated SEO files for ${siteUrl} (${routes.length} pages)`);
