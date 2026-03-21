import { afterEach, describe, expect, it } from "vitest";
import { executeTool, listMcpTools, parseDocmostBearer } from "../lib/mcp-tooling.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("MCP tooling", () => {
  it("builds a snake_case tool catalog from CLI commands", () => {
    const tools = listMcpTools();

    expect(tools.length).toBeGreaterThan(50);
    expect(tools.some((tool) => tool.commandName === "commands")).toBe(false);

    const pageInfo = tools.find((tool) => tool.commandName === "page-info");
    expect(pageInfo?.toolName).toBe("page_info");
    expect((pageInfo?.inputSchema.pageId as any).safeParse({}).success).toBe(false);
  });

  it("requires output path for binary-producing commands in MCP mode", () => {
    const tools = listMcpTools();
    const pageExport = tools.find((tool) => tool.commandName === "page-export");

    expect(pageExport?.requiresOutputPath).toBe(true);
    expect(pageExport?.description).toContain("requires `output`");
    expect((pageExport?.inputSchema.output as any).safeParse(undefined).success).toBe(false);
  });

  it("maps true/false choice options to booleans", () => {
    const tools = listMcpTools();
    const shareCreate = tools.find((tool) => tool.commandName === "share-create");

    expect(shareCreate).toBeDefined();
    expect((shareCreate?.inputSchema.includeSubpages as any).safeParse(true).success).toBe(true);
    expect((shareCreate?.inputSchema.includeSubpages as any).safeParse("true").success).toBe(false);
  });

  it("returns CLI validation errors as MCP-friendly results", async () => {
    delete process.env.DOCMOST_API_URL;
    delete process.env.DOCMOST_TOKEN;
    delete process.env.DOCMOST_EMAIL;
    delete process.env.DOCMOST_PASSWORD;

    const tools = listMcpTools();
    const workspacePublic = tools.find((tool) => tool.commandName === "workspace-public");

    expect(workspacePublic).toBeDefined();

    const result = await executeTool(workspacePublic!, {});
    const parsed = result.parsed as { ok: boolean; error: { code: string; message: string } };

    expect(result.ok).toBe(false);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
    expect(parsed.error.message).toContain("API URL is required");
  });

  it("parses bearer tokens as either docmost API tokens or email/password pairs", () => {
    const tokenAuth = parseDocmostBearer("token-123", "https://docs.example.com/api");
    expect(tokenAuth).toEqual({
      apiUrl: "https://docs.example.com/api",
      token: "token-123",
    });

    const passwordAuth = parseDocmostBearer("alice@example.com:secret", "https://docs.example.com/api");
    expect(passwordAuth).toEqual({
      apiUrl: "https://docs.example.com/api",
      email: "alice@example.com",
      password: "secret",
    });
  });
});
