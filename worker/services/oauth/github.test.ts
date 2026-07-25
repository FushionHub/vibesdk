import { describe, it, expect, vi, afterEach } from 'vitest';
import { GitHubOAuthProvider } from './github';

type GitHubEmail = { email: string; verified: boolean; primary: boolean };

function mockGitHubFetch(options: {
	user: { id: number; login: string; email?: string; name?: string };
	emails?: GitHubEmail[];
	emailsStatus?: number;
}) {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = typeof input === 'string' ? input : input.toString();
		if (url === 'https://api.github.com/user') {
			return new Response(JSON.stringify(options.user), { status: 200 });
		}
		if (url === 'https://api.github.com/user/emails') {
			return new Response(JSON.stringify(options.emails ?? []), {
				status: options.emailsStatus ?? 200,
			});
		}
		throw new Error(`Unexpected fetch to ${url}`);
	});
}

function createProvider() {
	return new GitHubOAuthProvider('client-id', 'client-secret', 'https://app.local/api/auth/callback/github');
}

describe('GitHubOAuthProvider.getUserInfo', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('selects the verified primary email and reports it verified', async () => {
		vi.stubGlobal(
			'fetch',
			mockGitHubFetch({
				user: { id: 1, login: 'octocat', name: 'Octo Cat' },
				emails: [
					{ email: 'secondary@example.com', verified: true, primary: false },
					{ email: 'primary@example.com', verified: true, primary: true },
				],
			}),
		);

		const info = await createProvider().getUserInfo('token');

		expect(info.email).toBe('primary@example.com');
		expect(info.emailVerified).toBe(true);
		expect(info.id).toBe('1');
	});

	it('falls back to a verified non-primary email', async () => {
		vi.stubGlobal(
			'fetch',
			mockGitHubFetch({
				user: { id: 2, login: 'octocat' },
				emails: [
					{ email: 'primary@example.com', verified: false, primary: true },
					{ email: 'verified@example.com', verified: true, primary: false },
				],
			}),
		);

		const info = await createProvider().getUserInfo('token');

		expect(info.email).toBe('verified@example.com');
		expect(info.emailVerified).toBe(true);
	});

	it('reports emailVerified=false when no verified email exists', async () => {
		vi.stubGlobal(
			'fetch',
			mockGitHubFetch({
				user: { id: 3, login: 'octocat', email: 'unverified@example.com' },
				emails: [
					{ email: 'unverified@example.com', verified: false, primary: true },
				],
			}),
		);

		const info = await createProvider().getUserInfo('token');

		// Never hardcodes verification; an unverified address must surface as unverified
		// so the auth layer can fail closed.
		expect(info.email).toBe('unverified@example.com');
		expect(info.emailVerified).toBe(false);
	});

	it('throws when no email can be resolved', async () => {
		vi.stubGlobal(
			'fetch',
			mockGitHubFetch({
				user: { id: 4, login: 'octocat' },
				emails: [],
			}),
		);

		await expect(createProvider().getUserInfo('token')).rejects.toThrow(
			/Could not retrieve user email/,
		);
	});
});
