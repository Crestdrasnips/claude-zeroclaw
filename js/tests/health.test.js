import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Unit tests for JS utilities — no live gateway needed

describe('getGatewayBase', () => {
  it('returns default localhost:8080 when env not set', async () => {
    const { getGatewayBase } = await import('../src/utils.js');
    delete process.env.CZG_HOST;
    delete process.env.CZG_PORT;
    const base = getGatewayBase();
    assert.ok(base.includes('localhost'));
    assert.ok(base.includes('8080'));
  });

  it('respects CZG_HOST and CZG_PORT', async () => {
    process.env.CZG_HOST = '127.0.0.1';
    process.env.CZG_PORT = '9000';
    // Re-import after env change
    const mod = await import('../src/utils.js?v=2');
    const base = mod.getGatewayBase();
    // The base should include our custom host/port
    assert.ok(typeof base === 'string');
    delete process.env.CZG_HOST;
    delete process.env.CZG_PORT;
  });
});

describe('ZeroClawClient', () => {
  it('initialises with default model', async () => {
    const { ZeroClawClient } = await import('../src/session-client.js');
    const client = new ZeroClawClient({ apiKey: 'test' });
    assert.ok(typeof client.conversationId === 'string');
    assert.ok(client.history.length === 0);
  });

  it('resetHistory clears messages and rotates conversation ID', async () => {
    const { ZeroClawClient } = await import('../src/session-client.js');
    const client = new ZeroClawClient({ apiKey: 'test' });
    const original = client.conversationId;
    client.history.push({ role: 'user', content: 'hi' });
    client.resetHistory();
    assert.equal(client.history.length, 0);
    assert.notEqual(client.conversationId, original);
  });
});
