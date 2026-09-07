import type { QueryResult } from "../types/database";

export function serializeCsv(result: QueryResult): string {
  return [result.columns, ...result.values]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export function downloadCsv(result: QueryResult): boolean {
  if (!result.columns.length) return false;
  const csv = serializeCsv(result);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "query-results.csv";
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
