import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

import {
  auditLog,
  enableAuditLogging,
  maskDigitRuns,
  maskValue,
  sanitizeInput,
  sanitizeText,
  wrapToolHandler,
  type AuditEntry,
} from '../src/auditLog.ts';

const PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\nTEST-PRIVATE-KEY\n-----END PRIVATE KEY-----';

describe('maskValue', () => {
  test('keeps only the last four characters', () => {
    assert.equal(maskValue('+14155552671'), '********2671');
  });

  test('fully masks values of four characters or fewer', () => {
    assert.equal(maskValue('1234'), '****');
    assert.equal(maskValue(''), '');
  });
});

describe('maskDigitRuns', () => {
  test('masks phone numbers in free text, keeping the plus sign', () => {
    assert.equal(
      maskDigitRuns('Invalid phone number format: +14155552671'),
      'Invalid phone number format: +*******2671'
    );
  });

  test('leaves dates and short numbers alone', () => {
    const text = 'No records between 2024-01-01 and 2024-01-08, code 429';
    assert.equal(maskDigitRuns(text), text);
  });
});

describe('sanitizeText', () => {
  test('removes private keys', () => {
    assert.equal(
      sanitizeText(`Private Key: ${PRIVATE_KEY}`),
      'Private Key: [REDACTED]'
    );
  });

  test('masks digit runs', () => {
    assert.equal(sanitizeText('to +14155552671'), 'to +*******2671');
  });
});

describe('sanitizeInput', () => {
  const input = {
    to: '+14155552671',
    from: '+447700900123',
    msisdn: '12025550123',
    account_id: 'abcd1234',
    message: 'Hello, your code is 123456',
    chartConfig: { data: { labels: ['+14155552671'] } },
    base64Data: 'iVBORw0KGgo=',
    apiSecret: 'shh',
    product: 'SMS',
    date_start: '2024-01-01T00:00:00Z',
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    filename: '+14155552671.png',
    size: 10,
  };

  test('masks identifiers, omits content, and redacts credentials', () => {
    assert.deepEqual(sanitizeInput(input), {
      to: '********2671',
      from: '*********0123',
      msisdn: '*******0123',
      account_id: '****1234',
      message: '[omitted]',
      chartConfig: '[omitted]',
      base64Data: '[12 chars]',
      apiSecret: '[REDACTED]',
      product: 'SMS',
      date_start: '2024-01-01T00:00:00Z',
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      filename: '+*******2671.png',
      size: 10,
    });
  });

  test('applies rules to nested objects and arrays', () => {
    assert.deepEqual(sanitizeInput({ recipients: [{ to: '+14155552671' }] }), {
      recipients: [{ to: '********2671' }],
    });
  });

  test('keeps null and undefined values as they are', () => {
    assert.deepEqual(sanitizeInput({ to: undefined, from: null }), {
      to: undefined,
      from: null,
    });
  });

  test('does not mutate the input', () => {
    const copy = structuredClone(input);
    sanitizeInput(input);
    assert.deepEqual(input, copy);
  });
});

describe('wrapToolHandler', () => {
  function capture() {
    const entries: AuditEntry[] = [];
    return {
      entries,
      wrap: (handler: (...args: unknown[]) => unknown) =>
        wrapToolHandler('SMS', handler, entry => entries.push(entry)),
    };
  }

  const smsInput = { to: '+14155552671', message: 'Hello' };
  const okResult = {
    content: [{ type: 'text', text: 'Message "Hello" sent to +14155552671' }],
  };

  test('passes arguments through and returns the handler result', async () => {
    const { wrap } = capture();
    const extra = { requestId: 1 };
    let received: unknown[] = [];
    const wrapped = wrap((...args: unknown[]) => {
      received = args;
      return okResult;
    });

    assert.equal(await wrapped(smsInput, extra), okResult);
    assert.deepEqual(received, [smsInput, extra]);
  });

  test('logs a masked success entry without the result', async () => {
    const { entries, wrap } = capture();
    await wrap(() => okResult)(smsInput);

    assert.equal(entries.length, 1);
    const [entry] = entries;
    assert.equal(entry.tool, 'SMS');
    assert.equal(entry.outcome, 'success');
    assert.deepEqual(entry.input, { to: '********2671', message: '[omitted]' });
    assert.ok(!('result' in entry));
    assert.ok(!JSON.stringify(entry).includes('Hello'));
    assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
    assert.ok(entry.durationMs >= 0);
  });

  test('never logs a private key from an error result', async () => {
    const { entries, wrap } = capture();
    await wrap(() => ({
      content: [{ type: 'text', text: `Private Key: ${PRIVATE_KEY}` }],
      isError: true,
    }))({});

    assert.equal(entries[0].error, 'Private Key: [REDACTED]');
  });

  test('logs results flagged isError as errors, with masked text', async () => {
    const { entries, wrap } = capture();
    const result = await wrap(() => ({
      content: [{ type: 'text', text: 'Failed for +14155552671' }],
      isError: true,
    }))(smsInput);

    assert.equal((result as { isError: boolean }).isError, true);
    assert.equal(entries[0].outcome, 'error');
    assert.equal(entries[0].error, 'Failed for +*******2671');
  });

  test('logs and rethrows errors thrown by the handler', async () => {
    const { entries, wrap } = capture();
    const failure = new Error('Invalid phone number format: +14155552671');

    await assert.rejects(
      wrap(() => {
        throw failure;
      })(smsInput),
      failure
    );
    assert.equal(entries[0].outcome, 'error');
    assert.equal(entries[0].error, 'Invalid phone number format: +*******2671');
  });
});

describe('enableAuditLogging with a real MCP server', () => {
  let lines: string[];
  let originalLog: typeof auditLog.log;
  let originalEnabled: boolean;

  beforeEach(() => {
    lines = [];
    originalLog = auditLog.log;
    originalEnabled = auditLog.enabled;
    auditLog.enabled = true;
    auditLog.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    auditLog.log = originalLog;
    auditLog.enabled = originalEnabled;
  });

  async function connect(server: McpServer) {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return client;
  }

  function loggedEntry(): AuditEntry {
    assert.equal(lines.length, 1, 'expected exactly one audit line');
    return JSON.parse(lines[0].slice(lines[0].indexOf('{')));
  }

  test('logs tools registered with registerTool', async () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    enableAuditLogging(server);
    server.registerTool(
      'SMS',
      { inputSchema: { to: z.string(), message: z.string() } },
      async ({ to }) => ({
        content: [{ type: 'text', text: `sent to ${to}` }],
      })
    );

    const client = await connect(server);
    const result = await client.callTool({
      name: 'SMS',
      arguments: { to: '+14155552671', message: 'Hello' },
    });

    assert.deepEqual(result.content, [
      { type: 'text', text: 'sent to +14155552671' },
    ]);
    const entry = loggedEntry();
    assert.equal(entry.tool, 'SMS');
    assert.equal(entry.outcome, 'success');
    assert.deepEqual(entry.input, { to: '********2671', message: '[omitted]' });
    await client.close();
  });

  test('logs tools registered with registerAppTool', async () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    enableAuditLogging(server);
    registerAppTool(
      server,
      'make-chart',
      {
        inputSchema: { filename: z.string() },
        _meta: { ui: { resourceUri: 'ui://test/chart.html' } },
      },
      async () => ({ content: [{ type: 'text', text: 'ok' }] })
    );

    const client = await connect(server);
    await client.callTool({
      name: 'make-chart',
      arguments: { filename: 'chart.png' },
    });

    const entry = loggedEntry();
    assert.equal(entry.tool, 'make-chart');
    assert.deepEqual(entry.input, { filename: 'chart.png' });
    await client.close();
  });
});

describe('default output stream', () => {
  test('writes to stderr and never to stdout', () => {
    const originalEnabled = auditLog.enabled;
    const originalStderr = process.stderr.write;
    const originalStdout = process.stdout.write;
    const stderr: string[] = [];
    const stdout: string[] = [];

    auditLog.enabled = true;
    process.stderr.write = ((chunk: string) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    process.stdout.write = ((chunk: string) => {
      stdout.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      auditLog('tool call %s', '{"tool":"balance"}');
    } finally {
      process.stderr.write = originalStderr;
      process.stdout.write = originalStdout;
      auditLog.enabled = originalEnabled;
    }

    assert.equal(stdout.length, 0);
    assert.equal(stderr.length, 1);
    assert.ok(stderr[0].includes('vonage:mcp-server'));
    assert.ok(stderr[0].includes('{"tool":"balance"}'));
  });
});
