import type { QueryResult } from "../types/database";

export function downloadCsv(result: QueryResult): boolean {
  if (!result.columns.length) return false;
  const csv = [result.columns, ...result.values]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "query-results.csv";
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
