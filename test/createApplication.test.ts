import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCreateApplicationResponse,
  PRIVATE_KEY_ADVISORY,
} from '../src/createApplication.ts';

const PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\nTEST-PRIVATE-KEY\n-----END PRIVATE KEY-----\n';
const PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\nTEST-PUBLIC-KEY\n-----END PUBLIC KEY-----\n';

// Mirrors the SDK, which returns keys in both camelCase and snake_case.
const createdApplication = {
  id: 'app-123',
  name: 'My App',
  keys: {
    publicKey: PUBLIC_KEY,
    privateKey: PRIVATE_KEY,
    public_key: PUBLIC_KEY,
    private_key: PRIVATE_KEY,
  },
};

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test('shows the private key exactly once', () => {
  const text = formatCreateApplicationResponse(createdApplication);
  assert.equal(countOccurrences(text, 'TEST-PRIVATE-KEY'), 1);
  assert.ok(text.includes(`Private Key: ${PRIVATE_KEY}`));
});

test('places the advisory after the private key', () => {
  const text = formatCreateApplicationResponse(createdApplication);
  const keyIndex = text.indexOf('TEST-PRIVATE-KEY');
  const advisoryIndex = text.indexOf(PRIVATE_KEY_ADVISORY);
  assert.ok(advisoryIndex > keyIndex, 'advisory should follow the key');
});

test('omits the private key from full details but keeps the rest', () => {
  const text = formatCreateApplicationResponse(createdApplication);
  const details = JSON.parse(text.split('Full details: ')[1]);
  assert.equal(details.keys.privateKey, undefined);
  assert.equal(details.keys.private_key, undefined);
  assert.equal(details.keys.publicKey, PUBLIC_KEY);
  assert.equal(details.keys.public_key, PUBLIC_KEY);
  assert.equal(details.id, 'app-123');
  assert.equal(details.name, 'My App');
});

test('does not mutate the application object', () => {
  const application = structuredClone(createdApplication);
  formatCreateApplicationResponse(application);
  assert.deepEqual(application, createdApplication);
});

test('omits the key line and advisory when no private key is returned', () => {
  const text = formatCreateApplicationResponse({
    id: 'app-456',
    name: 'Keyless App',
    keys: { publicKey: PUBLIC_KEY },
  });
  assert.ok(!text.includes('Private Key:'));
  assert.ok(!text.includes(PRIVATE_KEY_ADVISORY));
  assert.ok(text.includes('Application ID: app-456'));
});

test('handles a response with no keys object', () => {
  const text = formatCreateApplicationResponse({
    id: 'app-789',
    name: 'Bare App',
  });
  assert.ok(!text.includes('Private Key:'));
  assert.ok(text.includes('Full details:'));
});
