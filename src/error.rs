use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GatewayError {
    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Claude CLI error: {0}")]
    CliError(String),

    #[error("CLI timeout after {0}s")]
    Timeout(u64),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for GatewayError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            GatewayError::ModelNotFound(_) => (StatusCode::NOT_FOUND, "model_not_found", self.to_string()),
            GatewayError::BadRequest(_)    => (StatusCode::BAD_REQUEST, "invalid_request_error", self.to_string()),
            GatewayError::Timeout(_)       => (StatusCode::GATEWAY_TIMEOUT, "timeout", self.to_string()),
            _                              => (StatusCode::INTERNAL_SERVER_ERROR, "server_error", self.to_string()),
        };

        // OpenAI-compatible error envelope
        let body = json!({
            "error": {
                "message": message,
                "type": code,
                "code": code
            }
        });

        (status, Json(body)).into_response()
    }
}

pub type GwResult<T> = Result<T, GatewayError>;
