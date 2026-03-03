import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(import.meta.dirname, "../../build/index.js");

describe("commands discovery", () => {
  it("returns envelope with all commands", () => {
    const output = execFileSync("node", [CLI, "commands"], { encoding: "utf-8" });
    const result = JSON.parse(output);

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(50);
    expect(result.meta).toEqual({ count: result.data.length, hasMore: false });
  });

  it("each command has name, description, options", () => {
    const output = execFileSync("node", [CLI, "commands"], { encoding: "utf-8" });
    const result = JSON.parse(output);

    for (const cmd of result.data) {
      expect(cmd).toHaveProperty("name");
      expect(cmd).toHaveProperty("description");
      expect(cmd).toHaveProperty("options");
      expect(Array.isArray(cmd.options)).toBe(true);
    }
  });

  it("does not include 'commands' itself", () => {
    const output = execFileSync("node", [CLI, "commands"], { encoding: "utf-8" });
    const result = JSON.parse(output);

    const names = result.data.map((c: any) => c.name);
    expect(names).not.toContain("commands");
  });

  it("options have flags and description", () => {
    const output = execFileSync("node", [CLI, "commands"], { encoding: "utf-8" });
    const result = JSON.parse(output);

    const pageInfo = result.data.find((c: any) => c.name === "page-info");
    expect(pageInfo).toBeDefined();
    expect(pageInfo.options.length).toBeGreaterThan(0);

    const pageIdOpt = pageInfo.options.find((o: any) => o.flags.includes("--page-id"));
    expect(pageIdOpt).toBeDefined();
    expect(pageIdOpt.required).toBe(true);
  });
});
