use axum::{
    body::Body,
    extract::State,
    http::{header, StatusCode},
    response::Response,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_stream::StreamExt;
use tracing::{debug, info};

use crate::{
    config::GatewayConfig,
    error::{GatewayError, GwResult},
    models::resolve_model,
    proxy::{
        cli::{CliRequest, ClaudeCliProxy},
        stream::{make_chunk, make_done, messages_to_prompt, new_request_id},
    },
};

// ─── Request types (OpenAI-compatible) ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub model: Option<String>,
    pub messages: Vec<Value>,
    #[serde(default)]
    pub stream: bool,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

// ─── Handler ─────────────────────────────────────────────────────────────────

pub async fn completions(
    State(cfg): State<Arc<GatewayConfig>>,
    Json(body): Json<ChatRequest>,
) -> Response<Body> {
    let model_name = body.model.as_deref().unwrap_or(&cfg.default_model);
    let model = resolve_model(model_name).to_string();
    let prompt = messages_to_prompt(&body.messages);
    let request_id = new_request_id();

    info!(
        id = %request_id,
        model = %model,
        stream = body.stream,
        "Incoming completion request"
    );
    debug!("Prompt ({} chars): {}…", prompt.len(), &prompt[..prompt.len().min(120)]);

    let cli = ClaudeCliProxy::new((*cfg).clone());
    let cli_req = CliRequest {
        model: model.clone(),
        prompt,
        max_turns: cfg.max_turns,
        session_id: None, // session continuity via JS layer
    };

    if body.stream {
        handle_streaming(cli, cli_req, request_id, model).await
    } else {
        handle_blocking(cli, cli_req, request_id, model).await
    }
}

// ─── Streaming response ───────────────────────────────────────────────────────

async fn handle_streaming(
    cli: ClaudeCliProxy,
    req: CliRequest,
    request_id: String,
    model: String,
) -> Response<Body> {
    let (tx, rx) = mpsc::channel::<Result<String, GatewayError>>(128);

    // Spawn CLI in background
    tokio::spawn(async move {
        cli.stream(&req, tx).await;
    });

    let rid = request_id.clone();
    let mdl = model.clone();

    let stream = ReceiverStream::new(rx).map(move |item| {
        let bytes = match item {
            Ok(line) => {
                let chunk = make_chunk(&rid, &mdl, Some(&line), None);
                bytes::Bytes::from(chunk)
            }
            Err(e) => {
                let err_chunk = format!("data: {{\"error\": \"{e}\"}}\n\n");
                bytes::Bytes::from(err_chunk)
            }
        };
        Ok::<_, std::io::Error>(bytes)
    });

    // Append [DONE] sentinel
    let done_bytes = bytes::Bytes::from(make_done());
    let final_stream = stream.chain(futures::stream::once(async move {
        Ok::<_, std::io::Error>(done_bytes)
    }));

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("X-Accel-Buffering", "no")
        .header("X-Request-Id", &request_id)
        .body(Body::from_stream(final_stream))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(500)
                .body(Body::empty())
                .unwrap()
        })
}

// ─── Blocking response ────────────────────────────────────────────────────────

async fn handle_blocking(
    cli: ClaudeCliProxy,
    req: CliRequest,
    request_id: String,
    model: String,
) -> Response<Body> {
    match cli.run(&req).await {
        Ok(resp) => {
            let body = json!({
                "id":      request_id,
                "object":  "chat.completion",
                "created": Utc::now().timestamp(),
                "model":   model,
                "choices": [{
                    "index":         0,
                    "message": {
                        "role":    "assistant",
                        "content": resp.content,
                    },
                    "finish_reason": "stop",
                }],
                "usage": {
                    "prompt_tokens":     resp.input_tokens,
                    "completion_tokens": resp.output_tokens,
                    "total_tokens":      resp.input_tokens + resp.output_tokens,
                }
            });

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .header("X-Request-Id", &request_id)
                .body(Body::from(serde_json::to_string(&body).unwrap_or_default()))
                .unwrap_or_else(|_| Response::builder().status(500).body(Body::empty()).unwrap())
        }
        Err(e) => {
            let err: GatewayError = e;
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(format!(r#"{{"error":{{"message":"{}","type":"server_error"}}}}"#, err)))
                .unwrap_or_else(|_| Response::builder().status(500).body(Body::empty()).unwrap())
        }
    }
}
