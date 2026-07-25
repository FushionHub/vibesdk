import { describe, it, expect } from 'vitest';
import { deriveShortTitle } from './titleGenerator';

describe('deriveShortTitle', () => {
	it('returns short queries unchanged (trimmed)', () => {
		expect(deriveShortTitle('  Todo app  ')).toBe('Todo app');
	});

	it('collapses newlines and repeated whitespace to single spaces', () => {
		expect(deriveShortTitle('Build a\n\n  task   manager')).toBe(
			'Build a task manager',
		);
	});

	it('truncates long queries on a word boundary with an ellipsis', () => {
		const query =
			'Build a full featured project management application with kanban boards and reporting dashboards';
		const result = deriveShortTitle(query, 60);
		expect(result.endsWith('…')).toBe(true);
		expect(result.length).toBeLessThanOrEqual(61);
		expect(result).not.toContain('  ');
		// Should cut on a word boundary, not mid-word.
		expect(query.startsWith(result.slice(0, -1))).toBe(true);
		expect(result.slice(0, -1).endsWith(' ')).toBe(false);
	});

	it('hard-cuts when there is no early word boundary', () => {
		const query = 'a'.repeat(100);
		const result = deriveShortTitle(query, 60);
		expect(result).toBe(`${'a'.repeat(60)}…`);
	});

	it('falls back for empty or whitespace-only input', () => {
		expect(deriveShortTitle('')).toBe('New project');
		expect(deriveShortTitle('   \n  ')).toBe('New project');
		expect(deriveShortTitle('', 60, 'Untitled')).toBe('Untitled');
	});
});
