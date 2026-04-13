import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
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

  it("adds cwd only for MCP tools that resolve local filesystem paths", () => {
    const tools = listMcpTools();
    const pageUpdate = tools.find((tool) => tool.commandName === "page-update");
    const fileUpload = tools.find((tool) => tool.commandName === "file-upload");
    const workspaceInfo = tools.find((tool) => tool.commandName === "workspace-info");

    expect(pageUpdate).toBeDefined();
    expect(fileUpload).toBeDefined();
    expect(workspaceInfo).toBeDefined();
    expect((pageUpdate?.inputSchema.cwd as any).safeParse("/tmp").success).toBe(true);
    expect((fileUpload?.inputSchema.cwd as any).safeParse("/tmp").success).toBe(true);
    expect(workspaceInfo?.inputSchema.cwd).toBeUndefined();
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

  it("uses cwd to resolve @file content in local stdio MCP mode", async () => {
    process.env.DOCMOST_API_URL = "http://127.0.0.1:1/api";
    process.env.DOCMOST_TOKEN = "token-123";

    const tempDir = mkdtempSync(join(tmpdir(), "docmost-mcp-"));
    const contentPath = join(tempDir, "note.md");
    writeFileSync(contentPath, "# hello from cwd test\n", "utf-8");

    try {
      const tools = listMcpTools();
      const commentUpdate = tools.find((tool) => tool.commandName === "comment-update");

      expect(commentUpdate).toBeDefined();

      const withoutCwd = await executeTool(commentUpdate!, {
        commentId: "comment-1",
        content: "@note.md",
      });
      const withoutCwdParsed = withoutCwd.parsed as { error: { message: string } };
      expect(withoutCwd.ok).toBe(false);
      expect(withoutCwdParsed.error.message).toContain("Cannot read file 'note.md'");

      const withCwd = await executeTool(commentUpdate!, {
        commentId: "comment-1",
        content: "@note.md",
        cwd: tempDir,
      });
      const withCwdParsed = withCwd.parsed as { error: { message: string } };
      expect(withCwd.ok).toBe(false);
      expect(withCwdParsed.error.message).not.toContain("Cannot read file 'note.md'");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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
