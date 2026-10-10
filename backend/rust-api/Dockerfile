# ==============================================================================
# CiNEPHiLE Rust API - Multi-Stage Production & Staging Dockerfile
#
# Principles:
# 1. Compiles entirely inside a Linux container (no host OS dependencies)
# 2. Minimal runtime image containing only the compiled binary and ca-certificates
# 3. Runs as unprivileged non-root user (UID 10001)
# 4. Zero secrets or credentials baked into image; supplied via runtime ENV
# ==============================================================================

# Stage 1: Build stage
FROM rust:1-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependency builds
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && \
    echo 'fn main() { println!("dummy"); }' > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source code and build actual release binary
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Stage 2: Minimal hardened runtime
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# Install root TLS CA certificates and curl for container healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN groupadd -g 10001 cinephile && \
    useradd -u 10001 -g cinephile -s /bin/sh -M cinephile

# Copy release binary from builder
COPY --from=builder /app/target/release/cinephile-rust-api /usr/local/bin/cinephile-rust-api
RUN chmod +x /usr/local/bin/cinephile-rust-api && \
    chown cinephile:cinephile /usr/local/bin/cinephile-rust-api

# Security: drop privileges to non-root user
USER cinephile

# Environment defaults (can be overridden at runtime)
ENV HOST=0.0.0.0 \
    PORT=8080 \
    RUST_LOG=info,cinephile_rust_api=info

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/usr/local/bin/cinephile-rust-api"]
