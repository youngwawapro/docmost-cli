import { Command, Option } from "commander";
import { format } from "util";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import {
  getSafeOutput,
  isCommanderHelpExit,
  normalizeError,
  printError,
} from "./cli-utils.js";
import { createProgram } from "../program.js";

const EXCLUDED_COMMANDS = new Set(["commands"]);
const FILE_OUTPUT_COMMANDS = new Set(["file-download", "page-export", "space-export"]);

type OutputBuffer = {
  stdout: Buffer[];
  stderr: Buffer[];
};

type WriteCallback = ((error?: Error | null) => void) | undefined;

export type McpToolOption = {
  name: string;
  long: string;
  description: string;
  schema: ZodTypeAny;
  required: boolean;
  serialize: (value: unknown) => string[];
};

export type McpToolDefinition = {
  commandName: string;
  toolName: string;
  description: string;
  inputSchema: ZodRawShape;
  options: McpToolOption[];
  annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  requiresOutputPath: boolean;
};

export type CommandExecutionResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  parsed?: unknown;
  outputPath?: string;
};

let executionQueue = Promise.resolve();

function toBuffer(chunk: string | Uint8Array, encoding?: BufferEncoding): Buffer {
  if (typeof chunk === "string") {
    return Buffer.from(chunk, encoding);
  }
  return Buffer.from(chunk);
}

function captureWrite(
  target: Buffer[],
): (chunk: string | Uint8Array, encoding?: BufferEncoding | WriteCallback, cb?: WriteCallback) => boolean {
  return (chunk, encoding, cb) => {
    const normalizedEncoding = typeof encoding === "string" ? encoding : undefined;
    const callback = typeof encoding === "function" ? encoding : cb;
    target.push(toBuffer(chunk, normalizedEncoding));
    callback?.(null);
    return true;
  };
}

async function withCapturedStdio<T>(run: () => Promise<T>): Promise<{ result: T; stdout: string; stderr: string }> {
  const output: OutputBuffer = { stdout: [], stderr: [] };
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  (process.stdout.write as unknown as typeof process.stdout.write) = captureWrite(output.stdout);
  (process.stderr.write as unknown as typeof process.stderr.write) = captureWrite(output.stderr);
  console.log = (...args: unknown[]) => {
    output.stdout.push(Buffer.from(`${format(...args)}\n`, "utf-8"));
  };
  console.error = (...args: unknown[]) => {
    output.stderr.push(Buffer.from(`${format(...args)}\n`, "utf-8"));
  };

  try {
    const result = await run();
    return {
      result,
      stdout: Buffer.concat(output.stdout).toString("utf-8"),
      stderr: Buffer.concat(output.stderr).toString("utf-8"),
    };
  } finally {
    (process.stdout.write as unknown as typeof process.stdout.write) = originalStdoutWrite;
    (process.stderr.write as unknown as typeof process.stderr.write) = originalStderrWrite;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
}

function isNativeParseInt(option: Option) {
  return option.parseArg === parseInt || option.parseArg?.name === "parseInt";
}

function makeBooleanSchema(description: string, required: boolean, defaultValue?: boolean) {
  let schema: ZodTypeAny = z.boolean().describe(description);
  if (defaultValue !== undefined) {
    schema = schema.default(defaultValue);
  } else if (!required) {
    schema = schema.optional();
  }
  return schema;
}

function makeNumberSchema(description: string, required: boolean, defaultValue?: number) {
  let schema: ZodTypeAny = z.number().int().describe(description);
  if (defaultValue !== undefined) {
    schema = schema.default(defaultValue);
  } else if (!required) {
    schema = schema.optional();
  }
  return schema;
}

function makeStringSchema(
  description: string,
  required: boolean,
  choices?: string[],
  defaultValue?: string,
) {
  let schema: ZodTypeAny = z.string().describe(description);
  if (choices && choices.length > 0) {
    schema = schema.refine((value) => typeof value === "string" && choices.includes(value), {
      message: `Expected one of: ${choices.join(", ")}`,
    });
  }
  if (defaultValue !== undefined) {
    schema = schema.default(defaultValue);
  } else if (!required) {
    schema = schema.optional();
  }
  return schema;
}

function createOptionSchema(option: Option, commandName: string): McpToolOption {
  const name = option.attributeName();
  const long = option.long;
  if (!long) {
    throw new Error(`Option '${option.flags}' on command '${commandName}' is missing a long flag.`);
  }
  const required = FILE_OUTPUT_COMMANDS.has(commandName) && name === "output"
    ? true
    : option.mandatory === true;
  const optionDescription = option.description || option.flags;
  const description = FILE_OUTPUT_COMMANDS.has(commandName) && name === "output"
    ? `${optionDescription} Required in MCP mode so binary output is written to a local file.`
    : optionDescription;

  if (option.isBoolean()) {
    return {
      name,
      long,
      description,
      required,
      schema: makeBooleanSchema(description, required, option.defaultValue),
      serialize: (value) => (value ? [long] : []),
    };
  }

  if (option.argChoices?.length === 2 && option.argChoices.includes("true") && option.argChoices.includes("false")) {
    return {
      name,
      long,
      description,
      required,
      schema: makeBooleanSchema(description, required, option.defaultValue),
      serialize: (value) => (value === undefined ? [] : [long, String(value)]),
    };
  }

  if (isNativeParseInt(option)) {
    return {
      name,
      long,
      description,
      required,
      schema: makeNumberSchema(description, required, option.defaultValue),
      serialize: (value) => (value === undefined ? [] : [long, String(value)]),
    };
  }

  return {
    name,
    long,
    description,
    required,
    schema: makeStringSchema(description, required, option.argChoices, option.defaultValue),
    serialize: (value) => (value === undefined ? [] : [long, String(value)]),
  };
}

function getAnnotations(commandName: string) {
  const readOnlyPrefixes = [
    "page-list",
    "page-info",
    "page-history",
    "page-breadcrumbs",
    "page-tree",
    "page-trash",
    "space-list",
    "space-info",
    "space-member-list",
    "workspace-info",
    "workspace-public",
    "member-list",
    "user-me",
    "group-list",
    "group-info",
    "group-member-list",
    "comment-list",
    "comment-info",
    "share-list",
    "share-info",
    "share-for-page",
    "invite-list",
    "invite-info",
    "invite-link",
    "search",
    "search-suggest",
  ];
  const destructiveTokens = ["delete", "remove", "revoke"];

  const readOnlyHint = readOnlyPrefixes.some((prefix) => commandName.startsWith(prefix));
  const destructiveHint = destructiveTokens.some((token) => commandName.includes(token));
  const idempotentHint = readOnlyHint || commandName.endsWith("-update") || commandName.endsWith("-role");

  return {
    readOnlyHint: readOnlyHint || undefined,
    destructiveHint: destructiveHint || undefined,
    idempotentHint: idempotentHint || undefined,
    openWorldHint: true,
  };
}

export function listMcpTools(): McpToolDefinition[] {
  const program = createProgram();

  return program.commands
    .filter((command) => !EXCLUDED_COMMANDS.has(command.name()))
    .map((command) => {
      const commandName = command.name();
      const options = command.options.map((option) => createOptionSchema(option, commandName));
      const inputSchema = Object.fromEntries(
        options.map((option) => [option.name, option.schema]),
      ) as ZodRawShape;
      const toolName = commandName.replace(/-/g, "_");
      const baseDescription = command.description();
      const description = FILE_OUTPUT_COMMANDS.has(commandName)
        ? `${baseDescription}. This MCP wrapper requires \`output\` so exported/downloaded bytes are saved to a local file instead of streamed over stdio.`
        : baseDescription;

      return {
        commandName,
        toolName,
        description,
        inputSchema,
        options,
        annotations: getAnnotations(commandName),
        requiresOutputPath: FILE_OUTPUT_COMMANDS.has(commandName),
      };
    });
}

function buildArgv(tool: McpToolDefinition, args: Record<string, unknown>) {
  const argv = ["node", "docmost", "--format", "json", tool.commandName];

  for (const option of tool.options) {
    argv.push(...option.serialize(args[option.name]));
  }

  return argv;
}

async function executeToolInternal(tool: McpToolDefinition, args: Record<string, unknown>): Promise<CommandExecutionResult> {
  const program = createProgram();
  const argv = buildArgv(tool, args);

  const { stdout, stderr } = await withCapturedStdio(async () => {
    try {
      await program.parseAsync(argv);
    } catch (error: unknown) {
      if (isCommanderHelpExit(error)) {
        return;
      }

      const normalized = normalizeError(error);
      printError(normalized, getSafeOutput(program));
    }
  });

  const combinedStdout = stdout.trim();
  const combinedStderr = stderr.trim();
  const parsed = combinedStdout
    ? safeJsonParse(combinedStdout)
    : (combinedStderr ? safeJsonParse(combinedStderr) : undefined);
  const ok = isSuccessResult(parsed, stderr);

  return {
    ok,
    stdout,
    stderr,
    parsed,
    outputPath: typeof args.output === "string" ? args.output : undefined,
  };
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isSuccessResult(parsed: unknown, stderr: string) {
  if (!parsed || typeof parsed !== "object") {
    return stderr.trim().length === 0;
  }

  const envelope = parsed as { ok?: boolean };
  if (typeof envelope.ok === "boolean") {
    return envelope.ok;
  }

  return stderr.trim().length === 0;
}

export function executeTool(tool: McpToolDefinition, args: Record<string, unknown>) {
  const run = executionQueue.then(() => executeToolInternal(tool, args));
  executionQueue = run.then(() => undefined, () => undefined);
  return run;
}
