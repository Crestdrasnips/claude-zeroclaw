use anyhow::Result;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use tracing::{debug, warn};

use crate::config::GatewayConfig;
use crate::error::GatewayError;

/// A single turn request sent to the Claude CLI
#[derive(Debug, Clone)]
pub struct CliRequest {
    pub model: String,
    pub prompt: String,
    pub max_turns: u32,
    pub session_id: Option<String>,
}

/// Response from a single CLI invocation
#[derive(Debug, Clone)]
pub struct CliResponse {
    pub content: String,
    pub model: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

pub struct ClaudeCliProxy {
    cfg: GatewayConfig,
}

impl ClaudeCliProxy {
    pub fn new(cfg: GatewayConfig) -> Self {
        Self { cfg }
    }

    /// Run the Claude CLI and collect full response (non-streaming).
    pub async fn run(&self, req: &CliRequest) -> Result<CliResponse, GatewayError> {
        let mut cmd = self.build_command(req);

        debug!("Spawning Claude CLI: model={} session={:?}", req.model, req.session_id);

        let child = cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
            .map_err(|e| GatewayError::CliError(format!("Failed to spawn claude CLI: {e}")))?;

        let result = timeout(
            Duration::from_secs(self.cfg.cli_timeout_secs),
            async move {
                let output = child.wait_with_output().await
                    .map_err(|e| GatewayError::CliError(e.to_string()))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    warn!("Claude CLI exited with error: {}", stderr);
                    return Err(GatewayError::CliError(stderr.into_owned()));
                }

                let raw = String::from_utf8_lossy(&output.stdout).into_owned();
                Ok(raw)
            },
        )
        .await
        .map_err(|_| GatewayError::Timeout(self.cfg.cli_timeout_secs))?
        .map_err(|e: GatewayError| e)?;

        Ok(CliResponse {
            content:       result.trim().to_string(),
            model:         req.model.clone(),
            input_tokens:  0, // Claude CLI does not expose token counts
            output_tokens: 0,
        })
    }

    /// Stream the Claude CLI output line-by-line via an async channel.
    pub async fn stream(
        &self,
        req: &CliRequest,
        tx: tokio::sync::mpsc::Sender<Result<String, GatewayError>>,
    ) {
        let mut cmd = self.build_command(req);

        let mut child = match cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(Err(GatewayError::CliError(format!("Spawn failed: {e}")))).await;
                return;
            }
        };

        let stdout = child.stdout.take().unwrap();
        let mut lines = BufReader::new(stdout).lines();

        let timeout_dur = Duration::from_secs(self.cfg.cli_timeout_secs);

        match timeout(timeout_dur, async {
            while let Ok(Some(line)) = lines.next_line().await {
                if tx.send(Ok(line)).await.is_err() {
                    break; // receiver dropped (client disconnected)
                }
            }
        })
        .await
        {
            Ok(_) => {}
            Err(_) => {
                let _ = tx.send(Err(GatewayError::Timeout(self.cfg.cli_timeout_secs))).await;
            }
        }

        let _ = child.wait().await;
    }

    fn build_command(&self, req: &CliRequest) -> Command {
        let mut cmd = Command::new(&self.cfg.claude_bin);
        cmd.arg("--model").arg(&req.model);
        cmd.arg("--max-turns").arg(req.max_turns.to_string());
        cmd.arg("--output-format").arg("stream-json");
        cmd.arg("--no-color");

        if let Some(session) = &req.session_id {
            cmd.arg("--resume").arg(session);
        }

        if let Some(dir) = &self.cfg.working_dir {
            cmd.current_dir(dir);
        }

        // Pipe the prompt via stdin to avoid shell escaping issues
        cmd.arg("-p").arg(&req.prompt);
        cmd.stdin(Stdio::null());

        cmd
    }
}
