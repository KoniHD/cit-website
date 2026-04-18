import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const args = process.argv.slice(2);
const buildDirArgIndex = args.indexOf("--build-dir");
const buildDir = buildDirArgIndex >= 0
    ? path.resolve(rootDir, args[buildDirArgIndex + 1] || ".deploy-build")
    : path.resolve(rootDir, ".deploy-build");

const profilePath = path.join(rootDir, "profile.yml");

const parseProfile = (raw) => {
    const parsed = YAML.parse(raw);
    const profile = parsed && typeof parsed === "object" ? parsed : {};

    return {
        ...profile,
        links: profile.links && typeof profile.links === "object" ? profile.links : {},
        sameAs: Array.isArray(profile.sameAs) ? profile.sameAs : [],
        translations: profile.translations && typeof profile.translations === "object" ? profile.translations : {},
        searchEngineVerification: profile.searchEngineVerification && typeof profile.searchEngineVerification === "object"
            ? profile.searchEngineVerification
            : {}
    };
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
    const pattern = new RegExp(`(<[^>]*\\bid=["']${id}["'][^>]*\\b${attr}=)(["'])([\\s\\S]*?)\\2`, "i");
    return html.replace(pattern, `$1$2${escaped}$2`);
};

const setTextById = (html, id, text) => {
    const escaped = String(text).replace(/\$/g, "$$$$");
    const pattern = new RegExp(`(<[^>]*\\bid=["']${id}["'][^>]*>)([\\s\\S]*?)(</[^>]+>)`, "i");
    return html.replace(pattern, `$1${escaped}$3`);
};

const removeElementById = (html, id) => {
    const pattern = new RegExp(String.raw`^\s*<[^>]*\bid=["']${id}["'][^>]*>\s*\n?`, "gim");
    return html.replace(pattern, "");
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
const fallbackCitEmail = `${citLogin}@cs.tum.edu`;
const contactEmail = String(profile.email || "").trim() || fallbackCitEmail;
const role = ensureRequired(profile, "role");
const description = ensureRequired(profile, "description");

const fullName = `${firstName} ${lastName}`.trim();
const siteUrl = `https://home.cit.tum.de/~${citLogin}/`;
const deUrl = `${siteUrl}de/`;
const photoUrl = `${siteUrl}photo.webp`;
const today = new Date().toISOString().slice(0, 10);
const deProfile = profile.translations && typeof profile.translations.de === "object"
    ? profile.translations.de
    : {};

copyRecursive(rootDir, buildDir);

const buildIndexPath = path.join(buildDir, "index.html");
const buildIndexDePath = path.join(buildDir, "de", "index.html");
const sourceDePath = path.join(rootDir, "de", "index.html");
if (!fs.existsSync(sourceDePath)) {
    throw new Error("Missing German template at 'de/index.html'. Add it or remove the bilingual build step.");
}
if (!fs.existsSync(buildIndexDePath)) {
    throw new Error("Build copy did not produce 'de/index.html'. Check that 'de/index.html' exists in the repository.");
}
const buildManifestPath = path.join(buildDir, "site.webmanifest");
const buildRobotsPath = path.join(buildDir, "robots.txt");
const buildSitemapPath = path.join(buildDir, "sitemap.xml");

const verification = profile.searchEngineVerification || {};
const setOrRemoveVerification = (html, id, value) => {
    const v = String(value || "").trim();
    if (v) {
        return setAttrById(html, id, "content", v);
    } else {
        return removeElementById(html, id);
    }
};

const renderLocalePage = ({ templatePath, pageUrl, alternateEnUrl, alternateDeUrl, locale }) => {
    const localeRole = String((locale === "de" ? deProfile.role : "") || role).trim();
    const localeDescription = String((locale === "de" ? deProfile.description : "") || description).trim();
    const localePosition = String((locale === "de" ? deProfile.position : "") || profile.position || "").trim();
    const localeAffiliationTitle = String((locale === "de" ? deProfile.affiliationTitle : "") || profile.affiliationTitle || "").trim();
    const localeBio = String((locale === "de" ? deProfile.bio : "") || profile.bio || "").trim();
    const affiliationOrg = String(profile.affiliationOrg || "").trim();
    const sharedTitle = `${fullName} - ${localeRole}`;

    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${sharedTitle}</title>`);
    html = setAttrById(html, "meta-description", "content", localeDescription);
    html = setAttrById(html, "meta-author", "content", fullName);
    html = setAttrById(html, "canonical-url", "href", pageUrl);
    html = setAttrById(html, "alt-lang-en", "href", alternateEnUrl);
    html = setAttrById(html, "alt-lang-de", "href", alternateDeUrl);
    html = setAttrById(html, "alt-lang-x-default", "href", alternateEnUrl);

    html = setAttrById(html, "og-title", "content", sharedTitle);
    html = setAttrById(html, "og-description", "content", localeDescription);
    html = setAttrById(html, "og-url", "content", pageUrl);
    html = setAttrById(html, "og-image", "content", photoUrl);
    html = setAttrById(html, "profile-first-name", "content", firstName);
    html = setAttrById(html, "profile-last-name", "content", lastName);

    html = setAttrById(html, "twitter-title", "content", sharedTitle);
    html = setAttrById(html, "twitter-description", "content", localeDescription);
    html = setAttrById(html, "twitter-image", "content", photoUrl);

    html = setOrRemoveVerification(html, "verify-google", verification.google);
    html = setOrRemoveVerification(html, "verify-bing", verification.bing);
    html = setOrRemoveVerification(html, "verify-yandex", verification.yandex);
    html = setOrRemoveVerification(html, "verify-baidu", verification.baidu);
    html = setOrRemoveVerification(html, "verify-naver", verification.naver);
    html = setOrRemoveVerification(html, "verify-seznam", verification.seznam);
    html = setOrRemoveVerification(html, "verify-pinterest", verification.pinterest);

    html = setTextById(html, "profile-name", fullName);
    html = setTextById(html, "footer-name", fullName);
    html = setTextById(html, "profile-role", localeRole);
    html = setTextById(html, "contact-email-text", contactEmail);
    html = setTextById(html, "position-title", localePosition);
    html = setTextById(html, "affiliation-title", localeAffiliationTitle);
    html = setTextById(html, "affiliation-link", affiliationOrg);
    if (localeBio) {
        html = setTextById(html, "bio-text", localeBio);
    }

    const greeting = locale === "de" ? `Hi ${firstName},` : `Hi ${firstName},`;
    const shareSubject = locale === "de" ? `${fullName} Profil` : `${fullName}'s Profile`;
    const shareBody = locale === "de"
        ? `Ich möchte das Profil von ${fullName} mit dir teilen. ${pageUrl}`
        : `I would like to share the profile of ${fullName} with you. ${pageUrl}`;
    const contactMailto = `mailto:${contactEmail}?subject=${encodeURIComponent("[CIT] ")}&body=${encodeURIComponent(greeting)}`;
    const shareMailto = `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareBody)}`;

    html = setAttrById(html, "contact-email-link", "href", contactMailto);
    html = setAttrById(html, "email-profile-btn", "href", shareMailto);
    html = setAttrById(html, "affiliation-link", "href", String(profile.affiliationUrl || ""));
    html = setAttrById(html, "link-website", "href", String(profile.links.website || ""));
    html = setAttrById(html, "link-github", "href", String(profile.links.github || ""));
    html = setAttrById(html, "link-linkedin", "href", String(profile.links.linkedin || ""));
    html = setAttrById(html, "link-bluesky", "href", String(profile.links.bluesky || ""));

    html = html.replace(/(<img\s+src=["'][^"']*photo\.webp["']\s+alt=")([^"]*)("\s+width="188"\s+height="220"\s*\/>)/i, `$1${fullName}$3`);
    html = html.replace(/^.*js-yaml.*\n?/gim, "");
    html = html.replace(/^.*scripts\/profile-loader\.js.*\n?/gim, "");

    fs.writeFileSync(templatePath, html, "utf8");
};

renderLocalePage({
    templatePath: buildIndexPath,
    pageUrl: siteUrl,
    alternateEnUrl: siteUrl,
    alternateDeUrl: deUrl,
    locale: "en"
});
renderLocalePage({
    templatePath: buildIndexDePath,
    pageUrl: deUrl,
    alternateEnUrl: siteUrl,
    alternateDeUrl: deUrl,
    locale: "de"
});

const affiliationOrgForSchema = String(profile.affiliationOrg || "").trim();
const worksForName = affiliationOrgForSchema
    ? (affiliationOrgForSchema.includes("TUM") ? affiliationOrgForSchema : `${affiliationOrgForSchema}, TUM`)
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
const injectJsonLd = (templatePath) => {
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace(/<script\s+id="person-ld-json"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, toJsonLdScript(personJsonLd));
    fs.writeFileSync(templatePath, html, "utf8");
};
injectJsonLd(buildIndexPath);
injectJsonLd(buildIndexDePath);

const robotsContent = `User-agent: *\nSitemap: ${siteUrl}sitemap.xml\n\n# Block AdsBots\nUser-agent: AdsBot-Google\nUser-agent: Google AdsBot\nUser-agent: Google Adsense\nUser-agent: Google Storebot\nUser-agent: Googlebot-News\nUser-agent: Googlebot-Video\nUser-agent: GoogleAgent-Mariner\nUser-agent: GPTBot\nUser-agent: ChatGPT-User\nUser-agent: ClaudeBot\nUser-agent: anthropic-ai\nUser-agent: Perplexity-User\nUser-agent: cohere-ai\nUser-agent: AI2Bot\nUser-agent: Diffbot\nUser-agent: YouBot\nDisallow: /\n\n# https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/#content-signals-policy\nContent-Signal: search=yes, ai-train=no, ai-input=yes\n`;

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n  <url>\n    <loc>${siteUrl}</loc>\n    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}" />\n    <xhtml:link rel="alternate" hreflang="de" href="${deUrl}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}" />\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>${deUrl}</loc>\n    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}" />\n    <xhtml:link rel="alternate" hreflang="de" href="${deUrl}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}" />\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n</urlset>\n`;

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
