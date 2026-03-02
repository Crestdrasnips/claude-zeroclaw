/// Integration tests for the gateway router.
/// These tests spin up the Axum router in-process and send HTTP requests.
///
/// Run with: cargo test
#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use serde_json::Value;
    use tower::ServiceExt; // for .oneshot()

    use claude_zeroclaw::{build_router_for_test, GatewayConfig};

    fn test_cfg() -> GatewayConfig {
        GatewayConfig {
            host:             "127.0.0.1".into(),
            port:             8080,
            default_model:    "claude-sonnet-4-20250514".into(),
            max_turns:        5,
            cli_timeout_secs: 30,
            working_dir:      None,
            claude_bin:       "echo".into(), // use `echo` as a mock CLI
            debug:            false,
        }
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let app = build_router_for_test(test_cfg());
        let req = Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn models_endpoint_returns_list() {
        let app = build_router_for_test(test_cfg());
        let req = Request::builder()
            .uri("/v1/models")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["object"], "list");
        assert!(json["data"].as_array().unwrap().len() > 0);
    }

    #[tokio::test]
    async fn model_alias_gpt4_maps_to_sonnet() {
        use claude_zeroclaw::models::resolve_model;
        assert_eq!(resolve_model("gpt-4o"), "claude-sonnet-4-20250514");
        assert_eq!(resolve_model("gpt-4"),  "claude-sonnet-4-20250514");
    }

    #[tokio::test]
    async fn model_alias_gpt35_maps_to_haiku() {
        use claude_zeroclaw::models::resolve_model;
        assert_eq!(resolve_model("gpt-3.5-turbo"), "claude-haiku-4-5-20251001");
        assert_eq!(resolve_model("gpt-4o-mini"),   "claude-haiku-4-5-20251001");
    }

    #[tokio::test]
    async fn native_claude_name_passes_through() {
        use claude_zeroclaw::models::resolve_model;
        assert_eq!(resolve_model("claude-opus-4-20250514"), "claude-opus-4-20250514");
    }
}
