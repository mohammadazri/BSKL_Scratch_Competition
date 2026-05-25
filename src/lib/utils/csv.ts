// Minimal CSV parser — handles quoted fields, commas inside quotes, escaped
// double-quotes (""), BOM and CRLF/LF line endings. Returns a header-keyed
// row array. We avoid pulling in papaparse to keep the bundle small and the
// install footprint zero (the deploy target is a Raspberry Pi).

export interface CsvParseOptions {
	skipEmptyLines?: boolean;
	trimHeaders?: boolean;
	trimValues?: boolean;
}

export interface CsvParseResult {
	headers: string[];
	rows: Record<string, string>[];
	errors: { line: number; message: string }[];
}

/** Split a CSV text into rows of fields, RFC 4180-ish. */
function tokenize(text: string): string[][] {
	const out: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuote = false;
	let i = 0;
	// Strip UTF-8 BOM.
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
	while (i < text.length) {
		const c = text[i];
		if (inQuote) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuote = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}
		if (c === '"') {
			inQuote = true;
			i++;
			continue;
		}
		if (c === ',') {
			row.push(field);
			field = '';
			i++;
			continue;
		}
		if (c === '\r') {
			// CRLF or lone CR
			row.push(field);
			out.push(row);
			row = [];
			field = '';
			i++;
			if (text[i] === '\n') i++;
			continue;
		}
		if (c === '\n') {
			row.push(field);
			out.push(row);
			row = [];
			field = '';
			i++;
			continue;
		}
		field += c;
		i++;
	}
	// Flush trailing field/row.
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		out.push(row);
	}
	return out;
}

export function parseCsv(text: string, opts: CsvParseOptions = {}): CsvParseResult {
	const { skipEmptyLines = true, trimHeaders = true, trimValues = true } = opts;
	const tokens = tokenize(text);
	if (tokens.length === 0) return { headers: [], rows: [], errors: [] };

	const headerRow = tokens[0].map((h) => (trimHeaders ? h.trim() : h));
	const headers = headerRow.filter((h) => h.length > 0);
	const rows: Record<string, string>[] = [];
	const errors: { line: number; message: string }[] = [];

	for (let r = 1; r < tokens.length; r++) {
		const cells = tokens[r];
		// Skip blank lines.
		if (skipEmptyLines && cells.every((v) => v.trim() === '')) continue;
		if (cells.length !== headerRow.length) {
			errors.push({
				line: r + 1,
				message: `expected ${headerRow.length} fields, got ${cells.length}`
			});
			continue;
		}
		const obj: Record<string, string> = {};
		for (let c = 0; c < headerRow.length; c++) {
			const key = headerRow[c];
			if (!key) continue;
			obj[key] = trimValues ? cells[c].trim() : cells[c];
		}
		rows.push(obj);
	}

	return { headers, rows, errors };
}

/** Stringify rows to a CSV — quotes fields that need it. */
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
	const esc = (v: unknown) => {
		if (v === null || v === undefined) return '';
		const s = String(v);
		if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
			return '"' + s.replace(/"/g, '""') + '"';
		}
		return s;
	};
	const lines = [headers.join(',')];
	for (const row of rows) {
		lines.push(headers.map((h) => esc(row[h])).join(','));
	}
	return lines.join('\n');
}
