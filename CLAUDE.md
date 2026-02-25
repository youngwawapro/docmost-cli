# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server for Docmost documentation platform. Enables AI agents to manage documentation spaces and pages through 18 tools.

## Commands

```bash
npm run build      # Compile TypeScript to build/
npm run watch      # Watch mode for development
npm run start      # Run compiled server
npm run inspector  # MCP Inspector for debugging tools
```

## Architecture

**Entry Point**: `src/index.ts` - McpServer with DocmostClient class

**Core Flow**:
1. MCP tools receive Zod-validated input
2. DocmostClient handles REST API communication with pagination
3. Page content converted bidirectionally: Markdown ↔ ProseMirror/TipTap JSON
4. Real-time updates use WebSocket (Hocuspocus) to preserve page IDs

**Key Modules**:

| Module | Purpose |
|-|-|
| `lib/collaboration.ts` | WebSocket updates via HocuspocusProvider/Yjs - preserves page ID during edits |
| `lib/markdown-converter.ts` | ProseMirror→Markdown conversion (read path) |
| `lib/auth-utils.ts` | Login (cookie extraction) + collab token fetch |
| `lib/filters.ts` | Strip API responses to essential fields for agent consumption |
| `lib/tiptap-extensions.ts` | TipTap extensions for HTML→ProseMirror (write path) |

**Content Update Flow** (`update_page`):
1. Markdown → HTML (marked)
2. HTML → ProseMirror JSON (generateJSON + tiptapExtensions)
3. ProseMirror → Y.doc (TiptapTransformer)
4. Sync via WebSocket to Docmost collaboration server

## Environment

Required: `DOCMOST_API_URL`, `DOCMOST_EMAIL`, `DOCMOST_PASSWORD`

## Notes

- `create_page` uses import API workaround (multipart/form-data) since Docmost lacks direct content creation endpoint
- Pagination via `paginateAll<T>()` handles both `data.items` and `data.data.items` response structures
- WebSocket connection kept open 15s after update for Docmost's 10s save debounce
