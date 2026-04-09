[![CI](https://github.com/dapi/docmost-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/dapi/docmost-cli/actions/workflows/ci.yml)

# Docmost CLI + MCP Server

A Docmost CLI plus standard stdio and HTTP Model Context Protocol (MCP) servers for [Docmost](https://docmost.com/), enabling AI agents to search, create, modify, and organize documentation pages and spaces.

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
npm install -g fantsec-docmost-cli
```

### From source

```bash
git clone https://github.com/youngwawapro/docmost-cli.git
cd docmost-cli
npm install
npm run build
```

## Configuration

The CLI and MCP server use the same environment variables:

- `DOCMOST_API_URL`: The full URL to your Docmost API (e.g., `https://docs.example.com/api`).
- `DOCMOST_EMAIL`: The email address for authentication.
- `DOCMOST_PASSWORD`: The password for authentication.

For remote HTTP MCP mode, set `DOCMOST_API_URL` on the server and send user credentials in the bearer token:

- `Authorization: Bearer <docmost-api-token>`
- `Authorization: Bearer <email>:<password>`

## Usage with Codex / MCP Clients

### Codex

Add the server directly with `codex mcp add`:

```bash
codex mcp add docmost \
  --env DOCMOST_API_URL=http://localhost:3000/api \
  --env DOCMOST_EMAIL=test@docmost.com \
  --env DOCMOST_PASSWORD=test \
  -- npx -y -p fantsec-docmost-cli docmost-mcp
```

### Generic MCP config

If your MCP client uses a JSON config file, point it at the dedicated `docmost-mcp` executable:

#### Using `npx`

```json
{
  "mcpServers": {
    "docmost": {
      "command": "npx",
      "args": ["-y", "-p", "fantsec-docmost-cli", "docmost-mcp"],
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

# Start HTTP MCP server
npm run start:mcp:http
```

## Release

This repository now supports CI-driven release for both distribution modes:

- `npm` package publish for `fantsec-docmost-cli`
- HTTP MCP container image publish to `ghcr.io/<owner>/<repo>`

### Release trigger

Push a version tag:

```bash
git tag v2.2.3
git push origin v2.2.3
```

### What CI does

- runs build + unit tests
- starts the local Docmost test stack and runs integration tests
- publishes the npm package
- builds and pushes the HTTP MCP Docker image

### Required GitHub secrets

- `NPM_TOKEN`: npm publish token for `fantsec-docmost-cli`

### HTTP MCP image

The release workflow publishes:

```bash
ghcr.io/youngwawapro/docmost-cli:<tag>
ghcr.io/youngwawapro/docmost-cli:latest
```

Example run:

```bash
docker run --rm -p 8000:8000 \
  -e DOCMOST_API_URL=https://docs.example.com/api \
  ghcr.io/youngwawapro/docmost-cli:latest
```

## License

MIT
