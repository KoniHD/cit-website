import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const profilePath = path.join(rootDir, "profile.yml");
const deTemplatePath = path.join(rootDir, "de", "index.html");

if (!fs.existsSync(deTemplatePath)) {
    console.error("Missing 'de/index.html'. The bilingual template requires this file next to root 'index.html'.");
    process.exit(1);
}

const raw = fs.readFileSync(profilePath, "utf8");
const profile = YAML.parse(raw);

if (!profile || typeof profile !== "object") {
    throw new Error("profile.yml must contain a YAML mapping/object at the top level.");
}

const errors = [];

const requiredKeys = ["firstName", "lastName", "citLogin", "role", "description"];
for (const key of requiredKeys) {
    const value = String(profile[key] || "").trim();
    if (!value) {
        errors.push(`Missing required field '${key}'.`);
    }
}

const isValidUrl = (value) => {
    try {
        const url = new URL(String(value));
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};

const email = String(profile.email || "").trim();
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Field 'email' is not a valid email address.");
}

const linkMap = profile.links && typeof profile.links === "object" ? profile.links : {};
for (const [linkKey, linkValue] of Object.entries(linkMap)) {
    const trimmed = String(linkValue || "").trim();
    if (trimmed && !isValidUrl(trimmed)) {
        errors.push(`Field 'links.${linkKey}' must be a valid http(s) URL.`);
    }
}

const sameAs = Array.isArray(profile.sameAs) ? profile.sameAs : [];
for (let i = 0; i < sameAs.length; i += 1) {
    const value = String(sameAs[i] || "").trim();
    if (!value || !isValidUrl(value)) {
        errors.push(`Field 'sameAs[${i}]' must be a valid http(s) URL.`);
    }
}

const affiliationUrl = String(profile.affiliationUrl || "").trim();
if (affiliationUrl && !isValidUrl(affiliationUrl)) {
    errors.push("Field 'affiliationUrl' must be a valid http(s) URL.");
}

const verification = profile.searchEngineVerification && typeof profile.searchEngineVerification === "object"
    ? profile.searchEngineVerification
    : {};
for (const [name, token] of Object.entries(verification)) {
    if (typeof token !== "string") {
        errors.push(`Field 'searchEngineVerification.${name}' must be a string.`);
    }
}

const deTranslations = profile.translations
    && typeof profile.translations === "object"
    && profile.translations.de
    && typeof profile.translations.de === "object"
    ? profile.translations.de
    : null;

if (deTranslations) {
    const optionalStringFields = ["role", "description", "position", "affiliationTitle", "bio"];
    for (const key of optionalStringFields) {
        if (Object.prototype.hasOwnProperty.call(deTranslations, key) && typeof deTranslations[key] !== "string") {
            errors.push(`Field 'translations.de.${key}' must be a string when provided.`);
        }
    }
}

if (errors.length > 0) {
    console.error("profile.yml validation failed:");
    for (const err of errors) {
        console.error(`- ${err}`);
    }
    process.exit(1);
}

console.log("profile.yml validation passed.");
