import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_FILE = /^(?<base>\d{10,16}-[A-Za-z][A-Za-z0-9]*)\.ts$/;

/**
 * Verifies that a generated migrations index matches the migration files
 * currently on disk, so a migration file added without regenerating cannot be
 * silently skipped. The index files are gitignored build artifacts (see
 * scripts/generate-migration-index.mjs); every build script regenerates them,
 * but tools that load src directly (Vitest in this and other packages) don't
 * run a build — this import-time check is what makes that path fail loudly.
 *
 * The hash covers file names only: editing a migration's content doesn't
 * require regeneration, since imports resolve to the live modules.
 * Must stay in sync with the hash in scripts/generate-migration-index.mjs.
 */
export function assertMigrationIndexInSync(indexDir: string, expectedHash: string) {
	// Running from dist means a build just emitted this index alongside the
	// compiled migrations, so it can't be stale — while tsc leaves compiled
	// output of since-deleted migration files behind, which would
	// false-positive a file-listing check. Only src is worth verifying.
	if (__filename.endsWith('.js')) return;

	const hash = createHash('sha256');
	const keys: string[] = [];
	for (const dir of [join(indexDir, '..', 'common'), indexDir]) {
		const folder = dir.split(/[\\/]/).pop();
		for (const fileName of readdirSync(dir)) {
			const base = MIGRATION_FILE.exec(fileName)?.groups?.base;
			if (base) keys.push(`${folder}/${base}`);
		}
	}
	for (const key of keys.sort()) hash.update(`${key}\n`);

	if (hash.digest('hex') !== expectedHash) {
		throw new Error(
			`The generated migrations index in ${indexDir} is out of sync with the migration files on disk. ` +
				'Regenerate it with: pnpm --filter=@n8n/db build (or test/typecheck/lint/migration:new)',
		);
	}
}
