use chrono::Utc;
use serde::{Deserialize, Serialize};

/// All Claude models exposed by the gateway
pub const CLAUDE_MODELS: &[(&str, &str)] = &[
    ("claude-sonnet-4-20250514", "Claude Sonnet 4"),
    ("claude-opus-4-20250514",   "Claude Opus 4"),
    ("claude-haiku-4-5-20251001","Claude Haiku 4.5"),
    // shorthand aliases
    ("sonnet", "Claude Sonnet 4"),
    ("opus",   "Claude Opus 4"),
    ("haiku",  "Claude Haiku 4.5"),
];

/// GPT-alias → canonical Claude model
pub fn resolve_model(requested: &str) -> &'static str {
    match requested {
        // GPT aliases → Sonnet
        "gpt-4o" | "gpt-4" | "gpt-4-turbo" => "claude-sonnet-4-20250514",
        // GPT aliases → Haiku
        "gpt-3.5-turbo" | "gpt-4o-mini"    => "claude-haiku-4-5-20251001",
        // Shorthand
        "sonnet"                            => "claude-sonnet-4-20250514",
        "opus"                              => "claude-opus-4-20250514",
        "haiku"                             => "claude-haiku-4-5-20251001",
        // Pass-through native Claude names
        other                               => {
            if other.starts_with("claude-") {
                // leak is fine — static strings only ever added, never removed
                Box::leak(other.to_string().into_boxed_str())
            } else {
                "claude-sonnet-4-20250514"
            }
        }
    }
}

/// OpenAI-compatible model object
#[derive(Debug, Serialize, Deserialize)]
pub struct ModelObject {
    pub id: &'static str,
    pub object: &'static str,
    pub created: i64,
    pub owned_by: &'static str,
}

pub fn list_openai_models() -> Vec<ModelObject> {
    let ts = Utc::now().timestamp();
    CLAUDE_MODELS
        .iter()
        .map(|(id, _)| ModelObject {
            id,
            object: "model",
            created: ts,
            owned_by: "anthropic",
        })
        .collect()
}
