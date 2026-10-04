const { MongoClient } = require('mongodb');

const STAGING_URL = process.env.TARGET_URL || 'https://cinefuel-staging.sk6216071.workers.dev';
const ADMIN_KEY = process.env.ADMIN_KEY || 'shyam081';
const STAGING_MONGO_URI = 'mongodb+srv://shyam:shyam081@cluster0.fiwla4n.mongodb.net/cinefuel_staging?retryWrites=true&w=majority';

async function req(method, path, body = null, headers = {}, retries = 2) {
  const url = new URL(path, STAGING_URL).toString();
  const reqHeaders = { ...headers };
  let reqBody = null;
  if (body) {
    if (!reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    reqBody = typeof body === 'string' ? body : JSON.stringify(body);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
      const t0 = Date.now();
      const res = await fetch(url, { method, headers: reqHeaders, body: reqBody });
      const duration = Date.now() - t0;
      if ((res.status === 500 || res.status === 502 || res.status === 503) && attempt < retries) {
        continue;
      }
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, headers: res.headers, raw: text, data: json, duration };
    } catch (err) {
      if (attempt < retries) continue;
      return { status: 0, error: err.message, raw: '', data: null, duration: 0 };
    }
  }
}

async function runPhase5CSuite() {
  console.log('================================================================');
  console.log('   CINEFUEL PHASE 5C AUTOMATED VERIFICATION & BENCHMARK SUITE   ');
  console.log(`   Target Worker: ${STAGING_URL}`);
  console.log('================================================================\n');

  const results = [];

  function record(name, pass, details = '') {
    results.push({ name, pass, details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} ${details ? `(${details})` : ''}`);
  }

  // 1. First page catalog (limit 24)
  const p1 = await req('GET', '/api/catalog?limit=24&type=movie');
  const p1Ok = p1.status === 200 && p1.data?.success && Array.isArray(p1.data?.items) && p1.data.items.length === 24;
  record(
    'Catalog Page 1 returns 24 titles (HTTP 200)',
    p1Ok,
    `HTTP ${p1.status}, items: ${p1.data?.items?.length}, total: ${p1.data?.total}, TTFB: ${p1.duration}ms`
  );

  // 2. Next page via cursor
  const nextCursor = p1.data?.nextCursor;
  const p2 = await req('GET', `/api/catalog?cursor=${encodeURIComponent(nextCursor)}&limit=24&type=movie`);
  const p2Ok = p2.status === 200 && p2.data?.success && p2.data?.page === 2 && p2.data?.items?.length === 24;
  record(
    'Catalog Next Page via cursor returns next 24 titles (HTTP 200)',
    p2Ok,
    `HTTP ${p2.status}, page: ${p2.data?.page}, items: ${p2.data?.items?.length}, TTFB: ${p2.duration}ms`
  );

  // 3. Zero duplicate IDs across pages
  const p1Ids = new Set((p1.data?.items || []).map((i) => i.id));
  const duplicates = (p2.data?.items || []).filter((i) => p1Ids.has(i.id));
  record(
    'Zero duplicate movie IDs between Page 1 and Page 2',
    duplicates.length === 0,
    `Overlap count: ${duplicates.length}`
  );

  // 4. Cursor validation & invalid cursor fallback
  const pInvalid = await req('GET', '/api/catalog?cursor=malformed_token_xyz&limit=24&type=movie');
  const invalidOk = pInvalid.status === 200 && pInvalid.data?.success && pInvalid.data?.page === 1;
  record(
    'Invalid cursor token handled gracefully (falls back to page 1)',
    invalidOk,
    `HTTP ${pInvalid.status}, page: ${pInvalid.data?.page}`
  );

  // 5. Empty page when out of bounds
  const pEmpty = await req('GET', '/api/catalog?page=99999&limit=24&type=movie');
  const emptyOk = pEmpty.status === 200 && pEmpty.data?.success && pEmpty.data?.items?.length === 0 && pEmpty.data?.hasMore === false;
  record(
    'Empty page beyond total handles safely (0 items, hasMore: false)',
    emptyOk,
    `HTTP ${pEmpty.status}, items: ${pEmpty.data?.items?.length}, hasMore: ${pEmpty.data?.hasMore}`
  );

  // 6. Movies filtering
  const moviesRes = await req('GET', '/api/catalog?type=movie&limit=24');
  const allMovies = (moviesRes.data?.items || []).every((i) => i.media_type === 'movie');
  record(
    'Movies filtering returns exclusively movie titles',
    moviesRes.status === 200 && allMovies,
    `HTTP ${moviesRes.status}, allMovies: ${allMovies}, count: ${moviesRes.data?.items?.length}`
  );

  // 7. TV filtering
  const tvRes = await req('GET', '/api/catalog?type=tv&limit=24');
  const allTv = (tvRes.data?.items || []).every((i) => i.media_type === 'tv');
  record(
    'TV series filtering returns exclusively TV titles',
    tvRes.status === 200 && allTv,
    `HTTP ${tvRes.status}, allTv: ${allTv}, count: ${tvRes.data?.items?.length}`
  );

  // 8. Deterministic stable ordering
  const p1Again = await req('GET', '/api/catalog?limit=24&type=movie');
  const sameOrder = (p1.data?.items || []).every((item, idx) => item.id === p1Again.data?.items?.[idx]?.id);
  record(
    'Stable deterministic ordering preserved across repeated requests',
    sameOrder,
    `Order matching: ${sameOrder}`
  );

  // 9. Accurate link counts
  const interstellar = (p1.data?.items || []).find((i) => String(i.id) === '157336');
  const linkCountOk = Boolean(interstellar && typeof interstellar.linksCount === 'number' && interstellar.linksCount > 0);
  record(
    'Link count correctly aggregated per title (Interstellar)',
    linkCountOk,
    `Links count: ${interstellar?.linksCount || 'N/A'}`
  );

  // 10. Redis Cache HIT speedup (<500 ms warm request or X-Cache: HIT)
  const warm1 = await req('GET', '/api/catalog?limit=24&type=movie');
  const warm2 = await req('GET', '/api/catalog?limit=24&type=movie');
  const cacheHit = warm2.headers?.get('x-cache') === 'HIT' || warm2.data?.source === 'cache';
  const warmOk = warm2.status === 200 && (warm2.duration < 500 || cacheHit);
  record(
    'Redis warm catalog cache hit response verified (X-Cache: HIT or <500ms)',
    warmOk,
    `Warm request TTFB: ${warm2.duration}ms (status ${warm2.status}, cache: ${warm2.headers?.get('x-cache') || warm2.data?.source || 'N/A'})`
  );

  // 11. Public Page /movies HTTP 200 (No Worker 500/503)
  const moviesPage = await req('GET', '/movies');
  record(
    'Public /movies renders with HTTP 200 (Zero Worker 500/503 resource exhaustion)',
    moviesPage.status === 200,
    `HTTP ${moviesPage.status}, TTFB: ${moviesPage.duration}ms`
  );

  // 12. Public Page /tv HTTP 200 (No Worker 500/503)
  const tvPage = await req('GET', '/tv');
  record(
    'Public /tv renders with HTTP 200 (Zero Worker 500/503 resource exhaustion)',
    tvPage.status === 200,
    `HTTP ${tvPage.status}, TTFB: ${tvPage.duration}ms`
  );

  // 13. Public Homepage / HTTP 200 (No Worker 500/503)
  const homePage = await req('GET', '/');
  record(
    'Public Homepage / renders with HTTP 200 (Zero Worker 500/503 resource exhaustion)',
    homePage.status === 200,
    `HTTP ${homePage.status}, TTFB: ${homePage.duration}ms`
  );

  // 14. Title detail pages (/movie/550, /tv/1396)
  const m550 = await req('GET', '/movie/550');
  const tv1396 = await req('GET', '/tv/1396');
  record(
    'Public detail routes /movie/550 and /tv/1396 render HTTP 200',
    m550.status === 200 && tv1396.status === 200,
    `Movie 550: ${m550.status}, TV 1396: ${tv1396.status}`
  );

  // 15. Admin Pagination: GET /api/users, /api/curated-links, /api/reports, /api/requests
  const adminUsers = await req('GET', '/api/users?page=1&limit=10', null, { 'x-admin-key': ADMIN_KEY });
  const adminLinks = await req('GET', '/api/curated-links?page=1&limit=10', null, { 'x-admin-key': ADMIN_KEY });
  const adminReports = await req('GET', '/api/reports?page=1&limit=10', null, { 'x-admin-key': ADMIN_KEY });
  const adminRequests = await req('GET', '/api/requests?page=1&limit=10', null, { 'x-admin-key': ADMIN_KEY });

  const adminOk =
    adminUsers.status === 200 &&
    adminLinks.status === 200 &&
    adminReports.status === 200 &&
    adminRequests.status === 200 &&
    Array.isArray(adminUsers.data?.users) &&
    adminUsers.data.users.length <= 10;
  record(
    'Admin APIs enforce server-side pagination (limit=10)',
    adminOk,
    `Users: ${adminUsers.data?.users?.length}/${adminUsers.data?.total}, Links status: ${adminLinks.status}, Reports status: ${adminReports.status}, Requests status: ${adminRequests.status}`
  );

  // 16. Security & Credential Hygiene Audit
  const auditRoutes = ['/api/catalog', '/api/users', '/movies', '/tv'];
  let leakFound = false;
  for (const r of auditRoutes) {
    const res = await req('GET', r, null, { 'x-admin-key': ADMIN_KEY });
    if (/passwordHash/i.test(res.raw) || /passwordSalt/i.test(res.raw) || /mongodb\+srv:\/\//i.test(res.raw)) {
      leakFound = true;
    }
  }
  record(
    'Credential sanitization audit: zero passwordHash, passwordSalt, or MongoDB secrets leaked',
    !leakFound,
    leakFound ? 'Credentials leaked!' : '100% clean response payloads'
  );

  // 17. Unauthorized mutation protection
  const unauthPost = await req('POST', '/api/curated-links', { movieId: '999', link: { url: 'https://evil.com' } });
  record(
    'Unauthorized catalog mutation rejected (HTTP 401)',
    unauthPost.status === 401,
    `HTTP ${unauthPost.status}`
  );

  console.log('\n================================================================');
  const passCount = results.filter((r) => r.pass).length;
  console.log(`SUMMARY: ${passCount}/${results.length} PASS`);
  if (passCount === results.length) {
    console.log('RESULT: PASS');
  } else {
    console.log(`RESULT: FAIL (${results.length - passCount} failures)`);
  }
  console.log('================================================================\n');

  if (passCount !== results.length) {
    process.exit(1);
  }
}

runPhase5CSuite().catch((err) => {
  console.error('Phase 5C Suite Error:', err);
  process.exit(1);
});
