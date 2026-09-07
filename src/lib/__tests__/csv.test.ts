import { describe, expect, it } from "vitest";
import { downloadCsv, serializeCsv } from "../csv";

describe("serializeCsv", () => {
  it("serializes headers and values", () => {
    expect(
      serializeCsv({
        columns: ["name", "active"],
        values: [
          ["Ada", true],
          ["Linus", false],
        ],
      }),
    ).toBe('"name","active"\n"Ada","true"\n"Linus","false"');
  });

  it("escapes quotes and preserves commas and newlines", () => {
    expect(
      serializeCsv({
        columns: ["value"],
        values: [['say "hello"'], ["comma,value"], ["line\nbreak"], [null]],
      }),
    ).toBe('"value"\n"say ""hello"""\n"comma,value"\n"line\nbreak"\n""');
  });

  it("returns an empty string for a result without columns", () => {
    expect(serializeCsv({ columns: [], values: [] })).toBe("");
    expect(downloadCsv({ columns: [], values: [] })).toBe(false);
  });
});
