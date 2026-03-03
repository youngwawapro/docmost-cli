import { describe, it, expect, vi, beforeEach } from "vitest";

// Must mock console before importing the module
const mockLog = vi.fn();
const mockError = vi.fn();
vi.stubGlobal("console", { ...console, log: mockLog, error: mockError, table: console.table });

const { printResult, printError, CliError } = await import("../lib/cli-utils.js");

describe("printResult envelope", () => {
  const baseOpts = {
    apiUrl: "http://localhost",
    format: "json" as const,
    quiet: false,
    limit: 100,
    maxItems: Infinity,
    auth: { token: "test" },
  };

  beforeEach(() => {
    mockLog.mockClear();
    mockError.mockClear();
  });

  it("wraps single object in { ok: true, data }", () => {
    const data = { id: "abc", title: "Test" };
    printResult(data, baseOpts);

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toEqual({ ok: true, data: { id: "abc", title: "Test" } });
    expect(output.meta).toBeUndefined();
  });

  it("wraps array in { ok: true, data, meta }", () => {
    const data = [{ id: "1" }, { id: "2" }];
    printResult(data, baseOpts, { allowTable: true });

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output.ok).toBe(true);
    expect(output.data).toHaveLength(2);
    expect(output.meta).toEqual({ count: 2, hasMore: false });
  });

  it("passes hasMore from options to meta", () => {
    const data = [{ id: "1" }];
    printResult(data, baseOpts, { allowTable: true, hasMore: true });

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output.meta).toEqual({ count: 1, hasMore: true });
  });

  it("wraps empty array with meta count 0", () => {
    printResult([], baseOpts, { allowTable: true });

    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toEqual({ ok: true, data: [], meta: { count: 0, hasMore: false } });
  });

  it("does not output when quiet", () => {
    printResult({ id: "1" }, { ...baseOpts, quiet: true });
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("table format is not wrapped in envelope", () => {
    const data = [{ id: "1", name: "Test" }];
    printResult(data, { ...baseOpts, format: "table" }, { allowTable: true });

    // table uses console.table, not console.log with JSON
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("text format is not wrapped in envelope", () => {
    const mockWrite = vi.fn();
    const original = process.stdout.write;
    process.stdout.write = mockWrite as any;

    printResult("hello", { ...baseOpts, format: "text" }, {
      textExtractor: (d) => d as string,
    });

    process.stdout.write = original;
    expect(mockLog).not.toHaveBeenCalled();
    expect(mockWrite.mock.calls[0][0]).toBe("hello");
  });
});

describe("printError envelope", () => {
  beforeEach(() => {
    mockLog.mockClear();
    mockError.mockClear();
  });

  it("wraps error in { ok: false, error } for json format", () => {
    const error = new CliError("NOT_FOUND", "Page not found", { pageId: "abc" });
    printError(error, "json");

    const output = JSON.parse(mockError.mock.calls[0][0]);
    expect(output).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Page not found",
        details: { pageId: "abc" },
      },
    });
  });

  it("uses plain text for non-json format", () => {
    const error = new CliError("AUTH_ERROR", "Unauthorized");
    printError(error, "text");

    expect(mockError.mock.calls[0][0]).toBe("Error [AUTH_ERROR]: Unauthorized");
  });
});
