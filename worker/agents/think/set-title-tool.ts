/**
 * `set_title` — lets the Think agent name the project with a short, human
 * friendly display title. This is a no-op tool inside the ThinkAgent DO: it
 * simply echoes the chosen title back as its output. The host behavior
 * (`ThinkCodingBehavior.translateChunk`) observes the tool's streamed output
 * — the same channel it uses for `deploy_space` — and persists the title to
 * the app state + database. No RPC round-trip through the parent agent is
 * required.
 */
import { tool, type Tool } from 'ai';
import { z } from 'zod';

const DESCRIPTION = [
	'Set a short, human-friendly display title for this project (shown in the app list and preview header).',
	'',
	'Call this once, early, ONLY IF the project does not yet have a clear name — for example when the user request is a long or vague description rather than a concise product name. Keep it under ~60 characters, in Title Case, with no surrounding quotes.',
	'',
	'Do not call this on every turn; a single good title is enough unless the user asks to rename.',
].join('\n');

export function createSetTitleTool(): Tool {
	return tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			title: z
				.string()
				.describe('The short display title, ideally under 60 characters.'),
		}),
		execute: async (args: { title: string }) => {
			const title = (args.title ?? '').trim();
			if (title.length === 0) {
				return JSON.stringify({ error: 'Title must not be empty.' });
			}
			return JSON.stringify({ ok: true, title });
		},
	});
}
