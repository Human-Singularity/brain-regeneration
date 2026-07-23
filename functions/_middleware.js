// Gates access to preview-branch deployments with HTTP Basic Auth.
// Runs for every request; no-ops on production (CF_PAGES_BRANCH !== "preview").
// AUTH_USERNAME / AUTH_PASSWORD are set as Preview-scoped env vars/secrets
// in the Cloudflare Pages dashboard (Settings > Environment variables).
export async function onRequest(context) {
	const { request, env, next } = context;

	if (env.CF_PAGES_BRANCH !== 'preview') {
		return next();
	}

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
