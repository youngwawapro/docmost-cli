import { Command } from "commander";
import {
  ensureOutputSupported,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("share-list")
    .description("List all shares")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getShares();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("share-info")
    .description("Get share details")
    .requiredOption("--share-id <id>", "Share ID")
    .action((options: { shareId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.getShareInfo(options.shareId);
        printResult(result, opts);
      }),
    );

  program
    .command("share-for-page")
    .description("Get share for a page")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.getShareForPage(options.pageId);
        printResult(result, opts);
      }),
    );

  program
    .command("share-create")
    .description("Create a share for a page")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--include-subpages", "Include subpages")
    .option("--search-indexing", "Allow search indexing")
    .action((options: { pageId: string; includeSubpages?: boolean; searchIndexing?: boolean }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.createShare(options.pageId, options.includeSubpages, options.searchIndexing);
        printResult(result, opts);
      }),
    );

  program
    .command("share-update")
    .description("Update a share")
    .requiredOption("--share-id <id>", "Share ID")
    .option("--include-subpages", "Include subpages")
    .option("--search-indexing", "Allow search indexing")
    .action((options: { shareId: string; includeSubpages?: boolean; searchIndexing?: boolean }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.updateShare(options.shareId, options.includeSubpages, options.searchIndexing);
        printResult(result, opts);
      }),
    );

  program
    .command("share-delete")
    .description("Delete a share")
    .requiredOption("--share-id <id>", "Share ID")
    .action((options: { shareId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.deleteShare(options.shareId);
        printResult(result, opts);
      }),
    );
}
