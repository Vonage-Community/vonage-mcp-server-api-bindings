import debug from 'debug';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Audit logging for tool invocations.
 *
 * Enable with DEBUG=vonage:mcp-server. Output goes to stderr, because stdout
 * carries the MCP STDIO transport. Phone numbers and account IDs are masked to
 * their last four characters, message content and tool results are omitted,
 * and credentials and private keys are never logged.
 */
export const auditLog = debug('vonage:mcp-server');

const VISIBLE_SUFFIX_LENGTH = 4;

const CREDENTIAL_KEY =
  /secret|password|token|private_?key|api_?key|authorization|signature/i;

// Identifiers that can be traced to a person or account.
const MASKED_KEYS = new Set(['to', 'from', 'msisdn', 'account_id']);

// Free-form content that may hold personal data.
const CONTENT_KEYS = new Set(['message', 'text', 'chartConfig']);

// Large payloads that are logged by size only.
const SIZE_ONLY_KEYS = new Set(['base64Data']);

const PRIVATE_KEY_BLOCK =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

// Phone-number-like digit runs inside free text, e.g. error messages. Matches
// unbroken runs of 7-15 digits (E.164 length) so dates and short IDs survive.
const DIGIT_RUN = /\+?\b\d{7,15}\b/g;

/** Mask all but the last four characters. */
export function maskValue(value: string): string {
  if (value.length <= VISIBLE_SUFFIX_LENGTH) {
    return '*'.repeat(value.length);
  }
  return (
    '*'.repeat(value.length - VISIBLE_SUFFIX_LENGTH) +
    value.slice(-VISIBLE_SUFFIX_LENGTH)
  );
}

/** Mask phone-number-like digit runs, keeping the last four digits. */
export function maskDigitRuns(text: string): string {
  return text.replace(DIGIT_RUN, match => {
    const prefix = match.startsWith('+') ? '+' : '';
    return prefix + maskValue(match.slice(prefix.length));
  });
}

/** Clean free text for logging: remove private keys and mask digit runs. */
export function sanitizeText(text: string): string {
  return maskDigitRuns(text.replace(PRIVATE_KEY_BLOCK, '[REDACTED]'));
}

/**
 * Clean tool input for logging according to the field rules above. Fields
 * without a rule (IDs, dates, file names, and so on) are kept, except that
 * phone-number-like digit runs inside them are masked.
 */
export function sanitizeInput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (!isRecord(value)) {
    return typeof value === 'string' ? maskDigitRuns(value) : value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    sanitized[key] = sanitizeField(key, field);
  }
  return sanitized;
}

function sanitizeField(key: string, field: unknown): unknown {
  if (field === undefined || field === null) {
    return field;
  }
  if (CREDENTIAL_KEY.test(key)) {
    return '[REDACTED]';
  }
  if (SIZE_ONLY_KEYS.has(key)) {
    return `[${String(field).length} chars]`;
  }
  if (MASKED_KEYS.has(key)) {
    return maskValue(String(field));
  }
  if (CONTENT_KEYS.has(key)) {
    return '[omitted]';
  }
  return sanitizeInput(field);
}

export type AuditEntry = {
  timestamp: string;
  tool: string;
  input: unknown;
  outcome: 'success' | 'error';
  durationMs: number;
  error?: string;
};

type ToolHandler = (...args: unknown[]) => unknown;

/**
 * Wrap a tool handler so each invocation is logged. The handler's arguments
 * and return value pass through unchanged, and thrown errors are rethrown.
 */
export function wrapToolHandler(
  tool: string,
  handler: ToolHandler,
  write: (entry: AuditEntry) => void = writeAuditEntry
): ToolHandler {
  return async (...args: unknown[]) => {
    const started = Date.now();
    const base = {
      timestamp: new Date(started).toISOString(),
      tool,
      input: sanitizeInput(args[0]),
    };

    try {
      const result = await handler(...args);
      const isError = isRecord(result) && result.isError === true;
      const errorText = isError ? extractResultText(result) : undefined;
      write({
        ...base,
        outcome: isError ? 'error' : 'success',
        durationMs: Date.now() - started,
        ...(errorText ? { error: sanitizeText(errorText) } : {}),
      });
      return result;
    } catch (error) {
      write({
        ...base,
        outcome: 'error',
        durationMs: Date.now() - started,
        error: sanitizeText(errorMessage(error)),
      });
      throw error;
    }
  };
}

/**
 * Log every tool registered on this server, including tools registered
 * through registerAppTool, which delegates to server.registerTool. Call this
 * before registering any tools.
 */
export function enableAuditLogging(
  server: Pick<McpServer, 'registerTool'>
): void {
  const registerTool = server.registerTool.bind(server) as (
    ...args: unknown[]
  ) => unknown;

  server.registerTool = ((name: string, config: unknown, handler: unknown) =>
    registerTool(
      name,
      config,
      typeof handler === 'function'
        ? wrapToolHandler(name, handler as ToolHandler)
        : handler
    )) as McpServer['registerTool'];
}

function writeAuditEntry(entry: AuditEntry): void {
  auditLog('tool call %s', JSON.stringify(entry));
}

function extractResultText(
  result: Record<string, unknown>
): string | undefined {
  if (!Array.isArray(result.content)) {
    return undefined;
  }
  const texts = result.content
    .filter(isRecord)
    .map(part => part.text)
    .filter((text): text is string => typeof text === 'string');
  return texts.length > 0 ? texts.join('\n') : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
