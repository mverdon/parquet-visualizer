export interface ColumnSchema {
	name: string;
	type: string;
	nullable: boolean;
}

export interface TableStats {
	rowCount: number;
	columnCount: number;
	fileSize: number;
}

/**
 * Parse DuckDB DESCRIBE output to column schema
 */
export function parseColumnSchema(describeResult: any[]): ColumnSchema[] {
	return describeResult.map((row) => ({
		name: row[0] || row.column_name,
		type: row[1] || row.column_type,
		nullable: (row[2] || row.null) === 'YES'
	}));
}

/**
 * Get SQL type color for display
 */
export function getTypeColor(type: string): string {
	if (!type) {
		return 'text-gray-600';
	}

	const typeUpper = type.toUpperCase();

	if (typeUpper.includes('INT') || typeUpper.includes('BIGINT')) {
		return 'text-blue-600';
	}
	if (typeUpper.includes('DOUBLE') || typeUpper.includes('FLOAT') || typeUpper.includes('DECIMAL')) {
		return 'text-green-600';
	}
	if (typeUpper.includes('VARCHAR') || typeUpper.includes('TEXT') || typeUpper.includes('STRING')) {
		return 'text-purple-600';
	}
	if (typeUpper.includes('TIMESTAMP') || typeUpper.includes('DATE') || typeUpper.includes('TIME')) {
		return 'text-orange-600';
	}
	if (typeUpper.includes('BOOL')) {
		return 'text-pink-600';
	}
	if (typeUpper.includes('STRUCT') || typeUpper.includes('LIST') || typeUpper.includes('MAP')) {
		return 'text-indigo-600';
	}

	return 'text-gray-600';
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
	return num.toLocaleString();
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

/**
 * Truncate long strings for display
 */
export function truncateString(str: string, maxLength: number = 50): string {
	if (str.length <= maxLength) return str;
	return str.substring(0, maxLength - 3) + '...';
}
