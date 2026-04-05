This repo should serve as a template to create a short profile page for CIT students at TUM

> **Features:**
> - Standardized template
> - Easily add personal information
> - Automatic deployment from github


## Motivation

Other universities such as CMU or Stanford have cool institutional profile pages to improve visibility (links: [CMU](https://computing.cs.cmu.edu/help-support/web-publishing), [Stanford](https://profiles.stanford.edu/)).  
That's why this template is meant to make profile publishing easier for CIT students to obtain a similar personal academic webpages.

# Usage

1. Fill in your personal information in [`'profile.yml'`](profile.yml).
2. Replace [`'photo.webp'`](photo.webp) with your own image.
3. Follow the instructions on the [wiki](https://wiki.ito.cit.tum.de/bin/view/CIT/ITO/Docs/Guides/Helpdesk/EigeneHomepage/) to make your site public.
4. Ensure you set file permission correctly (see [CIT permission tree view](#cit-permission-setup-tree-view))
5. *Optional:* Add SEO meta tags for site ownership verification to [`'index.html'`](index.html)
6. *Optional*: Set up [Github Action Workflow](#optional-github-actions-deploy-setup) for automatic deployment

## CIT Permission Setup (Tree View)

Make sure your files on lxhalle have the following minimum permissions:

```text
/u/halle/<login>/                                directory: o+x
`-- home_at/                                     directory: o+x
	`-- home_page/                               directory: o+x
		`-- html-data/                           directory: o+rx
			|-- index.html                       file: o+r
			|-- profile.yml                      file: o+r
			|-- photo.webp                       file: o+r
			|-- robots.txt                       file: o+r
			|-- sitemap.xml                      file: o+r
			|-- site.webmanifest                 file: o+r
			|-- styles/                          directory: o+rx
			|   `-- main.css                     file: o+r
			|-- scripts/                         directory: o+rx
			|   `-- profile-loader.js            file: o+r
			`-- icons/                           directory: o+rx
				`-- favicon/                     directory: o+rx
					|-- favicon.ico              file: o+r
					|-- favicon.svg              file: o+r
					|-- favicon-96x96.webp       file: o+r
					`-- apple-touch-icon.webp    file: o+r
```

## *Optional* Set SEO Meta tags

In [`'index.html'`](index.html) you can set meta tags to verify site ownership to common search engines:

```html
    <!-- Search engine verification — uncomment each after obtaining your token -->
    <!-- Google Search Console  → https://search.google.com/search-console -->
    <!-- <meta name="google-site-verification" content="YOUR_TOKEN" /> -->
    <!-- Bing Webmaster Tools   → https://www.bing.com/webmasters -->
    <!-- <meta name="msvalidate.01" content="YOUR_TOKEN" /> -->
    <!-- Yandex Webmaster       → https://webmaster.yandex.com DOESN'T WORK CURRENTLY-->
    <!-- <meta name="yandex-verification" content="YOUR_TOKEN" /> -->
    <!-- Baidu Webmaster        → https://ziyuan.baidu.com/site -->
    <!-- <meta name="baidu-site-verification" content="YOUR_TOKEN" /> -->
    <!-- Naver Search Advisor   → https://searchadvisor.naver.com -->
    <!-- <meta name="naver-site-verification" content="YOUR_TOKEN" /> -->
    <!-- Seznam Webmaster       → https://search.seznam.cz -->
    <!-- <meta name="seznam-wmt" content="YOUR_TOKEN" /> -->
    <!-- Pinterest              → https://developers.pinterest.com/tools/url-debugger -->
    <!-- <meta name="p:domain_verify" content="YOUR_TOKEN" /> -->
```

*Note* that some engines might not work if they only allow top-level verification.

## *Optional* GitHub Actions Deploy Setup

### 1. Create a dedicated deploy key pair

Create a dedicated SSH key that is only used by GitHub Actions.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/cit_deploy_key -C "github-actions-deploy"
```

### 2. Add strict restrictions in `authorized_keys`

On the lxhalle server, append the public key with restrictions to `~/.ssh/authorized_keys`:

```text
restrict,command="/usr/bin/rrsync -wo /u/halle/<CIT-login>/home_page/html-data" ssh-ed25519 AAAA... github-actions-deploy
```

Replace:

- `<CIT-login>` with your CIT login
- `AAAA...` with the full public key body from `~/.ssh/cit_deploy_key.pub`

Why this is safe:

- `restrict` disables interactive shell features (pty, forwarding, agent forwarding, X11)
- forced `command="...rrsync ..."` prevents arbitrary command execution
- `-wo` allows write-only sync behavior for deployment
- path argument confines writes to your site directory

Also enforce SSH file permissions on server:

### 3. Add GitHub Environment and secrets

In repo settings on GitHub:

1. Create environment `deployment`.
2. Add environment secret `DEPLOY_SSH_KEY` with the full private key content.
3. Add environment secret `DEPLOY_USER` with your CIT-login (for example `muster`).

### 4. Edit deployment workflow to point to your website

At the top in [`'deploy-rsync.yml'`](.github/workflows/deploy-rsync.yml) replay 'CIT-login' with your credentials to point the workflow to your site upon successfull completion.


# Disclaimer

This project is an independent student template and is **not** officially affiliated with, endorsed by, or representing Technical University of Munich (TUM).

All trademarks, logos, and brand names are the property of their respective owners and are used here only for identification/reference purposes.  
No copyright or trademark infringement is intended.

The colors used in this template were selected based on an unofficial reference [gist](https://gist.github.com/lnksz/51e3566af2df5c7aa678cd4dfc8305f7).

If you are a rights holder and believe any material (including color usage, branding, or other assets) is inappropriate, please contact me directly at[konstantantin.zeck@tum.de] and I will review and remove/adjust the content promptly.

To the maximum extent permitted by applicable law, this template is provided **"as is"**, without warranties, and I do not accept liability for third-party use, modifications, deployments, outages, data loss, or security incidents arising from use of this repository.

This limitation of liability explicitly includes use, misconfiguration, or abuse of the included GitHub Actions workflow, SSH keys, deployment scripts, and any related automation.

Security improvements are always welcome! If you identify a weakness or have a hardening suggestion, please open an issue or pull request so it can be reviewed and improved for everyone.

Original template by Konstantin Zeck.
