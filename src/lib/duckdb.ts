import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

/**
 * Initialize DuckDB WASM instance
 */
export async function initDuckDB(): Promise<void> {
	if (db) return; // Already initialized

	const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

	// Select bundle based on browser features
	const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

	const worker_url = URL.createObjectURL(
		new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
	);

	const worker = new Worker(worker_url);
	// Use VoidLogger to suppress query logs, or ConsoleLogger(duckdb.LogLevel.WARNING) for errors only
	const logger = new duckdb.VoidLogger();

	db = new duckdb.AsyncDuckDB(logger, worker);
	await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
	URL.revokeObjectURL(worker_url);

	conn = await db.connect();
}

/**
 * Get active DuckDB connection
 */
export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
	if (!conn) {
		await initDuckDB();
	}
	return conn!;
}

/**
 * Register a Parquet file with DuckDB
 */
export async function registerParquetFile(
	name: string,
	file: File
): Promise<void> {
	const connection = await getConnection();
	const arrayBuffer = await file.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);

	await db!.registerFileBuffer(name, uint8Array);
}

/**
 * Convert BigInt values to numbers or strings for safe JavaScript usage
 */
function convertBigInts(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj;
	}

	// Convert Arrow Vector objects to regular arrays
	// Arrow Vectors have specific properties like 'length', 'stride', and methods like 'toArray'
	if (obj && typeof obj === 'object' &&
	    typeof obj.toArray === 'function' &&
	    typeof obj.length === 'number' &&
	    ('stride' in obj || 'numChildren' in obj || '_offsets' in obj)) {
		try {
			return obj.toArray().map((item: any) => convertBigInts(item));
		} catch (e) {
			// If toArray fails, fall through to other conversions
		}
	}

	if (typeof obj === 'bigint') {
		// Convert to number if it fits safely, otherwise to string
		if (obj >= Number.MIN_SAFE_INTEGER && obj <= Number.MAX_SAFE_INTEGER) {
			return Number(obj);
		}
		return obj.toString();
	}

	if (Array.isArray(obj)) {
		return obj.map(convertBigInts);
	}

	if (typeof obj === 'object') {
		const converted: any = {};
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				converted[key] = convertBigInts(obj[key]);
			}
		}
		return converted;
	}

	return obj;
}

/**
 * Execute a SQL query
 */
export async function executeQuery(query: string): Promise<any[]> {
	const connection = await getConnection();
	const result = await connection.query(query);
	const data = result.toArray();
	// Convert BigInt values to safe JavaScript types
	return convertBigInts(data);
}

/**
 * Get schema information for a table
 */
export async function getTableSchema(tableName: string) {
	const query = `DESCRIBE ${tableName}`;
	const result = await executeQuery(query);
	return result;
}

/**
 * Get row count for a table
 */
export async function getRowCount(tableName: string): Promise<number> {
	const query = `SELECT COUNT(*) as count FROM ${tableName}`;
	const result = await executeQuery(query);
	// Handle both array and object results
	const count = result[0][0] !== undefined ? result[0][0] : result[0].count;
	return count as number;
}

/**
 * Get column statistics based on column type
 */
export async function getColumnStats(tableName: string, columnName: string, columnType: string) {
	const lowerType = columnType.toLowerCase();

	// Array types: stats on array elements (CHECK THIS FIRST before checking element types)
	if (lowerType.includes('[]') || lowerType.includes('list')) {
		// Extract the element type from the array type
		const elementType = lowerType.replace(/\[\]|\s*list\s*/gi, '').trim();

		// For numeric arrays, get stats on the elements
		if (elementType.includes('int') || elementType.includes('double') || elementType.includes('float') || elementType.includes('numeric')) {
			const query = `
				WITH table_stats AS (
					SELECT
						COUNT("${columnName}") as count,
						COUNT(*) - COUNT("${columnName}") as null_count
					FROM ${tableName}
				),
				element_stats AS (
					SELECT
						MIN(element) as min_element,
						MAX(element) as max_element,
						AVG(element) as avg_element
					FROM (
						SELECT unnest("${columnName}") as element
						FROM ${tableName}
						WHERE "${columnName}" IS NOT NULL
					)
				),
				samples AS (
					SELECT list(list_slice("${columnName}", 1, 3)) as samples
					FROM (SELECT "${columnName}" FROM ${tableName} WHERE "${columnName}" IS NOT NULL LIMIT 3)
				)
				SELECT * FROM table_stats, element_stats, samples
			`;
			const result = await executeQuery(query);
			return { type: 'array_numeric', ...result[0] };
		} else {
			// For other array types, just show samples
			const query = `
				WITH table_stats AS (
					SELECT
						COUNT("${columnName}") as count,
						COUNT(*) - COUNT("${columnName}") as null_count
					FROM ${tableName}
				),
				samples AS (
					SELECT list(list_slice("${columnName}", 1, 3)) as samples
					FROM (SELECT "${columnName}" FROM ${tableName} WHERE "${columnName}" IS NOT NULL LIMIT 3)
				)
				SELECT * FROM table_stats, samples
			`;
			const result = await executeQuery(query);
			return { type: 'array_other', ...result[0] };
		}
	}

	// Numeric types: min, max, avg
	if (lowerType.includes('int') || lowerType.includes('double') || lowerType.includes('float') ||
	    lowerType.includes('decimal') || lowerType.includes('numeric') || lowerType === 'real') {
		const query = `
			SELECT
				MIN("${columnName}") as min,
				MAX("${columnName}") as max,
				AVG("${columnName}") as avg,
				COUNT("${columnName}") as count,
				COUNT(*) - COUNT("${columnName}") as null_count
			FROM ${tableName}
		`;
		const result = await executeQuery(query);
		return { type: 'numeric', ...result[0] };
	}

	// Date/Timestamp types: min, max (no avg)
	if (lowerType.includes('date') || lowerType.includes('timestamp') || lowerType.includes('time')) {
		const query = `
			SELECT
				MIN("${columnName}") as min,
				MAX("${columnName}") as max,
				COUNT("${columnName}") as count,
				COUNT(*) - COUNT("${columnName}") as null_count
			FROM ${tableName}
		`;
		const result = await executeQuery(query);
		return { type: 'date', ...result[0] };
	}

	// String types: sample values and count distinct
	if (lowerType.includes('varchar') || lowerType.includes('char') || lowerType.includes('text') || lowerType === 'string') {
		const query = `
			WITH table_stats AS (
				SELECT
					COUNT("${columnName}") as count,
					COUNT(*) - COUNT("${columnName}") as null_count,
					COUNT(DISTINCT "${columnName}") as distinct_count
				FROM ${tableName}
			),
			samples AS (
				SELECT list("${columnName}") as samples
				FROM (SELECT DISTINCT "${columnName}" FROM ${tableName} WHERE "${columnName}" IS NOT NULL LIMIT 5)
			)
			SELECT * FROM table_stats, samples
		`;
		const result = await executeQuery(query);
		return { type: 'string', ...result[0] };
	}

	// Blob types: sample values as hex
	if (lowerType.includes('blob') || lowerType.includes('binary')) {
		const query = `
			WITH table_stats AS (
				SELECT
					COUNT("${columnName}") as count,
					COUNT(*) - COUNT("${columnName}") as null_count
				FROM ${tableName}
			),
			samples AS (
				SELECT list(CASE
					WHEN octet_length("${columnName}") <= 20 THEN hex("${columnName}")
					ELSE hex("${columnName}"[1:20]) || '...'
				END) as samples
				FROM (SELECT "${columnName}" FROM ${tableName} WHERE "${columnName}" IS NOT NULL LIMIT 5)
			)
			SELECT * FROM table_stats, samples
		`;
		const result = await executeQuery(query);
		return { type: 'blob', ...result[0] };
	}

	// Boolean: count true/false
	if (lowerType === 'boolean' || lowerType === 'bool') {
		const query = `
			SELECT
				COUNT("${columnName}") as count,
				COUNT(*) - COUNT("${columnName}") as null_count,
				SUM(CASE WHEN "${columnName}" = true THEN 1 ELSE 0 END) as true_count,
				SUM(CASE WHEN "${columnName}" = false THEN 1 ELSE 0 END) as false_count
			FROM ${tableName}
		`;
		const result = await executeQuery(query);
		return { type: 'boolean', ...result[0] };
	}

	// Default: just count
	const query = `
		SELECT
			COUNT("${columnName}") as count,
			COUNT(*) - COUNT("${columnName}") as null_count
		FROM ${tableName}
	`;
	const result = await executeQuery(query);
	return { type: 'default', ...result[0] };
}

/**
 * Close DuckDB connection
 */
export async function closeDuckDB(): Promise<void> {
	if (conn) {
		await conn.close();
		conn = null;
	}
	if (db) {
		await db.terminate();
		db = null;
	}
}
