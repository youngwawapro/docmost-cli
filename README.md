[![CI](https://github.com/dapi/docmost-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/dapi/docmost-cli/actions/workflows/ci.yml)

# Docmost CLI + MCP Server

A Docmost CLI plus a standard stdio Model Context Protocol (MCP) server for [Docmost](https://docmost.com/), enabling AI agents to search, create, modify, and organize documentation pages and spaces.

## Features

### Core Management

- **`create_page`**: Smart creation tool. Creates content (via import) AND handles hierarchy (nesting under a parent) in one go.
- **`update_page`**: Update a page's content and/or title. Updates are performed via real-time collaboration (WebSocket).
- **`delete_page` / `delete_pages`**: Delete single or multiple pages at once.
- **`move_page`**: Organize pages hierarchically by moving them to a new parent or root.

### Exploration & Retrieval

- **`search`**: Full-text search across spaces with optional space filtering (`query`, `spaceId`).
- **`get_workspace`**: Get information about the current Docmost workspace.
- **`list_spaces`**: View all spaces within the current workspace.
- **`list_groups`**: View all groups within the current workspace.
- **`list_pages`**: List pages within a space (ordered by `updatedAt` descending).
- **`get_page`**: Retrieve full content and metadata of a specific page.

### Technical Details

- **Standard MCP over stdio**: Ships a dedicated `docmost-mcp` executable for Codex, Claude Desktop, and other MCP clients.
- **Automatic tool generation**: Every supported CLI command is exposed as an MCP tool with JSON schema derived from Commander options.
- **Automatic Markdown Conversion**: Page content is automatically converted from Docmost's internal ProseMirror/TipTap JSON format to clean Markdown for easy agent consumption. Supports all Docmost extensions including callouts, task lists, math blocks, embeds, and more.
- **Smart Import API**: Uses Docmost's import API to ensure clean Markdown-to-ProseMirror conversion when creating pages.
- **Child Preservation**: The `update_page` tool creates a new page ID but effectively simulates an in-place update by reparenting existing child pages to the new version.
- **Pagination Support**: Automatically handles pagination for large datasets (spaces, pages, groups).
- **Filtered Responses**: API responses are filtered to include only relevant information, optimizing data transfer for agents.

## Installation

### From npm (recommended)

```bash
npm install -g @dapi/docmost-cli
```

### From source

```bash
git clone https://github.com/dapi/docmost-cli.git
cd docmost-cli
npm install
npm run build
```

## Configuration

The CLI and MCP server use the same environment variables:

- `DOCMOST_API_URL`: The full URL to your Docmost API (e.g., `https://docs.example.com/api`).
- `DOCMOST_EMAIL`: The email address for authentication.
- `DOCMOST_PASSWORD`: The password for authentication.

## Usage with Codex / MCP Clients

### Codex

Add the server directly with `codex mcp add`:

```bash
codex mcp add docmost \
  --env DOCMOST_API_URL=http://localhost:3000/api \
  --env DOCMOST_EMAIL=test@docmost.com \
  --env DOCMOST_PASSWORD=test \
  -- npx -y -p @dapi/docmost-cli docmost-mcp
```

### Generic MCP config

If your MCP client uses a JSON config file, point it at the dedicated `docmost-mcp` executable:

#### Using `npx`

```json
{
  "mcpServers": {
    "docmost": {
      "command": "npx",
      "args": ["-y", "-p", "@dapi/docmost-cli", "docmost-mcp"],
      "env": {
        "DOCMOST_API_URL": "http://localhost:3000/api",
        "DOCMOST_EMAIL": "test@docmost.com",
        "DOCMOST_PASSWORD": "test"
      }
    }
  }
}
```

#### Using local build

```json
{
  "mcpServers": {
    "docmost": {
      "command": "node",
      "args": ["./build/mcp.js"],
      "env": {
        "DOCMOST_API_URL": "http://localhost:3000/api",
        "DOCMOST_EMAIL": "test@docmost.com",
        "DOCMOST_PASSWORD": "test"
      }
    }
  }
}
```

## Development

```bash
# Watch mode
npm run watch

# Build
npm run build

# Start stdio MCP server
npm run start:mcp
```

## License

MIT
