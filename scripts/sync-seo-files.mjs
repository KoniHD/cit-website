import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const profilePath = path.join(rootDir, "profile.yml");
const robotsPath = path.join(rootDir, "robots.txt");
const sitemapPath = path.join(rootDir, "sitemap.xml");

const profileRaw = fs.readFileSync(profilePath, "utf8");
const citLoginMatch = profileRaw.match(/^\s*citLogin:\s*["']?([^"'\n#]+)["']?\s*$/m);

if (!citLoginMatch) {
    throw new Error("Missing 'citLogin' in profile.yml");
}

const citLogin = citLoginMatch[1].trim().replace(/^~+/, "");
if (!citLogin) {
    throw new Error("'citLogin' in profile.yml is empty");
}

const siteUrl = `https://home.cit.tum.de/~${citLogin}/`;
const today = new Date().toISOString().slice(0, 10);

const robotsContent = `User-agent: *\nSitemap: ${siteUrl}sitemap.xml\n\n# Block AdsBots\nUser-agent: AdsBot-Google\nUser-agent: Google AdsBot\nUser-agent: Google Adsense\nUser-agent: Google Storebot\nUser-agent: Googlebot-News\nUser-agent: Googlebot-Video\nUser-agent: GoogleAgent-Mariner\nUser-agent: GPTBot\nUser-agent: ChatGPT-User\nUser-agent: ClaudeBot\nUser-agent: anthropic-ai\nUser-agent: Perplexity-User\nUser-agent: cohere-ai\nUser-agent: AI2Bot\nUser-agent: Diffbot\nUser-agent: YouBot\nDisallow: /\n\n# https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/#content-signals-policy\nContent-Signal: search=yes, ai-train=no, ai-input=yes\n`;

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`;

fs.writeFileSync(robotsPath, robotsContent, "utf8");
fs.writeFileSync(sitemapPath, sitemapContent, "utf8");

console.log(`Updated robots.txt and sitemap.xml for CIT login '${citLogin}'.`);
