# ── Stage 1: Build Rust binary ────────────────────────────────────────────────
FROM rust:1.80-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock* ./
COPY src ./src

RUN cargo build --release

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y ca-certificates curl nodejs npm && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Rust binary
COPY --from=builder /app/target/release/claude-zeroclaw /usr/local/bin/claude-zeroclaw

# Copy JS layer
COPY js ./js
RUN cd js && npm install --omit=dev

# Copy config
COPY .env.example .env

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["claude-zeroclaw"]
