import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveToolAuthContext } from "../mcp.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    DOCMOST_API_URL: "https://docs.example.com/api",
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("docmost MCP auth resolution", () => {
  it("falls back to env auth for local stdio calls without request headers", () => {
    expect(resolveToolAuthContext(undefined)).toBeUndefined();
  });

  it("parses bearer token headers for remote calls", () => {
    expect(
      resolveToolAuthContext({
        authorization: "Bearer token-123",
      }),
    ).toEqual({
      apiUrl: process.env.DOCMOST_API_URL,
      token: "token-123",
    });
  });

  it("rejects remote calls that omit authorization headers", () => {
    expect(() => resolveToolAuthContext({})).toThrow(
      "Authorization header is required for remote Docmost tool calls.",
    );
  });
});
