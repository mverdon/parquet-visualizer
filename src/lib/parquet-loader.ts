import { registerParquetFile } from './duckdb';

export interface LoadedFile {
	name: string;
	tableName: string;
	size: number;
	file: File;
}

/**
 * Load a single Parquet file
 */
export async function loadParquetFile(file: File): Promise<LoadedFile> {
	// Generate a table name (sanitize filename for SQL)
	const tableName = sanitizeTableName(file.name);

	// Register the file with DuckDB
	await registerParquetFile(file.name, file);

	return {
		name: file.name,
		tableName: file.name,
		size: file.size,
		file
	};
}

/**
 * Load multiple Parquet files from a folder
 */
export async function loadParquetFiles(files: File[]): Promise<LoadedFile[]> {
	const loadedFiles: LoadedFile[] = [];

	for (const file of files) {
		if (file.name.endsWith('.parquet')) {
			const loaded = await loadParquetFile(file);
			loadedFiles.push(loaded);
		}
	}

	return loadedFiles;
}

/**
 * Sanitize filename to create valid SQL table name
 */
function sanitizeTableName(filename: string): string {
	// Remove .parquet extension
	let name = filename.replace(/\.parquet$/i, '');

	// Replace invalid characters with underscores
	name = name.replace(/[^a-zA-Z0-9_]/g, '_');

	// Ensure it starts with a letter or underscore
	if (!/^[a-zA-Z_]/.test(name)) {
		name = '_' + name;
	}

	return name;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
