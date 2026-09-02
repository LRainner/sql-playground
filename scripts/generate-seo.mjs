import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const siteUrl = (process.env.SITE_URL || "https://sql-playground.lrainner.workers.dev").replace(
  /\/+$/,
  "",
);
const routes = ["/", "/sqlite-online/"];
const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
  .map((route) => `  <url>\n    <loc>${escapeXml(`${siteUrl}${route}`)}</loc>\n  </url>`)
  .join("\n")}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;

await writeFile("dist/sitemap.xml", sitemap);
await writeFile("dist/robots.txt", robots);

async function replaceSiteUrl(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await replaceSiteUrl(path);
    } else if (entry.name.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      await writeFile(path, html.replaceAll("__SITE_URL__", siteUrl));
    }
  }
}

await replaceSiteUrl("dist");
console.log(`Generated SEO files for ${siteUrl}`);
