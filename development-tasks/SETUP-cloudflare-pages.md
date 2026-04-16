# Cloudflare Pages Setup for brain-regeneration.com

## Project Details

- **GitHub repo**: [Human-Singularity/brain-regeneration](https://github.com/Human-Singularity/brain-regeneration)
- **Cloudflare account**: Human Singularity
- **Framework**: Hugo static site generator (`hugo v0.158.0+extended+withdeploy`)
- **Build command**: `hugo` (outputs to `./public`)
- **DNS**: `brain-regeneration.com` is already managed by Cloudflare

## Overview

- **Production**: `main` branch → `brain-regeneration.com`
- **Preview**: `preview` branch → `preview.brain-regeneration.com` (password-protected via Worker)

---

## Step 1: Create Cloudflare Pages Project

1. Go to **Cloudflare Dashboard** (make sure you're in the **Human Singularity** account)
2. Go to **Workers & Pages → Create → Pages → Connect to Git**
3. Select the GitHub repo: `Human-Singularity/brain-regeneration`
4. Configure the build:

| Setting | Value |
|---------|-------|
| Production branch | `main` |
| Build command | `hugo --baseURL $CF_PAGES_URL/` |
| Build output directory | `public` |
| Root directory | _(leave empty)_ |

4. Add these **Environment Variables** (for both Production and Preview):

| Variable | Production Value | Preview Value |
|----------|-----------------|---------------|
| `HUGO_VERSION` | `0.158.0` | `0.158.0` |
| `HUGO_ENV` | `production` | `staging` |

> **Note on `baseURL`:** Using `$CF_PAGES_URL` in the build command means Hugo will automatically use the correct URL for each deployment. For production, override this — see Step 2.

5. Set **Framework preset** to **Hugo**
6. Click **Save and Deploy**

---

## Step 2: Override Production Build Command

After the first deploy, go to **Pages project → Settings → Builds & deployments**:

- **Production build command**: `hugo --baseURL https://brain-regeneration.com/`
- **Preview build command**: `hugo --baseURL https://preview.brain-regeneration.com/`

This ensures each environment uses the correct base URL.

---

## Step 3: Configure Custom Domains

### Production domain

1. Go to **Pages project → Custom domains → Set up a custom domain**
2. Add `brain-regeneration.com`
3. Cloudflare will auto-configure the DNS record (since the domain is already on Cloudflare DNS)
4. Optionally add `www.brain-regeneration.com` and redirect to the apex

### Preview domain

1. In the same Custom domains section, click **Set up a custom domain**
2. Add `preview.brain-regeneration.com`
3. Under **Branch**, select `preview`
4. Cloudflare will create the CNAME record automatically

---

## Step 4: Add Basic Auth via Cloudflare Worker

This puts a shared username/password prompt in front of the preview site.

### 4a. Create the Worker

1. Go to **Cloudflare Dashboard → Workers & Pages → Create → Worker**
2. Name it `preview-basic-auth`
3. Replace the default code with:

```javascript
export default {
  async fetch(request, env) {
    const CREDENTIALS = {
      username: env.AUTH_USERNAME || "preview",
      password: env.AUTH_PASSWORD,
    };

    const authorization = request.headers.get("Authorization");

    if (authorization) {
      const [scheme, encoded] = authorization.split(" ");
      if (scheme === "Basic") {
        const decoded = atob(encoded);
        const [user, pass] = decoded.split(":");
        if (user === CREDENTIALS.username && pass === CREDENTIALS.password) {
          return fetch(request);
        }
      }
    }

    return new Response("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Preview Site"',
      },
    });
  },
};
```

4. Click **Save and Deploy**

### 4b. Set the password as an environment variable

1. Go to **Worker → Settings → Variables and Secrets**
2. Add:
   - `AUTH_USERNAME` = `preview` (or whatever username you want) — plain text is fine
   - `AUTH_PASSWORD` = your chosen password — click **Encrypt** to store it securely

### 4c. Add a Route to the Worker

1. Go to **Cloudflare Dashboard → Websites → brain-regeneration.com → Workers Routes**
2. Click **Add Route**
3. Configure:

| Setting | Value |
|---------|-------|
| Route | `preview.brain-regeneration.com/*` |
| Worker | `preview-basic-auth` |

This ensures the Worker only intercepts requests to the preview subdomain. Production is unaffected.

---

## Step 5: Configure Preview Branch Deployments

1. Go to **Pages project → Settings → Builds & deployments → Branch deployments**
2. Set **Production branch**: `main`
3. Under **Preview branches**, choose:
   - **Custom branches** → add `preview`

   This ensures only the `preview` branch triggers preview builds (not every feature branch).

---

## Step 6: Verify

1. Push a commit to `preview` — Cloudflare Pages should auto-build
2. Visit `preview.brain-regeneration.com` — browser should prompt for username/password
3. Enter the credentials → the preview site should load
4. Push to `main` — production deploys to `brain-regeneration.com` with no auth prompt

---

## Optional: robots.txt for Preview

To prevent search engines from indexing the preview site, add this to `layouts/robots.txt` in the Hugo project and use a conditional:

```html
{{ if eq (getenv "HUGO_ENV") "staging" }}
User-agent: *
Disallow: /
{{ else }}
User-agent: *
Allow: /
Sitemap: {{ .Site.BaseURL }}sitemap.xml
{{ end }}
```

Since the preview is behind basic auth, crawlers can't reach it anyway, but this is a good safety net.

---

## Troubleshooting

- **Build fails with theme not found**: The `themes/brain-regeneration` directory is a regular directory committed to the repo, so this should work out of the box.
- **Submodule `gregory-ai` fails to clone**: This submodule is not needed for the site build. If it causes issues, remove it from `.gitmodules` and run `git rm gregory-ai`.
- **Hugo version mismatch**: Verify the `HUGO_VERSION` environment variable matches `0.158.0`. Cloudflare Pages supports extended Hugo by default.
- **Auth not prompting**: Check that the Worker Route (`preview.brain-regeneration.com/*`) is active and the Worker is deployed. Worker Routes are under **Websites → brain-regeneration.com → Workers Routes**.
- **Auth prompting on production**: Verify the route is set to `preview.brain-regeneration.com/*` only, not `*.brain-regeneration.com/*`.
