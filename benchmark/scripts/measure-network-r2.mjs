import { performance } from 'perf_hooks';

console.log('=================================================================');
console.log('  CiNEPHiLE — Real Network Edge Throughput & Range Measurement   ');
console.log('=================================================================\n');

async function measureDownload(url, label, headers = {}) {
  const t0 = performance.now();
  let ttfb = 0;
  let totalBytes = 0;

  try {
    const res = await fetch(url, { headers });
    ttfb = Number((performance.now() - t0).toFixed(2));

    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
    }
    const totalElapsedSec = (performance.now() - t0) / 1000;
    const mb = totalBytes / 1024 / 1024;
    const mbps = Number((mb / totalElapsedSec).toFixed(2));

    console.log(`[${label}]`);
    console.log(`  HTTP Status:       ${res.status}`);
    console.log(`  Content-Range:     ${res.headers.get('content-range') || 'None'}`);
    console.log(`  Content-Length:    ${res.headers.get('content-length')}`);
    console.log(`  CF-Ray:            ${res.headers.get('cf-ray') || 'N/A'}`);
    console.log(`  Bytes Received:    ${totalBytes.toLocaleString()} bytes (${mb.toFixed(2)} MB)`);
    console.log(`  TTFB:              ${ttfb} ms`);
    console.log(`  Total Elapsed:     ${totalElapsedSec.toFixed(3)} s`);
    console.log(`  Real Network MB/s: ${mbps} MB/s\n`);

    return {
      status: res.status,
      bytes: totalBytes,
      ttfb,
      elapsedSec: totalElapsedSec,
      mbps,
    };
  } catch (err) {
    console.error(`[${label}] Error:`, err.message);
    return null;
  }
}

(async () => {
  // Test 1: 10MB Real Network Transfer from Cloudflare Edge
  await measureDownload(
    'https://speed.cloudflare.com/__down?bytes=10485760',
    'Cloudflare Edge 10 MB Real Network Download'
  );

  // Test 2: 25MB Real Network Transfer from Cloudflare Edge
  await measureDownload(
    'https://speed.cloudflare.com/__down?bytes=26214400',
    'Cloudflare Edge 25 MB Real Network Download'
  );

  // Test 3: Real Network HTTP Range Request (bytes=0-1048575, exact 1MB slice)
  await measureDownload(
    'https://speed.cloudflare.com/__down?bytes=10485760',
    'Cloudflare Edge 1 MB Range Request (bytes=0-1048575)',
    { Range: 'bytes=0-1048575' }
  );

  // Test 4: Real Network HTTP Range Request (bytes=1048576-5242879, exact 4MB slice)
  await measureDownload(
    'https://speed.cloudflare.com/__down?bytes=10485760',
    'Cloudflare Edge 4 MB Range Request (bytes=1048576-5242879)',
    { Range: 'bytes=1048576-5242879' }
  );
})();
