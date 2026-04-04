const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
};

const setAttr = (id, attr, value) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, value);
};

const resolveCitSiteUrl = (profile) => {
    const citLogin = String(profile.citLogin || "").trim().replace(/^~+/, "");
    if (citLogin) return `https://home.cit.tum.de/~${citLogin}/`;

    const legacySiteUrl = String(profile.siteUrl || "").trim();
    if (legacySiteUrl) return legacySiteUrl.replace(/\/?$/, "/");

    return "";
};

const updateManifest = async (profile, fullName) => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;

    try {
        const response = await fetch(manifestLink.getAttribute("href"), { cache: "no-cache" });
        if (!response.ok) throw new Error(`Failed to load manifest (${response.status})`);

        const manifest = await response.json();
        const shortName = profile.shortName
            || `${profile.firstName ? `${profile.firstName.charAt(0)}. ` : ""}${profile.lastName || ""}`.trim()
            || fullName;
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');

        manifest.name = fullName || manifest.name;
        manifest.short_name = shortName || manifest.short_name;
        manifest.description = profile.manifestDescription || profile.description || manifest.description;
        manifest.start_url = profile.manifestStartUrl || manifest.start_url;
        manifest.scope = profile.manifestScope || manifest.scope;
        manifest.display = profile.manifestDisplay || manifest.display;
        manifest.background_color = profile.manifestBackgroundColor || manifest.background_color;
        manifest.theme_color = profile.manifestThemeColor || themeColorMeta?.getAttribute("content") || manifest.theme_color;

        if (Array.isArray(profile.manifestIcons) && profile.manifestIcons.length > 0) {
            manifest.icons = profile.manifestIcons;
        }

        const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/manifest+json" });
        const blobUrl = URL.createObjectURL(blob);
        manifestLink.setAttribute("href", blobUrl);
    } catch (error) {
        console.warn("Could not dynamically update site.webmanifest.", error);
    }
};

const applyProfile = (profile) => {
    const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
    const siteUrl = resolveCitSiteUrl(profile);
    const contactMailto = `mailto:${profile.email}?subject=${encodeURIComponent("[CIT] ")}&body=${encodeURIComponent(`Hi ${profile.firstName},`)}`;
    const shareMailto = `mailto:?subject=${encodeURIComponent(`${fullName}'s Profile`)}&body=${encodeURIComponent(`I would like to share the profile of ${fullName} with you. ${siteUrl}`)}`;
    const photoUrl = `${siteUrl}photo.webp`;
    const sharedTitle = `${fullName} - ${profile.role}`;
    const worksForName = profile.affiliationOrg
        ? (profile.affiliationOrg.includes("TUM") ? profile.affiliationOrg : `${profile.affiliationOrg}, TUM`)
        : "Chair of Computer Architecture and Parallel Systems, TUM";

    document.title = sharedTitle;
    setAttr("meta-description", "content", profile.description);
    setAttr("og-description", "content", profile.description);
    setAttr("twitter-description", "content", profile.description);
    setAttr("meta-author", "content", fullName);
    if (siteUrl) setAttr("canonical-url", "href", siteUrl);

    setAttr("og-title", "content", sharedTitle);
    if (siteUrl) {
        setAttr("og-url", "content", siteUrl);
        setAttr("og-image", "content", photoUrl);
    }
    setAttr("profile-first-name", "content", profile.firstName);
    setAttr("profile-last-name", "content", profile.lastName);

    setAttr("twitter-title", "content", sharedTitle);
    if (siteUrl) setAttr("twitter-image", "content", photoUrl);

    setText("profile-name", fullName);
    setText("footer-name", fullName);
    setText("profile-role", profile.role);
    setText("contact-email-text", profile.email);
    setText("position-title", profile.position);
    setText("affiliation-title", profile.affiliationTitle);
    setText("affiliation-link", profile.affiliationOrg);

    const bioTextEl = document.getElementById("bio-text");
    if (bioTextEl) {
        const bioText = (profile.bio || "").trim();
        if (bioText) {
            bioTextEl.textContent = bioText;
            const isPlaceholder = /^bio\s+coming\s+soon\.?$/i.test(bioText);
            bioTextEl.classList.toggle("placeholder", isPlaceholder);
        }
    }

    setAttr("contact-email-link", "href", contactMailto);
    setAttr("email-profile-btn", "href", shareMailto);
    setAttr("link-website", "href", profile.links.website);
    setAttr("link-github", "href", profile.links.github);
    setAttr("link-linkedin", "href", profile.links.linkedin);
    setAttr("link-bluesky", "href", profile.links.bluesky);
    setAttr("affiliation-link", "href", profile.affiliationUrl);

    const profilePhoto = document.querySelector(".photo-frame img");
    if (profilePhoto) {
        profilePhoto.setAttribute("alt", fullName || "Profile photo");
    }

    const personSchema = document.getElementById("person-ld-json");
    if (personSchema) {
        personSchema.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: fullName,
            url: siteUrl,
            sameAs: profile.sameAs,
            affiliation: {
                "@type": "CollegeOrUniversity",
                name: profile.universityName,
                url: profile.universityUrl
            },
            jobTitle: profile.jobTitle,
            worksFor: {
                "@type": "Organization",
                name: worksForName
            },
            email: `mailto:${profile.email}`
        }, null, 2);
    }

    updateManifest(profile, fullName);
};

const loadProfile = async () => {
    try {
        const response = await fetch("./profile.yml", { cache: "no-cache" });
        if (!response.ok) throw new Error(`Failed to load profile.yml (${response.status})`);
        const yamlText = await response.text();
        if (!window.jsyaml) throw new Error("YAML parser not available");
        const parsed = window.jsyaml.load(yamlText);
        if (!parsed || typeof parsed !== "object") throw new Error("Invalid YAML profile format");
        applyProfile(parsed);
    } catch (error) {
        console.error("Could not load ./profile.yml. The page keeps its static HTML defaults.", error);
    }
};

loadProfile();
