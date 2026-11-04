FROM rust:1.85-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --locked --release -p donads-dispatch

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin donads

WORKDIR /app
COPY --from=builder /app/target/release/donads-dispatch /usr/local/bin/donads-dispatch
COPY deploy/entrypoint.sh /usr/local/bin/donads-entrypoint
RUN chmod 0555 /usr/local/bin/donads-dispatch /usr/local/bin/donads-entrypoint \
    && mkdir -p /app/data \
    && chown donads:donads /app/data

ENV DONADS_NETWORK=testnet \
    MONAD_RPC_URL=https://testnet-rpc.monad.xyz \
    DONADS_TASK_STORE=/app/data/tasks.json \
    DONADS_PROFILE_STORE=/app/data/profiles.json \
    DONADS_ROUTINE_STORE=/app/data/routines.json \
    RUST_LOG=donads_dispatch=info,tower_http=info

EXPOSE 8080
ENTRYPOINT ["donads-entrypoint"]
