import { afterEach, describe, expect, it, vi } from 'vitest';

const validatePortToken = vi.fn();
const containerFetch = vi.fn();
const sandboxFetch = vi.fn();

vi.mock('@cloudflare/sandbox', () => ({
	getSandbox: () => ({
		validatePortToken,
		containerFetch,
		fetch: sandboxFetch,
	}),
	Sandbox: class {},
}));

// Imported after the mock so the module under test picks up the mocked getSandbox.
const { proxyToSandbox } = await import('./request-handler');

const env = { Sandbox: {} } as unknown as Parameters<typeof proxyToSandbox>[1];

function req(hostname: string, init?: RequestInit): Request {
	return new Request(`https://${hostname}/`, init);
}

// port-sandboxId-token.domain — token is exactly 16 chars.
const TOKEN = 'abcdef0123456789';

afterEach(() => {
	vi.clearAllMocks();
});

describe('proxyToSandbox', () => {
	it('returns null for a hostname that is not a sandbox route', async () => {
		const res = await proxyToSandbox(req('example.com'), env);
		expect(res).toBeNull();
		expect(validatePortToken).not.toHaveBeenCalled();
	});

	it('proxies through when the port token is valid', async () => {
		validatePortToken.mockResolvedValue(true);
		containerFetch.mockResolvedValue(new Response('ok'));

		const res = await proxyToSandbox(req(`8001-mysandbox-${TOKEN}.preview.example.dev`), env);

		expect(validatePortToken).toHaveBeenCalledWith(8001, TOKEN);
		expect(containerFetch).toHaveBeenCalledTimes(1);
		expect(res?.status).toBe(200);
	});

	it('returns 404 for a syntactically valid but unissued token (never reaches container)', async () => {
		validatePortToken.mockResolvedValue(false);

		const res = await proxyToSandbox(req(`8001-mysandbox-${TOKEN}.preview.example.dev`), env);

		expect(res?.status).toBe(404);
		expect(containerFetch).not.toHaveBeenCalled();
		expect(sandboxFetch).not.toHaveBeenCalled();
	});

	it('blocks control-plane port 3000 with 404 even with a token, before any token check', async () => {
		const res = await proxyToSandbox(req(`3000-mysandbox-${TOKEN}.preview.example.dev`), env);

		expect(res?.status).toBe(404);
		expect(validatePortToken).not.toHaveBeenCalled();
		expect(containerFetch).not.toHaveBeenCalled();
	});

	it('rejects a WebSocket upgrade with a bad token (no sandbox.fetch)', async () => {
		validatePortToken.mockResolvedValue(false);

		const res = await proxyToSandbox(
			req(`8001-mysandbox-${TOKEN}.preview.example.dev`, {
				headers: { Upgrade: 'websocket' },
			}),
			env,
		);

		expect(res?.status).toBe(404);
		expect(sandboxFetch).not.toHaveBeenCalled();
	});
});
