use anyhow::Result;
use serde::{Deserialize, Serialize};

/// All configuration for the gateway.
/// Environment variable names use the `CZG_` prefix.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    /// Bind address (CZG_HOST, default: 0.0.0.0)
    pub host: String,
    /// Bind port (CZG_PORT, default: 8080)
    pub port: u16,
    /// Default Claude model when none specified (CZG_DEFAULT_MODEL)
    pub default_model: String,
    /// Max conversation turns (CZG_MAX_TURNS, default: 10)
    pub max_turns: u32,
    /// Claude CLI subprocess timeout in seconds (CZG_CLI_TIMEOUT, default: 300)
    pub cli_timeout_secs: u64,
    /// Working directory for CLI subprocess (CZG_WORKING_DIR, optional)
    pub working_dir: Option<String>,
    /// Path to claude CLI binary (CZG_CLAUDE_BIN, default: claude)
    pub claude_bin: String,
    /// Whether to enable request/response logging (CZG_DEBUG, default: false)
    pub debug: bool,
}

impl GatewayConfig {
    pub fn load() -> Result<Self> {
        let e = |key: &str, default: &str| -> String {
            std::env::var(key).unwrap_or_else(|_| default.to_string())
        };

        Ok(Self {
            host:             e("CZG_HOST",          "0.0.0.0"),
            port:             e("CZG_PORT",          "8080").parse().unwrap_or(8080),
            default_model:    e("CZG_DEFAULT_MODEL", "claude-sonnet-4-20250514"),
            max_turns:        e("CZG_MAX_TURNS",     "10").parse().unwrap_or(10),
            cli_timeout_secs: e("CZG_CLI_TIMEOUT",   "300").parse().unwrap_or(300),
            working_dir:      std::env::var("CZG_WORKING_DIR").ok(),
            claude_bin:       e("CZG_CLAUDE_BIN",    "claude"),
            debug:            e("CZG_DEBUG",         "false") == "true",
        })
    }
}
