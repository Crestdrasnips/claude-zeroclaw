use axum::{extract::Request, middleware::Next, response::Response};
use tracing::info;
use uuid::Uuid;

/// Simple request/response logger — attaches a unique request ID to each request.
pub async fn request_logger(mut request: Request, next: Next) -> Response {
    let request_id = Uuid::new_v4().to_string();
    let method = request.method().clone();
    let uri = request.uri().clone();

    request.headers_mut().insert(
        "x-request-id",
        request_id.parse().unwrap(),
    );

    let response = next.run(request).await;

    info!(
        method = %method,
        path   = %uri.path(),
        status = %response.status().as_u16(),
        id     = %request_id,
    );

    response
}
