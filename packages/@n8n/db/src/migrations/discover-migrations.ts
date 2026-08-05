import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { DatabaseType, Migration } from './migration-types';

// Matches "1784000000042-AddFoo.ts" (src) and "1784000000042-AddFoo.js" (dist);
// the name group rejects dots, which excludes .d.ts and .js.map files.
const MIGRATION_FILE = /^(?<timestamp>\d{10,16})-(?<name>[A-Za-z][A-Za-z0-9]*)\.(?:ts|js)$/;

// A migration class is the export whose name ends in a timestamp. A few legacy
// files export helpers alongside the class, or a class whose name doesn't
// match the file name, so this is the only reliable rule.
const MIGRATION_CLASS = /\d{10,16}$/;

interface MigrationFile {
	name: string;
	timestamp: number;
	filePath: string;
}

function listMigrationFiles(dir: string): MigrationFile[] {
	return readdirSync(dir).flatMap((fileName) => {
		const groups = MIGRATION_FILE.exec(fileName)?.groups;
		if (!groups) return [];
		return {
			name: groups.name,
			timestamp: Number(groups.timestamp),
			filePath: join(dir, fileName),
		};
	});
}

/**
 * Builds the migration list for a DB type from the filesystem instead of the
 * hand-maintained index files: all of `common/` plus the DB-specific folder.
 *
 * A DB-specific migration shadows the common one of the same name — some
 * "common" migrations have per-DB variants, historically even with different
 * timestamps. Within a folder names may repeat (a backfill re-run gets a new
 * timestamp), so shadowing only applies across folders.
 *
 * Execution order is unaffected by discovery order: TypeORM's
 * MigrationExecutor sorts by the timestamp in the class name.
 */
export function discoverMigrations(dbType: DatabaseType): Migration[] {
	const dbFiles = listMigrationFiles(join(__dirname, dbType));
	const dbNames = new Set(dbFiles.map(({ name }) => name));
	const commonFiles = listMigrationFiles(join(__dirname, 'common')).filter(
		({ name }) => !dbNames.has(name),
	);

	return [...commonFiles, ...dbFiles]
		.sort((a, b) => a.timestamp - b.timestamp)
		.map(({ filePath }) => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const exported: unknown = require(filePath);
			const migrations = Object.values(exported as Record<string, unknown>).filter(
				(value): value is Migration =>
					typeof value === 'function' && MIGRATION_CLASS.test(value.name),
			);
			if (migrations.length !== 1) {
				throw new Error(`Expected exactly one exported migration class in ${filePath}`);
			}
			return migrations[0];
		});
}
