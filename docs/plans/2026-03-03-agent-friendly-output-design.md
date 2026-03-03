# Agent-Friendly Output Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all JSON output predictable for AI agents via envelope format, pagination metadata, mutation confirmations, and discovery command.

**Architecture:** Centralize envelope wrapping in `printResult`/`printError`. Change `paginateAll` to return `{ items, hasMore }`. All command files pass data through — envelope is applied at output layer only. New `commands` command introspects Commander tree.

**Tech Stack:** TypeScript, Commander.js, Node.js

---

### Task 1: Envelope types and printResult/printError refactor

**Files:**
- Modify: `src/lib/cli-utils.ts`

**Step 1: Add envelope types**

Add after `GlobalOptions` type (~line 22):

```typescript
export type SuccessEnvelope<T = unknown> = {
  ok: true;
  data: T;
  meta?: { count: number; hasMore: boolean };
};

export type ErrorEnvelope = {
  ok: false;
  error: { code: CliErrorCode; message: string; details?: unknown };
};
```

**Step 2: Refactor `printResult` to wrap in envelope**

Replace `printResult` function. For JSON format: if data is array, wrap as `{ ok: true, data, meta: { count, hasMore } }`. If object, wrap as `{ ok: true, data }`. Table/text unchanged.

Add `hasMore` to `PrintOptions`:

```typescript
export type PrintOptions = {
  allowTable?: boolean;
  textExtractor?: (result: unknown) => string | undefined;
  hasMore?: boolean;  // for list commands
};
```

New `printResult` JSON branch:

```typescript
if (output === "json") {
  if (Array.isArray(data)) {
    const envelope: SuccessEnvelope = {
      ok: true,
      data,
      meta: { count: data.length, hasMore: options.hasMore ?? false },
    };
    console.log(JSON.stringify(envelope, null, 2));
  } else {
    const envelope: SuccessEnvelope = { ok: true, data };
    console.log(JSON.stringify(envelope, null, 2));
  }
  return;
}
```

**Step 3: Refactor `printError` to use envelope**

```typescript
export function printError(error: CliError, output: OutputFormat) {
  const envelope: ErrorEnvelope = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
  if (output === "json") {
    console.error(JSON.stringify(envelope, null, 2));
  } else {
    console.error(`Error [${error.code}]: ${error.message}`);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  }
}
```

**Step 4: Build and verify**

Run: `npm run build`
Expected: No compilation errors.

**Step 5: Commit**

```
feat: add envelope format to JSON output

All JSON responses now wrapped in { ok, data } or { ok, error }.
Lists include meta: { count, hasMore }.
```

---

### Task 2: paginateAll returns metadata

**Files:**
- Modify: `src/client.ts`

**Step 1: Change paginateAll return type**

Change signature and return type:

```typescript
export type PaginatedResult<T> = { items: T[]; hasMore: boolean };

async paginateAll<T = unknown>(
  endpoint: string,
  basePayload: Record<string, unknown> = {},
  limit: number = 100,
  maxItems: number = Infinity,
): Promise<PaginatedResult<T>> {
```

Track `hasMore` from last iteration. Return `{ items: allItems, hasMore }` instead of bare array.

Key change at end of method:

```typescript
const finalItems = maxItems < Infinity ? allItems.slice(0, maxItems) : allItems;
// hasMore is true if we stopped because of maxItems OR if API says more pages exist
const resultHasMore = (maxItems < Infinity && allItems.length > maxItems) || hasNextPage;
return { items: finalItems, hasMore: resultHasMore };
```

**Step 2: Update all 13 callers of paginateAll in client.ts**

Each caller changes from:
```typescript
const items = await this.paginateAll("/endpoint", payload);
return items.map(filterFn);
```
To:
```typescript
const result = await this.paginateAll("/endpoint", payload);
return { items: result.items.map(filterFn), hasMore: result.hasMore };
```

Full list of callers (13 total):
1. `getSpaces()` — line 150
2. `getGroups()` — line 155
3. `listPages()` — line 161
4. `getPageHistory()` — line 385
5. `getTrash()` — line 408
6. `getSpaceMembers()` — line 460
7. `getMembers()` — line 502
8. `getInvites()` — line 521
9. `getGroupMembers()` — line 600
10. `getComments()` — line 633
11. `getShares()` — line 674
12. `search()` — find in client
13. `searchSuggest()` — uses client.post, not paginateAll (skip)

Note: `getSpaceMembers()` and `getGroupMembers()` return raw items without filter — add filter or pass through as-is.

**Step 3: Build and verify**

Run: `npm run build`
Expected: Compilation errors in command files (they now receive `{ items, hasMore }` instead of arrays). This is expected and fixed in Task 3.

**Step 4: Commit**

```
refactor: paginateAll returns { items, hasMore } metadata
```

---

### Task 3: Update all command files for new data shapes

**Files:**
- Modify: `src/commands/page.ts`
- Modify: `src/commands/space.ts`
- Modify: `src/commands/workspace.ts`
- Modify: `src/commands/invite.ts`
- Modify: `src/commands/user.ts`
- Modify: `src/commands/group.ts`
- Modify: `src/commands/comment.ts`
- Modify: `src/commands/share.ts`
- Modify: `src/commands/search.ts`
- Modify: `src/commands/file.ts`

**Step 1: Update list commands to destructure and pass hasMore**

Pattern for every list command. Before:
```typescript
const result = await client.listPages(options.spaceId);
printResult(result, opts, { allowTable: true });
```

After:
```typescript
const result = await client.listPages(options.spaceId);
printResult(result.items, opts, { allowTable: true, hasMore: result.hasMore });
```

Apply to all list commands:
- `page-list`: `client.listPages()`
- `page-trash`: `client.getTrash()`
- `page-history`: `client.getPageHistory()`
- `page-breadcrumbs`: `client.getPageBreadcrumbs()` — returns array, no paginateAll, no change
- `page-tree`: `client.getPageTree()` — returns array, no paginateAll, no change
- `space-list`: `client.getSpaces()`
- `space-member-list`: `client.getSpaceMembers()`
- `member-list`: `client.getMembers()`
- `invite-list`: `client.getInvites()`
- `group-list`: `client.getGroups()`
- `group-member-list`: `client.getGroupMembers()`
- `comment-list`: `client.getComments()`
- `share-list`: `client.getShares()`
- `search`: `client.search()`

**Step 2: Unwrap single-object responses that use `{ data, success }` pattern**

Some client methods return `{ data: {...}, success: true }`. These need to pass just `.data` to printResult:
- `workspace-info`: `client.getWorkspace()` returns `{ data, success }` → `printResult(result.data, opts, ...)`
- `page-info`: `client.getPage()` returns `{ data, success }` → `printResult(result.data, opts, ...)`

Fix textExtractor for page-info accordingly (no longer nested).

**Step 3: Build and verify**

Run: `npm run build`
Expected: No compilation errors.

**Step 4: Commit**

```
refactor: update all commands for envelope-compatible data shapes
```

---

### Task 4: Discovery command

**Files:**
- Create: `src/commands/discovery.ts`
- Modify: `src/index.ts`

**Step 1: Create discovery command**

```typescript
import { Command } from "commander";

export function register(program: Command) {
  program
    .command("commands")
    .description("List all available commands with options (for agent discovery)")
    .action(() => {
      const commands = program.commands
        .filter((cmd) => cmd.name() !== "commands")
        .map((cmd) => ({
          name: cmd.name(),
          description: cmd.description(),
          options: cmd.options.map((opt) => ({
            flags: opt.flags,
            description: opt.description,
            required: opt.required || false,
            ...(opt.defaultValue !== undefined && { default: opt.defaultValue }),
          })),
        }));

      const envelope = { ok: true, data: commands, meta: { count: commands.length, hasMore: false } };
      console.log(JSON.stringify(envelope, null, 2));
    });
}
```

**Step 2: Register in index.ts**

Add import and register call after other registrations:
```typescript
import { register as registerDiscoveryCommands } from "./commands/discovery.js";
// ... after other registers:
registerDiscoveryCommands(program);
```

**Step 3: Build and verify**

Run: `npm run build && node build/index.js commands | head -20`
Expected: JSON with `ok: true` and command list.

**Step 4: Commit**

```
feat: add 'commands' discovery command for agent introspection
```

---

### Task 5: Update SKILL.md

**Files:**
- Modify: `SKILL.md`

**Step 1: Add Output Format section after Execution Rules**

Add new section describing the envelope:

```markdown
## Output Format

All `--format json` responses use a predictable envelope:

### Success (single object)
\`\`\`json
{ "ok": true, "data": { "id": "abc", "title": "Runbook" } }
\`\`\`

### Success (list)
\`\`\`json
{ "ok": true, "data": [{ "id": "abc" }], "meta": { "count": 2, "hasMore": false } }
\`\`\`

### Error
\`\`\`json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "Page not found", "details": null } }
\`\`\`

### Parsing rules for agents
- Always check `ok` field first
- For lists: items in `data` array, check `meta.hasMore` for pagination
- For mutations: created/updated object returned in `data`
- Errors include typed `code`: AUTH_ERROR, NOT_FOUND, VALIDATION_ERROR, NETWORK_ERROR, INTERNAL_ERROR
- Use `docmost commands` to discover all available commands and their options
```

**Step 2: Add `commands` to Core Command Patterns**

```markdown
### Discovery

\`\`\`bash
docmost commands  # list all commands with options as JSON
\`\`\`
```

**Step 3: Update Agent Workflows parsing examples**

Update Page CRUD workflow step 5 (verify) to show envelope parsing:
```markdown
5. Verify (check `ok` field):
   - `docmost page-info --page-id <pageId> --format json`
   - Response: `{ "ok": true, "data": { "id": "...", "title": "..." } }`
```

**Step 4: Update Execution Rules**

Change rule about `--format json`:
```markdown
- All `--format json` output wrapped in envelope: `{ "ok": true, "data": ... }` for success, `{ "ok": false, "error": ... }` for errors.
```

**Step 5: Commit**

```
docs: update SKILL.md with envelope format documentation
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update Output Formats line**

Change:
```
**Output Formats**: `json` (default), `table` (list commands), `text` (content commands)
```
To:
```
**Output Formats**: `json` (default, envelope `{ ok, data/error }`), `table` (list commands), `text` (content commands)
```

**Step 2: Commit**

```
docs: note envelope format in CLAUDE.md
```

---

### Task 7: Build, smoke test, verify

**Step 1: Full build**

Run: `npm run build`
Expected: Clean compilation.

**Step 2: Smoke test commands (requires DOCMOST env vars)**

```bash
# Discovery
node build/index.js commands | jq '.ok'
# Expected: true

# List with envelope
node build/index.js space-list --format json | jq '.ok, .meta'
# Expected: true, { "count": N, "hasMore": false }

# Error envelope
node build/index.js page-info --page-id nonexistent --format json 2>&1 | jq '.ok'
# Expected: false

# Table format unchanged
node build/index.js space-list --format table
# Expected: console.table output as before
```

**Step 3: Final commit if any fixes needed**
