import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const siteUrl = (process.env.SITE_URL || "https://sql-playground.lrainner.workers.dev").replace(
  /\/+$/,
  "",
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
      await writeFile(path, html.replaceAll("__SITE_URL__", siteUrl));
      const isVerificationFile =
        segments.length === 0 && /^google[a-z0-9_-]+\.html$/i.test(entry.name);
      if (!isVerificationFile) {
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

await writeFile("dist/sitemap.xml", sitemap);
await writeFile("dist/robots.txt", robots);
console.log(`Generated SEO files for ${siteUrl} (${routes.length} pages)`);
