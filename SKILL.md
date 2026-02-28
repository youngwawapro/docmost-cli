---
name: docmost
description: >
  Use when user wants to create/read/update/delete pages in Docmost via docmost CLI,
  search documentation content, list/organize spaces, view page history, restore from trash.
  Trigger on requests about documentation pages, knowledge base, wiki, spaces, page content,
  Docmost workspace, page versions, page hierarchy.
---

# docmost

Docmost CLI skill for AI agents.

## Install

Install this skill from GitHub:

```bash
npx skills add dapi/docmost-cli --skill docmost --agent '*' -g -y
```

Install CLI:

```bash
npm install -g github:dapi/docmost-cli
```

Set environment variables:

```bash
export DOCMOST_API_URL=http://your-instance/api
export DOCMOST_TOKEN=<token>
# or use email/password:
export DOCMOST_EMAIL=<email>
export DOCMOST_PASSWORD=<password>
```
