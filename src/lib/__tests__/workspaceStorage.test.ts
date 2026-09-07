import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWorkspaceState, saveWorkspaceState } from "../workspaceStorage";

const STORAGE_KEY = "sql-playground-workspace";
let storedValues: Map<string, string>;

beforeEach(() => {
  storedValues = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn((key: string) => storedValues.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storedValues.set(key, value)),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadWorkspaceState", () => {
  it("returns null when no workspace has been saved", () => {
    expect(loadWorkspaceState(["sqlite"])).toBeNull();
  });

  it.each(["not-json", JSON.stringify({ version: 2, workspaces: {}, editorHeight: 240 })])(
    "rejects malformed or unsupported data",
    (value) => {
      window.localStorage.setItem(STORAGE_KEY, value);
      expect(loadWorkspaceState(["sqlite"])).toBeNull();
    },
  );

  it("restores known engines and ignores unknown ones", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        editorHeight: 280,
        workspaces: {
          sqlite: {
            activeTabId: "query-2",
            tabs: [
              { id: "query-1", title: "Query 1", sql: "SELECT 1;" },
              { id: "query-2", title: "Query 2", sql: "SELECT 2;" },
            ],
          },
          removedEngine: {
            activeTabId: "query-1",
            tabs: [{ id: "query-1", title: "Old", sql: "SELECT 3;" }],
          },
        },
      }),
    );

    expect(loadWorkspaceState(["sqlite", "postgresql"])).toEqual({
      editorHeight: 280,
      workspaces: {
        sqlite: {
          activeTabId: "query-2",
          tabs: [
            { id: "query-1", title: "Query 1", sql: "SELECT 1;" },
            { id: "query-2", title: "Query 2", sql: "SELECT 2;" },
          ],
        },
      },
    });
  });

  it("drops invalid and duplicate tabs and repairs an invalid active tab", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        editorHeight: 240,
        workspaces: {
          sqlite: {
            activeTabId: "missing",
            tabs: [
              { id: "query-1", title: "Query 1", sql: "SELECT 1;" },
              { id: "query-1", title: "Duplicate", sql: "SELECT 2;" },
              { id: "", title: "Invalid", sql: "SELECT 3;" },
              { id: "query-4", title: 4, sql: "SELECT 4;" },
            ],
          },
        },
      }),
    );

    expect(loadWorkspaceState(["sqlite"])).toEqual({
      editorHeight: 240,
      workspaces: {
        sqlite: {
          activeTabId: "query-1",
          tabs: [{ id: "query-1", title: "Query 1", sql: "SELECT 1;" }],
        },
      },
    });
  });

  it("returns null when storage access fails", () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(loadWorkspaceState(["sqlite"])).toBeNull();
  });
});

describe("saveWorkspaceState", () => {
  it("stores only serializable editor state", () => {
    const workspaces = {
      sqlite: {
        activeTabId: "query-1",
        initialized: true,
        tabs: [
          {
            id: "query-1",
            title: "Query 1",
            sql: "SELECT 1;",
            result: { columns: ["value"], values: [[1]] },
            error: "old error",
          },
        ],
      },
    };

    saveWorkspaceState({ workspaces, editorHeight: 320 });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      version: 1,
      editorHeight: 320,
      workspaces: {
        sqlite: {
          activeTabId: "query-1",
          tabs: [{ id: "query-1", title: "Query 1", sql: "SELECT 1;" }],
        },
      },
    });
  });

  it("does not break the application when storage is full", () => {
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() =>
      saveWorkspaceState({
        editorHeight: 240,
        workspaces: {
          sqlite: {
            activeTabId: "query-1",
            tabs: [{ id: "query-1", title: "Query 1", sql: "SELECT 1;" }],
          },
        },
      }),
    ).not.toThrow();
  });
});
