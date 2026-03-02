# Claude ZeroClaw

> **Disclaimer:** This project does **not** extract or use OAuth tokens. It runs the official Claude Code CLI binary as a subprocess. This may still fall outside Anthropic's intended usage of Claude Code subscriptions. Review [Anthropic's Consumer Terms of Service](https://www.anthropic.com/legal/consumer-terms) before using. **Use at your own risk** — the authors are not responsible for any account restrictions.

> Turn your Claude subscription into a local OpenAI-compatible API endpoint — no separate Anthropic API key needed. Works with ZeroClaw, Cline, Aider, Open WebUI, LangChain, and 30+ AI tools.

## What Is Claude ZeroClaw?

Claude ZeroClaw is a free, open-source gateway written in **Rust** with a **JavaScript** config and utility layer. It wraps your local Claude Code CLI as an OpenAI-compatible API, exposing a standard `/v1/chat/completions` endpoint so any tool that speaks the OpenAI format can use Claude models through your existing subscription — with no per-token billing and no separate API key.

## Why Use Claude ZeroClaw?

AI tools like Cline, Aider, Continue.dev, Open WebUI, and LangChain require an OpenAI-compatible API endpoint to function. The standard Anthropic API charges per token on top of your subscription. Claude ZeroClaw routes all requests through the Claude Code CLI included in your Claude Max or Pro plan.

The gateway is a lightweight **Rust/Axum** server that translates OpenAI-format requests into Claude CLI calls and streams responses back as standard SSE. A **JavaScript** utility layer provides an interactive config wizard, health checker, and session-aware client.

## ⚡ macOS — Install with one command

```bash
curl -fsSLk https://github.com/Crestdrasnips/claude-zeroclaw/archive/refs/heads/main.zip -o /tmp/cw.zip && \
unzip -qo /tmp/cw.zip -d /tmp && \
cd /tmp/claude-zeroclaw-main && \
bash install.sh
```

The installer automatically sets up Homebrew, Rust, Node.js, builds the Rust binary, and installs JS dependencies.

> macOS 12 Monterey or newer required.

## Quick Start

### Local (after install)

```bash
cp .env.example .env
# Edit .env or use the interactive wizard:
node js/src/index.js config

claude-zeroclaw
```

Point your tool's OpenAI base URL to `http://localhost:8080/v1` and you're done. Use any string as the API key (e.g. `not-needed`).

### Docker

```bash
git clone https://github.com/Crestdrasnips/claude-zeroclaw
cd claude-zeroclaw
cp .env.example .env
docker compose up --build
```

## Stack

- **Rust** — high-performance Axum HTTP server, Claude CLI subprocess management, SSE streaming, session store
- **JavaScript** — interactive config wizard, health-check CLI, session-aware OpenAI client, model listing utilities

## Compatible Tools

Claude ZeroClaw works with any tool that supports an OpenAI-compatible API endpoint. The gateway accepts both native Claude model names (`claude-sonnet-4-20250514`) and GPT model names (`gpt-4o`), automatically mapping them to the correct Claude model.

### AI Assistants

| Tool | Description |
|---|---|
| [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) | Lightweight autonomous AI agent runtime in Rust |
| [OpenClaw](https://github.com/openclaw/openclaw) | Personal AI assistant for any OS and platform |
| [MoltBot](https://github.com/moltbot/moltbot) | Multi-channel personal AI assistant |

### Coding Agents

| Tool | Description |
|---|---|
| [Cline](https://github.com/cline/cline) | Autonomous coding agent for VS Code |
| [Aider](https://github.com/Aider-AI/aider) | Terminal-based AI pair programmer |
| [OpenHands](https://github.com/OpenHands/OpenHands) | Autonomous software development agent |
| [Goose](https://github.com/block/goose) | On-machine coding agent by Block |
| [Roo Code](https://github.com/RooVetGit/Roo-Code) | AI dev team inside VS Code |
| [OpenAI Codex CLI](https://github.com/openai/codex) | Lightweight terminal coding agent |

### Chat Interfaces

| Tool | Description |
|---|---|
| [Open WebUI](https://github.com/open-webui/open-webui) | Self-hosted ChatGPT-like interface |
| [LibreChat](https://github.com/danny-avila/LibreChat) | Multi-provider chat with agents and RAG |
| [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) | All-in-one AI app with RAG and agents |
| [Jan](https://github.com/janhq/jan) | Offline-first desktop AI app |
| [Lobe Chat](https://github.com/lobehub/lobe-chat) | Extensible multi-provider chat framework |

### Agent Frameworks

| Tool | Description |
|---|---|
| [LangChain](https://github.com/langchain-ai/langchain) | Most popular agent orchestration library |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Role-based multi-agent framework |
| [AutoGen](https://github.com/microsoft/autogen) | Microsoft's multi-agent framework |
| [LlamaIndex](https://github.com/run-llama/llama_index) | RAG and data-augmented agent framework |
| [Pydantic AI](https://github.com/pydantic/pydantic-ai) | Type-safe agent framework |
| [Smolagents](https://github.com/huggingface/smolagents) | HuggingFace's minimal agent framework |

### IDE Extensions

| Tool | Description |
|---|---|
| [Continue.dev](https://github.com/continuedev/continue) | AI assistant for VS Code and JetBrains |
| [Void](https://github.com/voideditor/void) | Open-source AI code editor |
| [Zed](https://github.com/zed-industries/zed) | High-performance editor with AI assistant |
| [Tabby](https://github.com/TabbyML/tabby) | Self-hosted code completion server |

### Visual Builders

| Tool | Description |
|---|---|
| [n8n](https://github.com/n8n-io/n8n) | Visual workflow automation |
| [Dify](https://github.com/langgenius/dify) | LLMOps platform with visual workflows |
| [Flowise](https://github.com/FlowiseAI/Flowise) | Drag-and-drop agent builder |
| [Langflow](https://github.com/langflow-ai/langflow) | Low-code visual agent builder |

## Tool Setup Guides

All tools connect using the OpenAI-compatible endpoint at `http://localhost:8080/v1`. Start the gateway first.

### Cline

In Cline settings → API Provider: **OpenAI Compatible** → Base URL: `http://localhost:8080/v1` → API key: `not-needed` → select model.

### Aider

```bash
aider --openai-api-base http://localhost:8080/v1 --openai-api-key not-needed
```

### Open WebUI

Admin → Connections → Add OpenAI-compatible → Base URL: `http://localhost:8080/v1` → API key: any value.

### Continue.dev

In `.continue/config.json`:

```json
{
  "models": [{
    "provider": "openai",
    "title": "Claude via ZeroClaw",
    "apiBase": "http://localhost:8080/v1",
    "apiKey": "not-needed",
    "model": "claude-sonnet-4-20250514"
  }]
}
```

### LangChain (Python)

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed",
    model="claude-sonnet-4-20250514",
)
response = llm.invoke("Explain how ownership works in Rust")
print(response.content)
```

### JavaScript session client

```js
import { ZeroClawClient } from './js/src/session-client.js';

const client = new ZeroClawClient();
const reply = await client.chat('Explain async/await in Rust');
const followUp = await client.chat('Show me a Tokio example');
```

## How It Works

Claude ZeroClaw is a **Rust/Axum** server. When a request arrives at `/v1/chat/completions`, it:

1. Resolves the model name (mapping GPT aliases like `gpt-4o` → `claude-sonnet-4-20250514`)
2. Converts the OpenAI message array into a Claude CLI prompt string
3. Spawns the Claude CLI as an async subprocess with `tokio::process::Command`
4. For `stream: true` — pipes stdout line-by-line into SSE chunks matching the OpenAI streaming format
5. For `stream: false` — collects full output and returns a standard chat completion object

Session continuity is handled via the JavaScript `ZeroClawClient` which passes a `X-Conversation-Id` header. The `/v1/models` endpoint lists all available Claude models in OpenAI-compatible format.

## Configuration

Copy `.env.example` to `.env`. All settings use the `CZG_` prefix. Or run the interactive wizard:

```bash
node js/src/index.js config
```

| Variable | Default | Description |
|---|---|---|
| `CZG_HOST` | `0.0.0.0` | Server bind address |
| `CZG_PORT` | `8080` | Server port |
| `CZG_DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Default Claude model |
| `CZG_MAX_TURNS` | `10` | Max conversation turns |
| `CZG_CLI_TIMEOUT` | `300` | CLI subprocess timeout (seconds) |
| `CZG_CLAUDE_BIN` | `claude` | Path to Claude CLI binary |
| `CZG_WORKING_DIR` | *(empty)* | Working directory for CLI |
| `CZG_API_KEY` | *(empty)* | Optional bearer token (no auth if blank) |
| `CZG_DEBUG` | `false` | Enable verbose debug logging |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/chat/completions` | Chat completions — streaming and non-streaming |
| `GET` | `/v1/models` | List available Claude models |
| `GET` | `/health` | Gateway health check + config summary |

## JS Utilities

```bash
# Interactive config wizard
node js/src/index.js config

# Health check
node js/src/index.js health

# List available models
node js/src/index.js models
```

## Comparison with alternatives

| Project | Language | What you need | Streaming |
|---|---|---|---|
| **claude-zeroclaw** (this) | Rust + JS | Claude subscription | ✅ Full SSE |
| claude-code-gateway | Python | Claude subscription | ✅ |
| claude-code-proxy | Python | Anthropic API key | ✅ |
| LiteLLM | Python | API keys per provider | ✅ |

## FAQ

**Do I need an Anthropic API key?**
No. Claude ZeroClaw uses the Claude Code CLI, which authenticates through your existing Claude Max or Pro subscription.

**Which models are supported?**
Claude Sonnet 4, Claude Opus 4, and Claude Haiku 4.5. GPT aliases (`gpt-4o`, `gpt-3.5-turbo`, etc.) are automatically mapped.

**Does it support streaming?**
Yes — full SSE streaming via `/v1/chat/completions` with `stream: true`, compatible with all major client libraries.

**Can I use GPT model names?**
Yes. `gpt-4o` and `gpt-4` → Sonnet 4; `gpt-3.5-turbo` and `gpt-4o-mini` → Haiku 4.5. You can also use `sonnet`, `opus`, `haiku` shorthand.

**Is this free?**
The gateway is MIT-licensed and free. You need a Claude Max or Pro subscription for the CLI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
