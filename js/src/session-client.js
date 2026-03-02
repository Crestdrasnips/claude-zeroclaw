/**
 * Session-aware client for the Claude ZeroClaw gateway.
 * Maintains conversation_id across turns and sends it as a custom header
 * so the Rust layer can resume Claude CLI sessions.
 *
 * Usage:
 *   import { ZeroClawClient } from './session-client.js';
 *   const client = new ZeroClawClient();
 *   const reply = await client.chat('Explain async/await in Rust');
 *   const followUp = await client.chat('Show me an example with Tokio');
 */
import axios from 'axios';
import { randomUUID } from 'crypto';
import { getGatewayBase } from './utils.js';

export class ZeroClawClient {
  constructor(options = {}) {
    this.base          = options.base ?? getGatewayBase();
    this.model         = options.model ?? process.env.CZG_DEFAULT_MODEL ?? 'claude-sonnet-4-20250514';
    this.apiKey        = options.apiKey ?? process.env.CZG_API_KEY ?? 'not-needed';
    this.conversationId = options.conversationId ?? randomUUID();
    this.history       = [];
  }

  /**
   * Send a user message and return the assistant reply.
   * @param {string} userMessage
   * @returns {Promise<string>}
   */
  async chat(userMessage) {
    this.history.push({ role: 'user', content: userMessage });

    const { data } = await axios.post(
      `${this.base}/v1/chat/completions`,
      {
        model:    this.model,
        messages: this.history,
        stream:   false,
      },
      {
        headers: {
          'Authorization':    `Bearer ${this.apiKey}`,
          'Content-Type':     'application/json',
          'X-Conversation-Id': this.conversationId,
        },
        timeout: 120_000,
      }
    );

    const reply = data.choices?.[0]?.message?.content ?? '';
    this.history.push({ role: 'assistant', content: reply });
    return reply;
  }

  /** Reset conversation history but keep the same client. */
  resetHistory() {
    this.history = [];
    this.conversationId = randomUUID();
  }

  /** One-shot completion with no history. */
  static async oneShot(message, model) {
    const client = new ZeroClawClient({ model });
    return client.chat(message);
  }
}
