import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import via the same specifier the handler uses so `instanceof` matches the
// class identity inside space-preview.ts (Vite resolves the `shared` alias).
import { RateLimitExceededError } from 'shared/types/errors';

// getPreviewVersion is always 0 here (no visibility revocation under test).
vi.mock('../../database/services/AppService', () => ({
	AppService: class {
		async getPreviewVersion() {
			return 0;
		}
	},
}));

// Simulate the per-token limiter: allow up to LIMIT calls per token, then throw.
const LIMIT = 3;
const callsByToken = new Map<string, number>();
vi.mock('../../services/rate-limit/rateLimits', () => ({
	RateLimitService: {
		enforceSpacePreviewRateLimit: async (
			_env: unknown,
			_config: unknown,
			tokenId: string,
		) => {
			const n = (callsByToken.get(tokenId) ?? 0) + 1;
			callsByToken.set(tokenId, n);
			if (n > LIMIT) {
				throw new RateLimitExceededError('Space preview rate limit exceeded', 'spacePreview');
			}
		},
	},
}));

const { handleSpacePreview } = await import('./space-preview');
const { signSpacePreviewToken } = await import('../../utils/spacePreviewToken');

const JWT_SECRET = 'test-secret-for-space-preview-token-validation-1234567890';

type HandlerEnv = Parameters<typeof handleSpacePreview>[1];

function makeEnv(): HandlerEnv {
	const stub = {
		fetch: async () => new Response('ok', { headers: { 'content-type': 'text/html' } }),
	};
	return {
		JWT_SECRET,
		CUSTOM_DOMAIN: 'example.com',
		CUSTOM_PREVIEW_DOMAIN: '',
		SPACE_DO: { idFromName: (n: string) => n, get: () => stub },
	} as unknown as HandlerEnv;
}

function previewRequest(token: string): Request {
	return new Request(
		`https://example.com/space/space-a/preview/main/?t=${encodeURIComponent(token)}`,
	);
}

beforeEach(() => {
	callsByToken.clear();
});

describe('handleSpacePreview rate limiting', () => {
	it('returns 200 up to the limit then 429 for sustained same-token traffic', async () => {
		const env = makeEnv();
		const token = await signSpacePreviewToken(env, {
			spaceName: 'space-a',
			branch: 'main',
			userId: 'user-a',
			previewVersion: 0,
		});
		const req = () => handleSpacePreview(previewRequest(token), env, 'space-a', 'main');

		for (let i = 0; i < LIMIT; i++) {
			expect((await req()).status).toBe(200);
		}
		// Over the limit.
		expect((await req()).status).toBe(429);
	});

	it('counts distinct tokens separately', async () => {
		const env = makeEnv();
		const tokenA = await signSpacePreviewToken(env, {
			spaceName: 'space-a',
			branch: 'main',
			userId: 'user-a',
			previewVersion: 0,
		});
		const tokenB = await signSpacePreviewToken(env, {
			spaceName: 'space-a',
			branch: 'main',
			userId: 'user-b',
			previewVersion: 0,
		});

		// Exhaust token A.
		for (let i = 0; i < LIMIT; i++) {
			await handleSpacePreview(previewRequest(tokenA), env, 'space-a', 'main');
		}
		expect((await handleSpacePreview(previewRequest(tokenA), env, 'space-a', 'main')).status).toBe(429);
		// Token B is unaffected.
		expect((await handleSpacePreview(previewRequest(tokenB), env, 'space-a', 'main')).status).toBe(200);
	});
});
