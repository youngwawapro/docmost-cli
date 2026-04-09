import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("page commands", () => {
  let spaceId: string;
  let pageId: string;
  let pageUrl: string;

  beforeAll(async () => {
    const result = await runCli(
      ["space-create", "--name", `pagespace${Date.now()}`, "--slug", `ps${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(result).data.id;
  });

  it("page-create creates a page", async () => {
    const result = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "Test Page"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    pageId = envelope.data.id;
  });

  it("page-list returns pages in space", async () => {
    const result = await runCli(
      ["page-list", "--space-id", spaceId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThanOrEqual(1);
  });

  it("page-info returns page details", async () => {
    const result = await runCli(
      ["page-info", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(pageId);
    expect(envelope.data.slugId).toBeTruthy();
    expect(envelope.data.spaceSlug).toBeTruthy();
    expect(envelope.data.url).toContain(`/s/${envelope.data.spaceSlug}/p/`);
    pageUrl = envelope.data.url;
  });

  it("page-resolve-url resolves a web URL back to the same page", async () => {
    const result = await runCli(
      ["page-resolve-url", "--url", pageUrl],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(pageId);
    expect(envelope.data.url).toBe(pageUrl);
    expect(envelope.data.resolvedFromUrl).toBe(pageUrl);
  });

  it("page-breadcrumbs returns path", async () => {
    const result = await runCli(
      ["page-breadcrumbs", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
  });

  it("page-duplicate duplicates a page", async () => {
    const result = await runCli(
      ["page-duplicate", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    expect(envelope.data.id).not.toBe(pageId);
  });

  it("page-history returns history", async () => {
    const result = await runCli(
      ["page-history", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("page-delete deletes a page", async () => {
    const result = await runCli(
      ["page-delete", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);
  });

  it("page-info on non-existent page returns error", async () => {
    const result = await runCli(
      ["page-info", "--page-id", "00000000-0000-0000-0000-000000000000"],
      env,
    );
    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(false);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});
