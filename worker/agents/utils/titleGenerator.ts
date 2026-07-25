/**
 * Derive a short, human-friendly display title from a (potentially very long)
 * user query. Titles are metadata only (apps list + preview header) and are
 * not fed into generation, so this is a cheap deterministic transform:
 *
 * - collapse all whitespace/newlines to single spaces and trim
 * - if within `maxLength`, return as-is
 * - otherwise cut at the last word boundary before the limit and append an
 *   ellipsis (falling back to a hard cut when there is no early boundary)
 * - never return an empty string (falls back to `fallback`)
 */
export function deriveShortTitle(
	query: string,
	maxLength = 60,
	fallback = 'New project',
): string {
	const normalized = (query ?? '').replace(/\s+/g, ' ').trim();
	if (normalized.length === 0) {
		return fallback;
	}
	if (normalized.length <= maxLength) {
		return normalized;
	}

	const slice = normalized.slice(0, maxLength);
	const lastSpace = slice.lastIndexOf(' ');
	// Only prefer the word boundary if it keeps a reasonable amount of text.
	const base = lastSpace > maxLength * 0.5 ? slice.slice(0, lastSpace) : slice;
	return `${base.trimEnd()}…`;
}
