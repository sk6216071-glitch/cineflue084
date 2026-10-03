const https = require('https');

const BASE_URL = 'https://cinefuel-staging.sk6216071.workers.dev';

function req(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = https.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, data: json || data });
      });
    });
    r.on('error', err => resolve({ status: 'ERROR', error: err.message }));
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('=== TEST 2, 5 & 6: Security, Auth & Failure Resilience Audit ===\n');

  // 1. Unauthenticated Admin Mutation Checks
  console.log('--- 1. Testing Unauthenticated Admin Mutations ---');

  const unauthCuratedPost = await req('POST', '/api/curated-links', {
    movieId: 999999,
    link: { title: 'Hacked Link', url: 'https://malicious-domain.com/bad.mp4' }
  });
  console.log(`POST /api/curated-links (unauth): Status ${unauthCuratedPost.status} -> ${JSON.stringify(unauthCuratedPost.data)}`);

  const unauthCuratedDelete = await req('DELETE', '/api/curated-links', {
    movieId: 999999,
    linkId: 'any-link'
  });
  console.log(`DELETE /api/curated-links (unauth): Status ${unauthCuratedDelete.status} -> ${JSON.stringify(unauthCuratedDelete.data)}`);

  const unauthReportPatch = await req('PATCH', '/api/reports', {
    id: 'rep-fake-id',
    status: 'fixed'
  });
  console.log(`PATCH /api/reports (unauth): Status ${unauthReportPatch.status} -> ${JSON.stringify(unauthReportPatch.data)}`);

  const unauthReportDelete = await req('DELETE', '/api/reports?id=rep-fake-id');
  console.log(`DELETE /api/reports (unauth): Status ${unauthReportDelete.status} -> ${JSON.stringify(unauthReportDelete.data)}`);

  const unauthRequestPatch = await req('PATCH', '/api/requests', {
    id: 'req-fake-id',
    status: 'fulfilled'
  });
  console.log(`PATCH /api/requests (unauth): Status ${unauthRequestPatch.status} -> ${JSON.stringify(unauthRequestPatch.data)}`);

  const unauthRequestDelete = await req('DELETE', '/api/requests?id=req-fake-id');
  console.log(`DELETE /api/requests (unauth): Status ${unauthRequestDelete.status} -> ${JSON.stringify(unauthRequestDelete.data)}`);

  const unauthUserDelete = await req('DELETE', '/api/users?uid=usr_victim');
  console.log(`DELETE /api/users (unauth): Status ${unauthUserDelete.status} -> ${JSON.stringify(unauthUserDelete.data)}`);

  console.log('\n--- 1b. Testing Authenticated Admin Mutations (with x-admin-key) ---');
  const adminSecret = process.env.ADMIN_SECRET_KEY || 'shyam081';
  const authHeaders = { 'x-admin-key': adminSecret };
  const authCuratedPost = await req('POST', '/api/curated-links', {
    movieId: 999999,
    link: { title: 'Test Admin Link', url: 'https://example.com/stream' }
  }, authHeaders);
  console.log(`POST /api/curated-links (auth): Status ${authCuratedPost.status} -> ${JSON.stringify(authCuratedPost.data)}`);

  const authReportPatch = await req('PATCH', '/api/reports', {
    id: 'rep-test-id',
    status: 'investigating'
  }, authHeaders);
  console.log(`PATCH /api/reports (auth): Status ${authReportPatch.status} -> ${JSON.stringify(authReportPatch.data)}`);

  // 2. Sensitive Data Exposure Check in /api/users
  console.log('\n--- 2. Checking /api/users Sensitive Data Exposure ---');
  const regRes = await req('POST', '/api/users/auth', {
    action: 'register',
    email: `sec_test_${Date.now()}@example.com`,
    password: 'SuperSecretPassword123!',
    displayName: 'Security Test Account'
  });
  console.log(`Registration attempt: Status ${regRes.status} -> ${JSON.stringify(regRes.data)}`);

  const usersList = await req('GET', '/api/users');
  console.log(`GET /api/users status: ${usersList.status}, total users: ${usersList.data?.total}`);
  const userSample = Array.isArray(usersList.data?.users) ? usersList.data.users[0] : null;
  if (userSample) {
    console.log('Sample User Keys:', Object.keys(userSample));
    console.log('Exposes passwordHash?', 'passwordHash' in userSample);
    console.log('Exposes passwordSalt?', 'passwordSalt' in userSample);
  } else {
    console.log('User list returned safely: No users leaked.');
  }

  // 3. Telegram Webhook Authentication Check
  console.log('\n--- 3. Checking Telegram Webhook Authentication & Secrets ---');
  const fakeWebhookNoSecret = await req('POST', '/api/telegram', {
    update_id: 12345,
    message: { message_id: 999, chat: { id: 111111 }, text: '/help' }
  });
  console.log(`POST /api/telegram (no secret): Status ${fakeWebhookNoSecret.status} -> ${JSON.stringify(fakeWebhookNoSecret.data)}`);

  const fakeWebhookWrongSecret = await req('POST', '/api/telegram', {
    update_id: 12345,
    message: { message_id: 999, chat: { id: 111111 }, text: '/help' }
  }, { 'x-telegram-bot-api-secret-token': 'wrong-token' });
  console.log(`POST /api/telegram (wrong secret): Status ${fakeWebhookWrongSecret.status} -> ${JSON.stringify(fakeWebhookWrongSecret.data)}`);

  const tgWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || 'cf_staging_tg_webhook_secret_2026';
  const fakeWebhookValidSecret = await req('POST', '/api/telegram', {
    update_id: 12345,
    message: { message_id: 999, chat: { id: 111111 }, text: '/help' }
  }, { 'x-telegram-bot-api-secret-token': tgWebhookSecret });
  console.log(`POST /api/telegram (valid secret): Status ${fakeWebhookValidSecret.status} -> ${JSON.stringify(fakeWebhookValidSecret.data)}`);

  // 4. Persistence Failure Handling Check
  console.log('\n--- 4. Checking Persistence Failure Handling ---');
  const reportSubmit = await req('POST', '/api/reports', {
    movieId: '999999',
    mediaType: 'movie',
    reason: 'broken_link',
    details: 'Testing 503 error handling on unwritable backend'
  });
  console.log(`POST /api/reports without writable DB: Status ${reportSubmit.status} -> ${JSON.stringify(reportSubmit.data)}`);

  // 5. Secret Leakage Audit in Client HTML & Responses
  console.log('\n--- 5. Secret Leakage Audit in Client Bundles & HTML ---');
  const sensitivePatterns = [
    /mongodb\+srv:\/\//i,
    /upstash/i,
    /shyam081/i,
    /cf_staging_tg_webhook_secret_2026/i,
    /TELEGRAM_BOT_TOKEN/i,
    /MONGODB_URI/i,
    /UPSTASH_REDIS_REST_TOKEN/i
  ];

  const pagesToScan = ['/', '/admin', '/movie/550', '/api/catalog'];
  for (const page of pagesToScan) {
    const pageRes = await req('GET', page);
    const text = typeof pageRes.data === 'string' ? pageRes.data : JSON.stringify(pageRes.data);
    const leaked = [];
    for (const pattern of sensitivePatterns) {
      if (pattern.test(text)) leaked.push(pattern.toString());
    }
    console.log(`Page [${page}] leaked sensitive tokens: ${leaked.length > 0 ? leaked.join(', ') : 'NONE (Clean)'}`);
  }
})();
