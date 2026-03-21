import { describe, expect, it } from "vitest";
import {
  __internal_extractMentionTokens,
  markdownToProseMirrorJson,
} from "../lib/page-mentions.js";

describe("page mention markdown conversion", () => {
  it("extracts plain and bracketed mention tokens", () => {
    expect(__internal_extractMentionTokens("参考@通信合同文档 和 @[接口 与 协议 总览]")).toEqual([
      {
        start: 2,
        end: 9,
        raw: "@通信合同文档",
        label: "通信合同文档",
      },
      {
        start: 12,
        end: 25,
        raw: "@[接口 与 协议 总览]",
        label: "接口 与 协议 总览",
      },
    ]);
  });

  it("converts resolved page mentions into mention nodes", async () => {
    const doc = await markdownToProseMirrorJson("参考@通信合同文档", {
      creatorId: "user-1",
      resolvePageMention: async (label) => ({
        id: "page-1",
        title: label,
        slugId: "slug-1",
      }),
    });

    const paragraph = (doc as any).content[0];
    expect(paragraph.content[0]).toEqual({ type: "text", text: "参考" });
    expect(paragraph.content[1]).toEqual({
      type: "mention",
      attrs: {
        id: expect.any(String),
        label: "通信合同文档",
        entityType: "page",
        entityId: "page-1",
        slugId: "slug-1",
        creatorId: "user-1",
        anchorId: null,
      },
    });
  });

  it("keeps unresolved mentions as plain text", async () => {
    const doc = await markdownToProseMirrorJson("参考@通信合同文档", {
      resolvePageMention: async () => null,
    });

    expect((doc as any).content[0].content[0].text).toBe("参考@通信合同文档");
  });

  it("does not convert mentions inside code or links", async () => {
    const doc = await markdownToProseMirrorJson(
      "`@通信合同文档` [跳转](https://example.com/@通信合同文档) 正文@通信合同文档",
      {
        resolvePageMention: async (label) => ({
          id: "page-1",
          title: label,
          slugId: "slug-1",
        }),
      },
    );

    const paragraph = (doc as any).content[0].content;
    expect(paragraph.some((node: any) => node.type === "mention")).toBe(true);
    expect(paragraph[0].type).toBe("text");
    expect(paragraph[0].marks?.[0]?.type).toBe("code");
    const linkNode = paragraph.find((node: any) => node.text === "跳转");
    expect(linkNode.marks?.[0]?.type).toBe("link");
  });
});
