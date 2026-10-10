# CiNEPHiLE Benchmark Results Directory

This directory contains automated, reproducible benchmark and security test results comparing Next.js API performance, Cloudflare R2 object storage integration, and the Rust/Axum modernization architecture.

---

## Output Files

1. **`CiNEPHiLE-Rust-vs-Next-Benchmark-Report.md`**: Comprehensive final engineering evaluation, latency percentiles, throughput tables, security validations, and architectural recommendations.
2. **`api-performance.json`**: Exact measured latency distributions (p50, p90, p95, p99, min, max), throughput (req/s), and error rates across concurrency levels (1, 10, 50, 100).
3. **`api-compatibility.json`**: Endpoint contract compatibility matrix comparing status codes, JSON payload schemas, and authentication behavior.
4. **`r2-performance.json`**: Cloudflare R2 presigned URL generation, synthetic media Range request verification, and edge delivery telemetry.
5. **`resource-usage.json`**: Memory (RSS, Heap) and runtime resource profiling.
6. **`security-tests.json`**: Automated security assertions (path traversal, unauthorized PUT rejection, empty key validation).
7. **`raw/`**: Raw JSON benchmark captures.
