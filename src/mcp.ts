#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "url";
import { getVersion } from "./program.js";
import { executeTool, listMcpTools, type CommandExecutionResult, type McpToolDefinition } from "./lib/mcp-tooling.js";

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
      async (args) => {
        const result = await executeTool(tool, args as Record<string, unknown>);

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

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Docmost MCP server error: ${message}`);
    process.exit(1);
  });
}
