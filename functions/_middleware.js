// Runs for every request. Two jobs:
//   1. Redirects the bare production *.pages.dev alias to the custom domain.
//   2. Gates every hostname that is not the production domain behind Basic Auth.
// AUTH_USERNAME / AUTH_PASSWORD are Preview-scoped env vars/secrets set in the
// Cloudflare Pages dashboard (Settings > Environment variables), so every
// non-production deployment has them and the production one deliberately
// does not.

const PRODUCTION_HOST = 'brain-regeneration.com';

// Cloudflare Pages serves the production deployment on this hostname as well as
// on the custom domain. Zone-level WAF rules, rate limits and challenges apply
// only to the zone, so this alias is a way around every protection configured on
// brain-regeneration.com.
const PAGES_DEV_ALIAS = 'brain-regeneration.pages.dev';

export async function onRequest(context) {
	const { request, env, next } = context;
	const url = new URL(request.url);

	if (url.hostname === PAGES_DEV_ALIAS) {
		// 308 rather than 301: this runs for every method, and a 301 lets clients
		// (fetch included) rewrite a non-GET request into a GET on redirect. 308
		// preserves method and body, and search engines treat it as equivalent to
		// 301 for canonicalisation.
		return Response.redirect(`https://${PRODUCTION_HOST}${url.pathname}${url.search}`, 308);
	}

	// Only the production domain is public. Everything else — branch previews,
	// per-deployment hostnames, and any custom domain that is not the apex —
	// needs credentials.
	//
	// Gating on hostname rather than on CF_PAGES_BRANCH is what makes this fail
	// closed. The previous check asked "is this the branch named preview?", so a
	// hostname wired to the wrong deployment served publicly — which is exactly
	// how preview.brain-regeneration.com ended up as an unauthenticated copy of
	// production. Asking "is this the production domain?" cannot fail that way.
	if (url.hostname !== PRODUCTION_HOST) {
		return requireBasicAuth(request, env, next);
	}

	return next();
}

function requireBasicAuth(request, env, next) {
	const unauthorized = () =>
		new Response('Authentication required', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Preview Site"',
				// Prevent browsers (especially iOS WebKit) from caching credentials
				'Cache-Control': 'no-store',
			},
		});

	// Fail closed: if the secret isn't configured, reject everything rather
	// than falling back to an empty/guessable password.
	if (!env.AUTH_PASSWORD) return unauthorized();

	const authorization = request.headers.get('Authorization');
	if (!authorization) return unauthorized();

	const spaceIndex = authorization.indexOf(' ');
	if (spaceIndex === -1) return unauthorized();

	const scheme = authorization.substring(0, spaceIndex).trim();
	const encoded = authorization.substring(spaceIndex + 1).trim();
	if (scheme !== 'Basic') return unauthorized();

	let user, pass;
	try {
		const binary = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
		const decoded = new TextDecoder().decode(binary);
		const colonIndex = decoded.indexOf(':');
		if (colonIndex === -1) return unauthorized();
		user = decoded.substring(0, colonIndex);
		pass = decoded.substring(colonIndex + 1);
	} catch {
		return unauthorized();
	}

	const expectedUsername = env.AUTH_USERNAME || 'preview';
	const expectedPassword = env.AUTH_PASSWORD;

	const encoder = new TextEncoder();
	const expectedUser = encoder.encode(expectedUsername);
	const expectedPass = encoder.encode(expectedPassword);
	const actualUser = encoder.encode(user);
	const actualPass = encoder.encode(pass);

	const usernameOk =
		actualUser.byteLength === expectedUser.byteLength &&
		crypto.subtle.timingSafeEqual(actualUser, expectedUser);
	const passwordOk =
		actualPass.byteLength === expectedPass.byteLength &&
		crypto.subtle.timingSafeEqual(actualPass, expectedPass);

	if (usernameOk && passwordOk) return next();

	return unauthorized();
}
