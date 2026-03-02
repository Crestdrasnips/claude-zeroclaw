use axum::Json;
use serde_json::{json, Value};

use crate::models::list_openai_models;

/// GET /v1/models — returns all available Claude models in OpenAI list format
pub async fn list_models() -> Json<Value> {
    let models = list_openai_models();
    Json(json!({
        "object": "list",
        "data":   models,
    }))
}
