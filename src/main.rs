mod config;
mod error;
mod middleware;
mod models;
mod proxy;
mod router;

use anyhow::Result;
use axum::Router;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use tracing_subscriber::{fmt, EnvFilter};

use crate::config::GatewayConfig;

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env
    dotenv::dotenv().ok();

    // Tracing
    fmt()
        .with_env_filter(
            EnvFilter::try_from_env("CZG_LOG")
                .unwrap_or_else(|_| EnvFilter::new("claude_zeroclaw=info,tower_http=warn")),
        )
        .without_time()
        .init();

    let cfg = GatewayConfig::load()?;

    info!("╔═══════════════════════════════════════════╗");
    info!("║       Claude ZeroClaw Gateway v0.1        ║");
    info!("║  OpenAI-compatible endpoint for Claude    ║");
    info!("╚═══════════════════════════════════════════╝");
    info!("  Host:           {}", cfg.host);
    info!("  Port:           {}", cfg.port);
    info!("  Default model:  {}", cfg.default_model);
    info!("  Max turns:      {}", cfg.max_turns);
    info!("  CLI timeout:    {}s", cfg.cli_timeout_secs);

    let app = build_router(cfg.clone());

    let addr: SocketAddr = format!("{}:{}", cfg.host, cfg.port).parse()?;
    info!("  Listening on:   http://{}", addr);
    info!("");
    info!("  Endpoints:");
    info!("    POST /v1/chat/completions");
    info!("    GET  /v1/models");
    info!("    GET  /health");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn build_router(cfg: GatewayConfig) -> Router {
    use axum::routing::{get, post};
    use std::sync::Arc;

    let state = Arc::new(cfg);

    Router::new()
        .route("/v1/chat/completions", post(router::chat::completions))
        .route("/v1/models",           get(router::models::list_models))
        .route("/health",              get(router::health::health_check))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}
