/// Optional bearer-token auth layer.
///
/// When CZG_API_KEY is set, every request must include:
///   Authorization: Bearer <CZG_API_KEY>
///
/// Most tools that speak OpenAI format send an API key — if you don't care
/// about auth (local use), leave CZG_API_KEY unset and all requests pass.
use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

pub async fn optional_auth(request: Request, next: Next) -> Result<Response, StatusCode> {
    let expected = std::env::var("CZG_API_KEY").ok();

    if let Some(key) = expected {
        let auth_header = request
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok());

        match auth_header {
            Some(h) if h == format!("Bearer {key}") => {}
            _ => return Err(StatusCode::UNAUTHORIZED),
        }
    }

    Ok(next.run(request).await)
}
