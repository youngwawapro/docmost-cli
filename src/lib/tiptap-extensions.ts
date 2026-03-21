import { mergeAttributes, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-id"),
        renderHTML: (attributes: Record<string, string | null>) =>
          attributes.id ? { "data-id": attributes.id } : {},
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-label"),
        renderHTML: (attributes: Record<string, string | null>) =>
          attributes.label ? { "data-label": attributes.label } : {},
      },
      entityType: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-entity-type"),
        renderHTML: (attributes: Record<string, string | null>) =>
          attributes.entityType ? { "data-entity-type": attributes.entityType } : {},
      },
      entityId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-entity-id"),
        renderHTML: (attributes: Record<string, string | null>) =>
          attributes.entityId ? { "data-entity-id": attributes.entityId } : {},
      },
      slugId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-slug-id"),
        renderHTML: (attributes: Record<string, string | null>) =>
          attributes.slugId ? { "data-slug-id": attributes.slugId } : {},
      },
      creatorId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-creator-id"),
        renderHTML: (attributes: Record<string, string | null>) =>
          attributes.creatorId ? { "data-creator-id": attributes.creatorId } : {},
      },
      anchorId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-anchor-id"),
        renderHTML: (attributes: Record<string, string | null>) =>
          attributes.anchorId ? { "data-anchor-id": attributes.anchorId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ "data-type": "mention" }, HTMLAttributes),
      node.attrs.label ?? node.attrs.entityId ?? "",
    ];
  },
});

// Define extensions compatible with standard Markdown features
// We use the default Tiptap extensions to handle basic content
export const tiptapExtensions = [
  StarterKit.configure({
    // Explicitly enable features that might be disabled in some contexts
    codeBlock: {},
    heading: {},
  }),
  Image.configure({
    inline: true,
  }),
  Link.configure({
    openOnClick: false,
  }),
  Mention,
  Table.configure({
    resizable: false,
  }),
  TableRow,
  TableCell,
  TableHeader,
];
