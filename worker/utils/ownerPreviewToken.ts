/**
 * Owner-preview token — lets the authenticated owner of a PRIVATE deployed app
 * open its deployment URL on a preview subdomain.
 *
 * Main-domain session cookies are host-scoped to `CUSTOM_DOMAIN` and are NOT
 * sent to preview subdomains, so the routing gate cannot see the normal session
 * there. Instead the UI mints this short-lived, deployment-scoped token and
 * appends it to the deployment URL; on first hit the gate sets an HttpOnly,
 * subdomain-scoped cookie so subsequent requests need no query param.
 */
import { JWTUtils } from './jwtUtils';

const OWNER_PREVIEW_PURPOSE = 'owner_preview';
export const OWNER_PREVIEW_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const OWNER_PREVIEW_QUERY_PARAM = '__vibesdk_owner';
export const OWNER_PREVIEW_COOKIE_NAME = '__vibesdk_owner';

export interface OwnerPreviewClaims {
	/** The app owner's user id. */
	userId: string;
	/** The deployment id (== preview subdomain) this token is scoped to. */
	deploymentId: string;
}

export async function signOwnerPreviewToken(
	env: { JWT_SECRET: string },
	claims: OwnerPreviewClaims,
): Promise<string> {
	const jwt = JWTUtils.getInstance(env);
	return jwt.signPayload(
		{ ...claims, purpose: OWNER_PREVIEW_PURPOSE },
		OWNER_PREVIEW_TOKEN_TTL_SECONDS,
	);
}

/**
 * Verify a token and confirm it was minted for `expectedDeploymentId`.
 * Returns the owner user id on success, or `null` otherwise.
 */
export async function verifyOwnerPreviewToken(
	env: { JWT_SECRET: string },
	token: string,
	expectedDeploymentId: string,
): Promise<string | null> {
	const jwt = JWTUtils.getInstance(env);
	const payload = await jwt.verifyPayload(token);
	if (!payload) return null;
	if (payload.purpose !== OWNER_PREVIEW_PURPOSE) return null;
	if (typeof payload.deploymentId !== 'string' || payload.deploymentId !== expectedDeploymentId) {
		return null;
	}
	if (typeof payload.userId !== 'string' || payload.userId.trim() === '') return null;
	return payload.userId;
}

/** Read the owner-preview token from the `?__vibesdk_owner=` query param. */
export function readOwnerPreviewTokenFromQuery(url: URL): string | null {
	const token = url.searchParams.get(OWNER_PREVIEW_QUERY_PARAM);
	return token && token.trim() !== '' ? token : null;
}

/** Read the owner-preview cookie value from a request's `Cookie` header. */
export function readOwnerPreviewCookie(request: Request): string | null {
	const header = request.headers.get('Cookie');
	if (!header) return null;
	for (const pair of header.split(';')) {
		const idx = pair.indexOf('=');
		if (idx === -1) continue;
		const name = pair.slice(0, idx).trim();
		if (name === OWNER_PREVIEW_COOKIE_NAME) {
			return pair.slice(idx + 1).trim();
		}
	}
	return null;
}

/**
 * Build the `Set-Cookie` value for the HttpOnly owner-preview cookie. It is
 * scoped to the exact preview subdomain (no `Domain` attribute) and `Path=/`.
 */
export function buildOwnerPreviewCookie(opts: {
	token: string;
	secure: boolean;
	ttlSeconds?: number;
}): string {
	const { token, secure } = opts;
	const maxAge = opts.ttlSeconds ?? OWNER_PREVIEW_TOKEN_TTL_SECONDS;
	const parts = [
		`${OWNER_PREVIEW_COOKIE_NAME}=${token}`,
		'Path=/',
		`Max-Age=${maxAge}`,
		'HttpOnly',
		'SameSite=Lax',
	];
	if (secure) parts.push('Secure');
	return parts.join('; ');
}
