/// Middleware modules for the gateway.
/// Auth middleware is intentionally permissive — the gateway is designed
/// to run locally behind a network boundary, not exposed to the internet.
/// If you expose this publicly, add bearer-token auth here.
pub mod auth;
pub mod logging;
