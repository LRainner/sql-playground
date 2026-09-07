import type { QueryResult } from "../../types/database";

const MAX_SQL_FILE_BYTES = 20 * 1024 * 1024;

export type PGliteQueryResult = {
  fields: Array<{ name: string }>;
  rows: Array<Record<string, unknown>>;
};

function formatValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array)
    return `\\x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

export function toLastQueryResult(results: readonly PGliteQueryResult[]): QueryResult {
  let result: PGliteQueryResult | undefined;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index].fields.length) {
      result = results[index];
      break;
    }
  }
  if (!result) return { columns: [], values: [] };
  const columns = result.fields.map((field) => field.name);
  return {
    columns,
    values: result.rows.map((row) => columns.map((column) => formatValue(row[column]))),
  };
}

export function decodeSqlImport(bytes: Uint8Array, fileName: string): string {
  if (!fileName.toLowerCase().endsWith(".sql")) {
    throw new Error("PostgreSQL imports currently support .sql files only");
  }
  if (bytes.byteLength > MAX_SQL_FILE_BYTES) {
    throw new Error("SQL files must be 20 MB or smaller");
  }
  let sql: string;
  try {
    sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The SQL file is not valid UTF-8 text");
  }
  if (!sql.trim()) throw new Error("The SQL file is empty");
  if (/^\s*\\(?:connect|copy|include|ir|i|g|lo_import|lo_export)\b/m.test(sql)) {
    throw new Error("psql meta-commands such as \\copy and \\connect are not supported");
  }
  return sql;
}
