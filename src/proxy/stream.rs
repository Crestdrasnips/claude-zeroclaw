use chrono::Utc;
use serde_json::{json, Value};
use uuid::Uuid;

/// Build an OpenAI-compatible SSE streaming chunk.
pub fn make_chunk(
    request_id: &str,
    model: &str,
    delta_content: Option<&str>,
    finish_reason: Option<&str>,
) -> String {
    let delta = match delta_content {
        Some(text) => json!({ "role": "assistant", "content": text }),
        None       => json!({ "content": "" }),
    };

    let choice = json!({
        "index": 0,
        "delta": delta,
        "finish_reason": finish_reason,
    });

    let chunk = json!({
        "id":      request_id,
        "object":  "chat.completion.chunk",
        "created": Utc::now().timestamp(),
        "model":   model,
        "choices": [choice],
    });

    format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap_or_default())
}

/// The final [DONE] SSE sentinel
pub fn make_done() -> &'static str {
    "data: [DONE]\n\n"
}

/// Build a new request ID in OpenAI's style
pub fn new_request_id() -> String {
    format!("chatcmpl-{}", Uuid::new_v4().to_string().replace('-', ""))
}

/// Convert multi-turn OpenAI message list into a single Claude-compatible prompt string.
/// Claude CLI takes a single prompt; we reconstruct a Markdown conversation.
pub fn messages_to_prompt(messages: &[Value]) -> String {
    let mut parts = Vec::new();

    for msg in messages {
        let role = msg["role"].as_str().unwrap_or("user");
        let content = match &msg["content"] {
            Value::String(s) => s.clone(),
            Value::Array(parts) => {
                // Handle multi-part content (text + images — text only for now)
                parts.iter()
                    .filter(|p| p["type"] == "text")
                    .filter_map(|p| p["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n")
            }
            other => other.to_string(),
        };

        let label = match role {
            "system"    => "System",
            "assistant" => "Assistant",
            _           => "Human",
        };
        parts.push(format!("{label}: {content}"));
    }

    parts.join("\n\n")
}
