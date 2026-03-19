#!/usr/bin/env node
import {
  isCommanderHelpExit,
  getSafeOutput,
  normalizeError,
  printError,
} from "./lib/cli-utils.js";
import { createProgram } from "./program.js";

async function main() {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    if (isCommanderHelpExit(error)) {
      process.exit(0);
    }

    const output = getSafeOutput(program);
    const normalized = normalizeError(error);
    printError(normalized, output);
    process.exit(normalized.exitCode);
  }
}

main();
