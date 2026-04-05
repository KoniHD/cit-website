import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const args = process.argv.slice(2);
const buildDirArgIndex = args.indexOf("--build-dir");
const buildDir = buildDirArgIndex >= 0
    ? path.resolve(rootDir, args[buildDirArgIndex + 1] || ".deploy-build")
    : path.resolve(rootDir, ".deploy-build");

const profilePath = path.join(rootDir, "profile.yml");

const removeWrappingQuotes = (value) => {
    const trimmed = String(value || "").trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

const parseProfile = (raw) => {
    const profile = {
        links: {},
        sameAs: []
    };

    const lines = raw.split(/\r?\n/);
    let section = "";

    for (const line of lines) {
        if (!line.trim() || /^\s*#/.test(line)) continue;

        const topLevelMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
        if (topLevelMatch && !line.startsWith(" ")) {
            const [, key, valueRaw] = topLevelMatch;
            section = valueRaw.trim() ? "" : key;
            if (valueRaw.trim()) {
                profile[key] = removeWrappingQuotes(valueRaw);
            }
            continue;
        }

        if (section === "links") {
            const linkMatch = line.match(/^\s{2}([A-Za-z0-9_]+):\s*(.*)$/);
            if (linkMatch) {
                profile.links[linkMatch[1]] = removeWrappingQuotes(linkMatch[2]);
                continue;
            }
        }

        if (section === "sameAs") {
            const sameAsMatch = line.match(/^\s{2}-\s*(.*)$/);
            if (sameAsMatch) {
                const entry = removeWrappingQuotes(sameAsMatch[1]);
                if (entry) profile.sameAs.push(entry);
            }
        }
    }

    return profile;
};

const ensureRequired = (profile, key) => {
    const value = String(profile[key] || "").trim();
    if (!value) throw new Error(`Missing '${key}' in profile.yml`);
    return value;
};

const copyRecursive = (sourceDir, targetDir) => {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === ".git" || entry.name === ".github" || entry.name === path.basename(targetDir)) {
            continue;
        }

        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyRecursive(sourcePath, targetPath);
        } else if (entry.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
};

const setAttrById = (html, id, attr, value) => {
    const escaped = String(value).replace(/\$/g, "$$$$");
    const pattern = new RegExp(`(<[^>]*\\bid=["']${id}["'][^>]*\\b${attr}=["'])([^"']*)(["'])`, "i");
    return html.replace(pattern, `$1${escaped}$3`);
};

const setTextById = (html, id, text) => {
    const escaped = String(text).replace(/\$/g, "$$$$");
    const pattern = new RegExp(`(<[^>]*\\bid=["']${id}["'][^>]*>)([\\s\\S]*?)(</[^>]+>)`, "i");
    return html.replace(pattern, `$1${escaped}$3`);
};

const toJsonLdScript = (schema) => {
    const json = JSON.stringify(schema, null, 2);
    return `<script id="person-ld-json" type="application/ld+json">\n${json}\n</script>`;
};

const profileRaw = fs.readFileSync(profilePath, "utf8");
const profile = parseProfile(profileRaw);

const firstName = ensureRequired(profile, "firstName");
const lastName = ensureRequired(profile, "lastName");
const citLogin = ensureRequired(profile, "citLogin").replace(/^~+/, "");
const email = ensureRequired(profile, "email");
const role = ensureRequired(profile, "role");
const description = ensureRequired(profile, "description");

const fullName = `${firstName} ${lastName}`.trim();
const siteUrl = `https://home.cit.tum.de/~${citLogin}/`;
const photoUrl = `${siteUrl}photo.webp`;
const sharedTitle = `${fullName} - ${role}`;
const today = new Date().toISOString().slice(0, 10);
const affiliationOrg = String(profile.affiliationOrg || "").trim();

copyRecursive(rootDir, buildDir);

const buildIndexPath = path.join(buildDir, "index.html");
const buildManifestPath = path.join(buildDir, "site.webmanifest");
const buildRobotsPath = path.join(buildDir, "robots.txt");
const buildSitemapPath = path.join(buildDir, "sitemap.xml");

let html = fs.readFileSync(buildIndexPath, "utf8");

html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${sharedTitle}</title>`);
html = setAttrById(html, "meta-description", "content", description);
html = setAttrById(html, "meta-author", "content", fullName);
html = setAttrById(html, "canonical-url", "href", siteUrl);

html = setAttrById(html, "og-title", "content", sharedTitle);
html = setAttrById(html, "og-description", "content", description);
html = setAttrById(html, "og-url", "content", siteUrl);
html = setAttrById(html, "og-image", "content", photoUrl);
html = setAttrById(html, "profile-first-name", "content", firstName);
html = setAttrById(html, "profile-last-name", "content", lastName);

html = setAttrById(html, "twitter-title", "content", sharedTitle);
html = setAttrById(html, "twitter-description", "content", description);
html = setAttrById(html, "twitter-image", "content", photoUrl);

html = setTextById(html, "profile-name", fullName);
html = setTextById(html, "footer-name", fullName);
html = setTextById(html, "profile-role", role);
html = setTextById(html, "contact-email-text", email);
html = setTextById(html, "position-title", String(profile.position || ""));
html = setTextById(html, "affiliation-title", String(profile.affiliationTitle || ""));
html = setTextById(html, "affiliation-link", affiliationOrg);

if (profile.bio) {
    html = setTextById(html, "bio-text", String(profile.bio).trim());
}

const contactMailto = `mailto:${email}?subject=${encodeURIComponent("[CIT] ")}&body=${encodeURIComponent(`Hi ${firstName},`)}`;
const shareMailto = `mailto:?subject=${encodeURIComponent(`${fullName}'s Profile`)}&body=${encodeURIComponent(`I would like to share the profile of ${fullName} with you. ${siteUrl}`)}`;

html = setAttrById(html, "contact-email-link", "href", contactMailto);
html = setAttrById(html, "email-profile-btn", "href", shareMailto);
html = setAttrById(html, "affiliation-link", "href", String(profile.affiliationUrl || ""));
html = setAttrById(html, "link-website", "href", String(profile.links.website || ""));
html = setAttrById(html, "link-github", "href", String(profile.links.github || ""));
html = setAttrById(html, "link-linkedin", "href", String(profile.links.linkedin || ""));
html = setAttrById(html, "link-bluesky", "href", String(profile.links.bluesky || ""));

html = html.replace(/(<img\s+src="\.\/photo\.webp"\s+alt=")([^"]*)("\s+width="188"\s+height="220"\s*\/>)/i, `$1${fullName}$3`);

const worksForName = affiliationOrg
    ? (affiliationOrg.includes("TUM") ? affiliationOrg : `${affiliationOrg}, TUM`)
    : "Chair of Computer Architecture and Parallel Systems, TUM";

const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: fullName,
    url: siteUrl,
    sameAs: Array.isArray(profile.sameAs) ? profile.sameAs : [],
    affiliation: {
        "@type": "CollegeOrUniversity",
        name: String(profile.universityName || "Technical University of Munich"),
        url: String(profile.universityUrl || "https://www.tum.de")
    },
    jobTitle: String(profile.jobTitle || ""),
    worksFor: {
        "@type": "Organization",
        name: worksForName
    }
};

html = html.replace(/<script\s+id="person-ld-json"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, toJsonLdScript(personJsonLd));

// Deploy artifact should be fully static, so remove runtime profile hydration.
html = html.replace(/^.*js-yaml.*\n?/gim, "");
html = html.replace(/^.*scripts\/profile-loader\.js.*\n?/gim, "");

fs.writeFileSync(buildIndexPath, html, "utf8");

const robotsContent = `User-agent: *\nSitemap: ${siteUrl}sitemap.xml\n\n# Block AdsBots\nUser-agent: AdsBot-Google\nUser-agent: Google AdsBot\nUser-agent: Google Adsense\nUser-agent: Google Storebot\nUser-agent: Googlebot-News\nUser-agent: Googlebot-Video\nUser-agent: GoogleAgent-Mariner\nUser-agent: GPTBot\nUser-agent: ChatGPT-User\nUser-agent: ClaudeBot\nUser-agent: anthropic-ai\nUser-agent: Perplexity-User\nUser-agent: cohere-ai\nUser-agent: AI2Bot\nUser-agent: Diffbot\nUser-agent: YouBot\nDisallow: /\n\n# https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/#content-signals-policy\nContent-Signal: search=yes, ai-train=no, ai-input=yes\n`;

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`;

fs.writeFileSync(buildRobotsPath, robotsContent, "utf8");
fs.writeFileSync(buildSitemapPath, sitemapContent, "utf8");

try {
    const manifestRaw = fs.readFileSync(buildManifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);
    manifest.name = fullName;
    manifest.short_name = `${firstName.charAt(0)}. ${lastName}`.trim();
    manifest.description = `Academic homepage of ${fullName}.`;
    fs.writeFileSync(buildManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
} catch (error) {
    console.warn("Could not update site.webmanifest in build artifact.", error);
}

console.log(`Built deploy artifact at '${path.relative(rootDir, buildDir)}' for CIT login '${citLogin}'.`);
