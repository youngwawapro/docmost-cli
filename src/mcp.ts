#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { realpathSync } from "fs";
import { pathToFileURL } from "url";
import { getVersion } from "./program.js";
import {
  executeTool,
  listMcpTools,
  parseDocmostBearer,
  type CommandExecutionResult,
  type McpToolDefinition,
} from "./lib/mcp-tooling.js";

function formatExecutionResult(tool: McpToolDefinition, result: CommandExecutionResult) {
  if (result.parsed !== undefined) {
    return JSON.stringify(result.parsed, null, 2);
  }

  if (tool.requiresOutputPath && result.outputPath) {
    return JSON.stringify(
      {
        ok: result.ok,
        data: {
          outputPath: result.outputPath,
          command: tool.commandName,
        },
        stderr: result.stderr.trim() || undefined,
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      ok: result.ok,
      stdout: result.stdout.trim() || undefined,
      stderr: result.stderr.trim() || undefined,
    },
    null,
    2,
  );
}

function createCatalogResource(tools: McpToolDefinition[]) {
  return {
    tools: tools.map((tool) => ({
      toolName: tool.toolName,
      commandName: tool.commandName,
      description: tool.description,
      requiresOutputPath: tool.requiresOutputPath,
      parameters: tool.options.map((option) => ({
        name: option.name,
        flag: option.long,
        description: option.description,
        required: option.required,
      })),
    })),
  };
}

export function createMcpServer() {
  const tools = listMcpTools();
  const server = new McpServer(
    {
      name: "docmost-mcp",
      version: getVersion(),
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  const catalog = createCatalogResource(tools);

  server.registerResource(
    "docmost-tool-catalog",
    "docmost://commands",
    {
      title: "Docmost tool catalog",
      description: "A read-only catalog of Docmost MCP tools and their underlying CLI commands.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "docmost://commands",
          mimeType: "application/json",
          text: JSON.stringify(catalog, null, 2),
        },
      ],
    }),
  );

  for (const tool of tools) {
    server.registerTool(
      tool.toolName,
      {
        title: tool.toolName,
        description: `${tool.description} (CLI: ${tool.commandName})`,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (args, extra) => {
        const auth = resolveToolAuthContext(extra?.requestInfo?.headers);
        const result = await executeTool(tool, args as Record<string, unknown>, auth);

        return {
          content: [
            {
              type: "text",
              text: formatExecutionResult(tool, result),
            },
          ],
          isError: !result.ok,
        };
      },
    );
  }

  return server;
}

export function resolveToolAuthContext(
  headers: Record<string, string | string[] | undefined> | undefined,
) {
  const authHeader = getAuthorizationHeader(headers);
  if (authHeader) {
    return parseDocmostBearer(extractBearerToken(authHeader));
  }

  // Local stdio MCP calls do not provide request headers. In that case we
  // intentionally fall back to DOCMOST_* env vars so local client configs work.
  if (!headers) {
    return undefined;
  }

  throw new Error("Authorization header is required for remote Docmost tool calls.");
}

function getAuthorizationHeader(headers: Record<string, string | string[] | undefined> | undefined) {
  if (!headers) {
    return undefined;
  }

  const value = headers.authorization ?? headers.Authorization;
  return Array.isArray(value) ? value[0] : value;
}

function extractBearerToken(headerValue: string | undefined) {
  if (!headerValue) {
    return undefined;
  }

  const trimmed = headerValue.trim();
  const prefix = "Bearer ";
  return trimmed.toLowerCase().startsWith(prefix.toLowerCase())
    ? trimmed.slice(prefix.length).trim()
    : trimmed;
}

function createHttpApp() {
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.get("/healthz", (_req: unknown, res: any) => {
    res.json({ ok: true, service: "docmost-mcp", version: getVersion() });
  });

  app.post("/mcp", async (req: any, res: any) => {
    const server = createMcpServer();

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message,
          },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_req: unknown, res: any) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
  });

  app.delete("/mcp", (_req: unknown, res: any) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
  });

  return app;
}

async function main() {
  const mode = process.argv[2] || "stdio";

  if (mode === "http") {
    const port = Number(process.env.PORT || "8000");
    const app = createHttpApp();
    app.listen(port, "0.0.0.0", () => {
      console.error(`Docmost MCP HTTP server listening on port ${port}`);
    });
    return;
  }

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isDirectExecution() {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(realpathSync(entrypoint)).href;
  } catch {
    return import.meta.url === pathToFileURL(entrypoint).href;
  }
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Docmost MCP server error: ${message}`);
    process.exit(1);
  });
}
