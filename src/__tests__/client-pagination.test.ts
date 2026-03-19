import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();
const createMock = vi.fn(() => ({
  post: postMock,
  defaults: {
    headers: {
      common: {},
    },
  },
}));

vi.mock("axios", () => {
  const axiosDefault = {
    create: createMock,
    isAxiosError: () => false,
  };

  return {
    default: axiosDefault,
    create: createMock,
    AxiosError: class AxiosError extends Error {},
    AxiosHeaders: class AxiosHeaders {},
  };
});

const { DocmostClient } = await import("../client.js");

describe("DocmostClient paginateAll", () => {
  beforeEach(() => {
    postMock.mockReset();
    createMock.mockClear();
  });

  it("uses nextCursor when the API returns cursor pagination metadata", async () => {
    postMock
      .mockResolvedValueOnce({
        data: {
          data: {
            items: [{ id: "1" }, { id: "2" }],
            meta: {
              hasNextPage: true,
              nextCursor: "cursor-1",
              prevCursor: null,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            items: [{ id: "3" }],
            meta: {
              hasNextPage: false,
              nextCursor: null,
              prevCursor: "cursor-1",
            },
          },
        },
      });

    const client = new DocmostClient("https://example.test", { token: "token" });
    const result = await client.paginateAll("/pages/recent", { spaceId: "space-1" }, 2);

    expect(postMock).toHaveBeenNthCalledWith(1, "/pages/recent", {
      spaceId: "space-1",
      limit: 2,
      page: 1,
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/pages/recent", {
      spaceId: "space-1",
      limit: 2,
      cursor: "cursor-1",
    });
    expect(result).toEqual({
      items: [{ id: "1" }, { id: "2" }, { id: "3" }],
      hasMore: false,
    });
  });

  it("fails fast when cursor pagination starts looping", async () => {
    postMock
      .mockResolvedValueOnce({
        data: {
          data: {
            items: [{ id: "1" }],
            meta: {
              hasNextPage: true,
              nextCursor: "cursor-1",
              prevCursor: null,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            items: [{ id: "2" }],
            meta: {
              hasNextPage: true,
              nextCursor: "cursor-1",
              prevCursor: "cursor-1",
            },
          },
        },
      });

    const client = new DocmostClient("https://example.test", { token: "token" });

    await expect(client.paginateAll("/pages/recent", {}, 1)).rejects.toThrow(
      "Pagination loop detected for /pages/recent: repeated cursor:cursor-1",
    );
  });
});
