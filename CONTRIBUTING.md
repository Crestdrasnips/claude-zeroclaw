# Contributing to Claude ZeroClaw

Thank you for your interest in contributing! Here's how to get started.

## Development setup

```bash
# Clone repo
git clone https://github.com/Crestdrasnips/claude-zeroclaw
cd claude-zeroclaw

# Build Rust
cargo build

# Install JS deps
cd js && npm install
```

## Running tests

```bash
# Rust unit + integration tests
cargo test

# JS tests
cd js && npm test
```

## Code style

- Rust: `cargo fmt` + `cargo clippy --deny warnings`
- JS: standard Node.js style, no transpiler needed (ESM modules)

## Pull request guidelines

- One feature or fix per PR
- Include tests for new functionality
- Update README if you add new config variables or endpoints
- Describe what problem your PR solves

## Reporting bugs

Open an issue with: OS version, gateway version (`/health`), steps to reproduce, and the error output.
