# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLI tool for Docmost documentation platform. Provides 17 commands for managing spaces, pages, and content from the terminal.

## Commands

```bash
npm run build      # Compile TypeScript to build/
npm run watch      # Watch mode for development
npm run start      # Run compiled CLI
```

## Architecture

**Entry Point**: `src/index.ts` - Commander.js CLI with global options, error handling, output formatting

**Client**: `src/client.ts` - DocmostClient class handling REST API communication

**Core Flow**:
1. Commander parses CLI args, resolves global options (auth, output format)
2. `withClient` creates DocmostClient with resolved auth
3. DocmostClient handles REST API calls with pagination
4. Page content converted bidirectionally: Markdown ↔ ProseMirror/TipTap JSON
5. Real-time updates use WebSocket (Hocuspocus) to preserve page IDs

**Key Modules**:

| Module | Purpose |
|-|-|
| `src/client.ts` | DocmostClient - REST API client with pagination, CRUD operations |
| `src/index.ts` | CLI entrypoint - Commander commands, error handling, output formatting |
| `lib/collaboration.ts` | WebSocket updates via HocuspocusProvider/Yjs - preserves page ID during edits |
| `lib/markdown-converter.ts` | ProseMirror→Markdown conversion (read path) |
| `lib/auth-utils.ts` | Login (cookie extraction) + collab token fetch |
| `lib/filters.ts` | Strip API responses to essential fields |
| `lib/tiptap-extensions.ts` | TipTap extensions for HTML→ProseMirror (write path) |

**Error Handling**:
- `CliError` class with typed codes: AUTH_ERROR(2), NOT_FOUND(3), VALIDATION_ERROR(4), NETWORK_ERROR(5), INTERNAL_ERROR(1)
- `normalizeError` maps CommanderError/AxiosError → CliError
- Output: JSON `{ error: { code, message, details } }` or plain text

**Output Formats**: `json` (default), `table` (list commands), `text` (content commands)

**Content Update Flow** (`update-page`):
1. Markdown → HTML (marked)
2. HTML → ProseMirror JSON (generateJSON + tiptapExtensions)
3. ProseMirror → Y.doc (TiptapTransformer)
4. Sync via WebSocket to Docmost collaboration server

## Environment

Required: `DOCMOST_API_URL` + (`DOCMOST_TOKEN` or `DOCMOST_EMAIL`/`DOCMOST_PASSWORD`)

## Notes

- `create-page` uses import API workaround (multipart/form-data) since Docmost lacks direct content creation endpoint
- Pagination via `paginateAll<T>()` handles both `data.items` and `data.data.items` response structures
- WebSocket connection kept open 15s after update for Docmost's 10s save debounce
- Auth precedence: token > email/password, CLI args > env vars
