use axum::{extract::State, Json};
use chrono::Utc;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::config::GatewayConfig;

pub async fn health_check(State(cfg): State<Arc<GatewayConfig>>) -> Json<Value> {
    Json(json!({
        "status":  "ok",
        "service": "claude-zeroclaw",
        "version": env!("CARGO_PKG_VERSION"),
        "time":    Utc::now().to_rfc3339(),
        "config": {
            "default_model": cfg.default_model,
            "max_turns":     cfg.max_turns,
        }
    }))
}
