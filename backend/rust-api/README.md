# CiNEPHiLE — Rust API & Cloudflare R2 Backend Modernization

High-performance, memory-safe, asynchronous backend microservice written in Rust with Axum and Tokio, integrated alongside Cloudflare R2 object storage, authoritative MongoDB Atlas, and Upstash Redis.

---

## 1. Architecture Overview

```text
                               CiNEPHiLE Frontend
                                (Next.js 16.3.8)
                                       │
                                       ▼
                             Edge / API Gateway
                                       │
                      ┌────────────────┴────────────────┐
                      │                                 │
                 Next.js SSR                        Rust API
              (UI & SSR Pages)                  (Axum + Tokio)
                      │                                 │
                      │                        ┌────────┼────────┐
                      │                        │        │        │
                      ▼                        ▼        ▼        ▼
                External APIs               MongoDB   Redis   Cloudflare
              (TMDB, Firebase)             (Atlas)   (Cache)      R2
```

### Separation of Concerns:
- **Next.js**: Retains complete ownership of the user interface, pages, React Server Components, client interactions, responsive layouts, and existing routes.
- **Rust API (`backend/rust-api`)**: Handles high-concurrency API workloads, timing-safe authentication enforcement, cryptographic token verification, broken link reporting, content requests, and Cloudflare R2 presigned URL generation.
- **MongoDB Atlas**: Continues as the **authoritative application database**. No records, links, or documents are altered or deleted.
- **Upstash Redis**: Provides high-speed caching and rate-limiting using preserved namespaces (`cinefuel:production:*`).
- **Cloudflare R2**: Dedicated S3-compatible, zero-egress object storage for media files, video streams, and subtitles.

---

## 2. Environment Configuration

Create a `.env` file inside `backend/rust-api/` based on `.env.example`:

```bash
# Server Port & Binding
PORT=8080
HOST=127.0.0.1
RUST_LOG=info,cinephile_rust_api=debug

# Security & Admin Authentication
ADMIN_SECRET_KEY=your_secure_admin_key_here
ADMIN_PASSWORD=your_secure_admin_password_here

# Authoritative MongoDB Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=cinefuel

# Upstash Redis Cache
REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379

# Cloudflare R2 Object Storage (S3-Compatible)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=cinephile-media
R2_PUBLIC_URL=https://media.cinephile.example.com

# External Integrations
TMDB_API_KEY=your_tmdb_api_key_v3
```

---

## 3. Cloudflare R2 Storage Integration

Cloudflare R2 provides zero-egress object storage. The Rust backend interacts with R2 using an S3-compatible SigV4 client:

### Supported Media Types:
- Video: `video/mp4`, `video/webm`, `video/x-matroska` (.mkv)
- Subtitles: `text/vtt` (.vtt), `text/plain` (.srt)
- Posters/Images: `image/webp`, `image/jpeg`, `image/png`

### Zero-Egress Streaming Strategy:
Rather than streaming large video files through application server memory, clients request a presigned URL via:
`POST /api/media/presign`
The client streams video or downloads subtitles directly from Cloudflare R2 with HTTP Range request support and CDN edge caching.

---

## 4. API Endpoints

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/health` | System health, MongoDB/Redis/R2 status | Public |
| `GET` | `/api/catalog` | Paginated catalog with Redis cache & MongoDB fallback | Public |
| `GET` | `/api/curated-links` | Fetch curated stream/download links for a movie | Public |
| `POST` | `/api/curated-links` | Add new curated link with URL validation | Admin Only |
| `DELETE` | `/api/curated-links` | Delete curated link | Admin Only |
| `POST` | `/api/media/presign` | Generate presigned GET/PUT URL for Cloudflare R2 | Public (GET) / Admin (PUT) |
| `POST` | `/api/media/verify` | Verify R2 object metadata via HTTP HEAD | Public |
| `POST` | `/api/reports` | Submit broken link report | Public |
| `GET` | `/api/reports` | List broken link reports | Admin Only |
| `POST` | `/api/requests` | Submit movie/show request | Public |
| `GET` | `/api/requests` | List user requests | Public |

---

## 5. Security & Authentication Architecture

1. **Constant-Time Verification**: All administrator authentication checks (`x-admin-key`, session signatures) utilize constant-time comparison via the `subtle` crate to prevent timing side-channel attacks.
2. **HMAC-SHA256 Session Tokens**: Admin sessions issue cryptographic tokens with a 4-hour validity window.
3. **URL & Input Sanitization**: URLs submitted for links or reports are restricted to valid `http:`/`https:` protocols, eliminating `javascript:` injection and internal network SSRF.
4. **NoSQL Protection**: All MongoDB queries use strongly typed BSON documents; user-supplied keys starting with `$` are strictly forbidden.

---

## 6. Running in Docker Linux Container

Due to Windows Smart App Control policy blocking local execution of newly generated native `.exe` binaries, the Rust API is containerized inside a hardened Linux container:

```bash
# 1. Build the multi-stage Linux container image
docker build -t cinephile-rust-api:staging ./backend/rust-api

# 2. Run container with environment configuration
docker run -d \
  --name cinephile-rust-api \
  -p 8080:8080 \
  --env-file ./backend/rust-api/.env \
  cinephile-rust-api:staging

# Or using Docker Compose:
docker compose up -d
```

### Local / Staging Container Health & API Verification

```bash
# 1. System Health Check
curl http://localhost:8080/health

# 2. High-Performance Catalog
curl http://localhost:8080/api/catalog?page=1&limit=20

# 3. Media Presigned Streaming URL (Zero-Egress GET)
curl -X POST http://localhost:8080/api/media/presign \
  -H "Content-Type: application/json" \
  -d '{"key": "movies/550/1080p.mp4", "action": "get"}'

# 4. Media Asset Verification (HEAD via R2)
curl -X POST http://localhost:8080/api/media/verify \
  -H "Content-Type: application/json" \
  -d '{"key": "movies/550/1080p.mp4"}'
```

---

## 7. Migration & Rollout Strategy

1. **Phase 1 (Completed)**: Rust service created with full API contracts matching Next.js endpoints.
2. **Phase 2 (Completed)**: Cloudflare R2 integration implemented with AWS SigV4 presigned URL streaming and zero application egress.
3. **Phase 3 (Completed)**: Multi-stage Docker Linux containerization implemented with non-root security and zero credentials baked into images.
4. **Phase 4**: Staging R2 bucket provisioning (once Cloudflare R2 is enabled on account `46f7bef008a04d13a6bd134c3a291006`).
5. **Phase 5**: Real wire network benchmarks against staging R2 bucket.
6. **Phase 6**: Selective routing of high-traffic endpoints (`/api/catalog`, `/api/media/presign`) to Rust backend.

