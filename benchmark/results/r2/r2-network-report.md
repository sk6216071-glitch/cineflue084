# CiNEPHiLE — Staging R2 Network Benchmark & Provisioning Report

## 1. R2 Provisioning Status

- **Account ID**: `46f7bef008a04d13a6bd134c3a291006`
- **Account Purpose**: Staging / Staging Worker Environment (`cinefuel-staging`)
- **R2 Enabled**: **NO** (Cloudflare API Code: 10042)
- **API Response**: `Please enable R2 through the Cloudflare Dashboard. [code: 10042]`
- **Benchmark Bucket**: `cinephile-r2-benchmark-*` (NOT CREATED)
- **Bucket Creation Result**: **HALTED** per Phase 3 Safety Protocol
- **Benchmark Prefix**: `benchmarks/r2-throughput/`

---

## 2. Upload Results

| Size | Bytes | Seconds | MB/s | Mbps | HTTP | Errors |
|---|---:|---:|---:|---:|---:|---:|
| 100 MB | N/A | N/A | N/A | N/A | N/A | Halted: R2 Not Enabled |
| 500 MB | N/A | N/A | N/A | N/A | N/A | Halted: R2 Not Enabled |
| 1 GB | N/A | N/A | N/A | N/A | N/A | Halted: R2 Not Enabled |

---

## 3. Download Results

| Size | Bytes | Seconds | MB/s | Mbps | TTFB | HTTP |
|---|---:|---:|---:|---:|---:|---:|
| 100 MB | N/A | N/A | N/A | N/A | N/A | Halted: R2 Not Enabled |
| 500 MB | N/A | N/A | N/A | N/A | N/A | Halted: R2 Not Enabled |
| 1 GB | N/A | N/A | N/A | N/A | N/A | Halted: R2 Not Enabled |

*Note: As measured in the previous baseline edge test, the live internet throughput from Cloudflare edge nodes to this machine is empirically 3.16 – 3.89 MB/s (~25–31 Mbps) with TTFB of 110–413 ms.*

---

## 4. Range Results

| Range | Expected | Received | HTTP | Correct |
|---|---:|---:|---:|---|
| 0–9,999,999 | 10,000,000 bytes | N/A | N/A | Halted: R2 Not Enabled |
| 10,000,000–19,999,999 | 10,000,000 bytes | N/A | N/A | Halted: R2 Not Enabled |
| 50,000,000–59,999,999 | 10,000,000 bytes | N/A | N/A | Halted: R2 Not Enabled |
| 100,000,000–109,999,999 | 10,000,000 bytes | N/A | N/A | Halted: R2 Not Enabled |

---

## 5. Concurrency Results

| Concurrent Streams | Total MB | Seconds | Aggregate MB/s | Mbps | Errors |
|---:|---:|---:|---:|---:|---:|
| 1 | N/A | N/A | N/A | N/A | Halted |
| 5 | N/A | N/A | N/A | N/A | Halted |
| 10 | N/A | N/A | N/A | N/A | Halted |
| 25 | N/A | N/A | N/A | N/A | Halted |
| 50 | N/A | N/A | N/A | N/A | Halted |

---

## 6. Integrity

- **Upload integrity**: **NOT TESTED** (Halted per Phase 3)
- **Download integrity**: **NOT TESTED** (Halted per Phase 3)
- **Range integrity**: **NOT TESTED** (Halted per Phase 3)

---

## 7. Architecture Conclusion

1. **What is the measured direct R2 upload throughput?**
   - **Unmeasured**. R2 is currently disabled on Cloudflare Account `46f7bef008a04d13a6bd134c3a291006` (`API Error 10042`).
2. **What is the measured direct R2 download throughput?**
   - **Unmeasured** from an R2 bucket. Public Cloudflare CDN edge transfer was measured at 3.16 – 3.89 MB/s on the test machine's network connection.
3. **What is the measured range-request performance?**
   - **Unmeasured** over live R2 network wire. (In-memory slice verification passed 100%, but live wire transfer requires an active bucket).
4. **What is the aggregate concurrent throughput?**
   - **Unmeasured** against R2 origin.
5. **Is R2 suitable for CiNEPHiLE media delivery based on this benchmark?**
   - R2 architecture (S3 SigV4 presigned URLs, zero egress) is conceptually and structurally optimal for video delivery, but live network throughput cannot be benchmarked until R2 is enabled on the Cloudflare Dashboard for account `46f7bef008a04d13a6bd134c3a291006`.
6. **Does application proxying materially reduce throughput, if tested?**
   - Architectural analysis confirms proxying video streams through application servers causes memory saturation, whereas direct R2 presigned URLs offload bandwidth to Cloudflare Edge.
7. **Is CDN performance actually verified?**
   - **No**. CDN throughput test was skipped because no staging CDN/custom-domain delivery path is configured for R2.
8. **What remains unverified?**
   - Live network upload throughput (MB/s) to an active R2 bucket.
   - Live network download throughput (MB/s) and TTFB from an active R2 origin.
   - Multi-client concurrent network saturation against R2.

---

## 8. Final Production Safety Check

- **Production R2 objects modified**: **0**
- **Production R2 buckets modified**: **0**
- **Production MongoDB writes**: **0**
- **Production MongoDB connections**: **0**
- **Production Redis writes**: **0**
- **Production Redis flushes**: **0**
- **Production Worker deployments**: **0**
- **Production DNS changes**: **0**
- **Production environment changes**: **0**
- **Production application changes**: **0**

---

## 9. Final Status

```text
STATUS: BLOCKED — R2 NOT ENABLED
```
