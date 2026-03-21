import { randomUUID } from "crypto";
import { marked } from "marked";
import { generateJSON } from "@tiptap/html";
import { JSDOM } from "jsdom";
import { tiptapExtensions } from "./tiptap-extensions.js";

export type ResolvedPageMention = {
  id: string;
  title: string;
  slugId: string;
};

export type ResolvePageMention = (
  label: string,
) => Promise<ResolvedPageMention | null>;

export type MarkdownToProseMirrorOptions = {
  creatorId?: string;
  resolvePageMention?: ResolvePageMention;
};

type MentionToken = {
  start: number;
  end: number;
  raw: string;
  label: string;
};

const EXCLUDED_PARENT_TAGS = new Set(["A", "CODE", "PRE", "SCRIPT", "STYLE"]);

function ensureDomEnvironment(dom: JSDOM) {
  if (typeof window === "undefined") {
    global.window = dom.window as unknown as typeof window;
  }
  if (typeof document === "undefined") {
    global.document = dom.window.document;
  }
  if (typeof Element === "undefined") {
    global.Element = dom.window.Element as unknown as typeof Element;
  }
}

function isAsciiWordChar(char: string) {
  return /[A-Za-z0-9_]/.test(char);
}

function isMentionBoundary(text: string, atIndex: number) {
  if (atIndex === 0) {
    return true;
  }

  return !isAsciiWordChar(text[atIndex - 1]);
}

function isPlainMentionStopChar(char: string) {
  return /\s/.test(char) || /[\\/`'".,!?;:()[\]{}<>|~^&*=+#$%，。！？；：、（）【】《》]/.test(char);
}

function extractMentionTokens(text: string): MentionToken[] {
  const tokens: MentionToken[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "@" || !isMentionBoundary(text, index)) {
      continue;
    }

    if (text[index + 1] === "[") {
      const closingIndex = text.indexOf("]", index + 2);
      if (closingIndex === -1) {
        continue;
      }

      const label = text.slice(index + 2, closingIndex).trim();
      if (!label) {
        continue;
      }

      tokens.push({
        start: index,
        end: closingIndex + 1,
        raw: text.slice(index, closingIndex + 1),
        label,
      });
      index = closingIndex;
      continue;
    }

    let end = index + 1;
    while (end < text.length && !isPlainMentionStopChar(text[end])) {
      end += 1;
    }

    const label = text.slice(index + 1, end).trim();
    if (!label) {
      continue;
    }

    tokens.push({
      start: index,
      end,
      raw: text.slice(index, end),
      label,
    });
    index = end - 1;
  }

  return tokens;
}

async function injectPageMentionsIntoHtml(
  html: string,
  resolvePageMention: ResolvePageMention,
  creatorId?: string,
) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  ensureDomEnvironment(dom);

  const { document, NodeFilter } = dom.window;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const text = node.textContent ?? "";
        if (!text.includes("@")) {
          return NodeFilter.FILTER_REJECT;
        }

        const parentTag = node.parentElement?.tagName;
        if (parentTag && EXCLUDED_PARENT_TAGS.has(parentTag)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  const labels = new Set<string>();
  const nodeTokens = new Map<Text, MentionToken[]>();
  for (const textNode of textNodes) {
    const tokens = extractMentionTokens(textNode.textContent ?? "");
    if (tokens.length === 0) {
      continue;
    }

    nodeTokens.set(textNode, tokens);
    for (const token of tokens) {
      labels.add(token.label);
    }
  }

  if (labels.size === 0) {
    return html;
  }

  const resolvedMentions = new Map<string, ResolvedPageMention | null>();
  for (const label of labels) {
    resolvedMentions.set(label, await resolvePageMention(label));
  }

  for (const [textNode, tokens] of nodeTokens.entries()) {
    const originalText = textNode.textContent ?? "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let replaced = false;

    for (const token of tokens) {
      if (token.start > cursor) {
        fragment.append(document.createTextNode(originalText.slice(cursor, token.start)));
      }

      const resolved = resolvedMentions.get(token.label);
      if (resolved) {
        const mention = document.createElement("span");
        mention.setAttribute("data-type", "mention");
        mention.setAttribute("data-id", randomUUID());
        mention.setAttribute("data-entity-type", "page");
        mention.setAttribute("data-entity-id", resolved.id);
        mention.setAttribute("data-label", resolved.title);
        mention.setAttribute("data-slug-id", resolved.slugId);
        if (creatorId) {
          mention.setAttribute("data-creator-id", creatorId);
        }
        mention.textContent = resolved.title;
        fragment.append(mention);
        replaced = true;
      } else {
        fragment.append(document.createTextNode(token.raw));
      }

      cursor = token.end;
    }

    if (cursor < originalText.length) {
      fragment.append(document.createTextNode(originalText.slice(cursor)));
    }

    if (replaced) {
      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }

  return document.body.innerHTML;
}

export async function markdownToProseMirrorJson(
  markdown: string,
  options: MarkdownToProseMirrorOptions = {},
): Promise<object> {
  const html = await marked.parse(markdown);
  const resolvedHtml = options.resolvePageMention
    ? await injectPageMentionsIntoHtml(
        html,
        options.resolvePageMention,
        options.creatorId,
      )
    : html;

  return generateJSON(resolvedHtml, tiptapExtensions);
}

export function __internal_extractMentionTokens(text: string) {
  return extractMentionTokens(text);
}
