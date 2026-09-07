import { describe, expect, it } from "vitest";
import { decodeSqlImport, toLastQueryResult } from "../adapter";

describe("toLastQueryResult", () => {
  it("returns an empty result when no statement produced columns", () => {
    expect(toLastQueryResult([])).toEqual({ columns: [], values: [] });
    expect(toLastQueryResult([{ fields: [], rows: [] }])).toEqual({ columns: [], values: [] });
  });

  it("uses the last statement that produced a result set", () => {
    expect(
      toLastQueryResult([
        { fields: [{ name: "first" }], rows: [{ first: 1 }] },
        { fields: [], rows: [] },
        { fields: [{ name: "last" }], rows: [{ last: 2 }] },
        { fields: [], rows: [] },
      ]),
    ).toEqual({ columns: ["last"], values: [[2]] });
  });

  it("normalizes PostgreSQL values for display and CSV export", () => {
    const date = new Date("2025-01-12T00:00:00.000Z");
    expect(
      toLastQueryResult([
        {
          fields: [
            { name: "date" },
            { name: "large_id" },
            { name: "payload" },
            { name: "tags" },
            { name: "bytes" },
            { name: "missing" },
          ],
          rows: [
            {
              date,
              large_id: 9_007_199_254_740_993n,
              payload: { ok: true },
              tags: ["sql", "wasm"],
              bytes: new Uint8Array([0, 255]),
              missing: null,
            },
          ],
        },
      ]),
    ).toEqual({
      columns: ["date", "large_id", "payload", "tags", "bytes", "missing"],
      values: [
        [
          "2025-01-12T00:00:00.000Z",
          "9007199254740993",
          '{"ok":true}',
          '["sql","wasm"]',
          "\\x00ff",
          null,
        ],
      ],
    });
  });
});

describe("decodeSqlImport", () => {
  const encode = (sql: string) => new TextEncoder().encode(sql);

  it("accepts UTF-8 SQL files and preserves their content", () => {
    const sql = "CREATE TABLE 用户 (id INTEGER);";
    expect(decodeSqlImport(encode(sql), "backup.SQL")).toBe(sql);
  });

  it("rejects unsupported file extensions", () => {
    expect(() => decodeSqlImport(encode("SELECT 1;"), "backup.dump")).toThrow(
      "PostgreSQL imports currently support .sql files only",
    );
  });

  it("rejects empty and invalid UTF-8 files", () => {
    expect(() => decodeSqlImport(encode("  \n"), "empty.sql")).toThrow("The SQL file is empty");
    expect(() => decodeSqlImport(new Uint8Array([0xff]), "invalid.sql")).toThrow(
      "The SQL file is not valid UTF-8 text",
    );
  });

  it("rejects files larger than 20 MB", () => {
    expect(() => decodeSqlImport(new Uint8Array(20 * 1024 * 1024 + 1), "large.sql")).toThrow(
      "SQL files must be 20 MB or smaller",
    );
  });

  it.each(["\\copy demo FROM 'demo.csv';", "  \\connect another_database"])(
    "rejects unsupported psql meta-command: %s",
    (sql) => {
      expect(() => decodeSqlImport(encode(sql), "backup.sql")).toThrow(
        "psql meta-commands such as \\copy and \\connect are not supported",
      );
    },
  );
});
