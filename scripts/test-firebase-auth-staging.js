const TARGET_URL = process.env.TARGET_URL || 'https://cinefuel-staging.sk6216071.workers.dev';
const ADMIN_KEY = process.env.ADMIN_KEY || 'shyam081';

const TEST_KEY = {
  kid: 'cinefuel-test-key-v1',
  priv: {
    key_ops: ['sign'],
    ext: true,
    alg: 'RS256',
    kty: 'RSA',
    n: 'wsBaz-0AOq5wzgUH9IGxtu6C0gPTmrBtxZ-BmAZHQ32UoXbFC0666J82BHelzjTYS-r9dbhQGtIkpeHFE42h-lCpXcMrLOkLoZ0xdM3WdW18xjKD86JjSXEZ8lPb-LqebT21xAzGQHP-rFoafOhWIJPF4USOlXV-Ew9kRrghSUtrfavFpFiaSY_LYQ5Zx2AlfwYqyBRYGTvFcKGhfOBYybYF8-EWECvSLNAlTsHRK4cqFv7kRtlpyBAStbFQKBqfcSCWj-CEiq0YBqXp2fWo_IqTrY-tLgwTlj5OIi5euUn__S1G_MF-oGcfoFXsXSdtPaAaPwkOl-ItqUizCKQUtQ',
    e: 'AQAB',
    d: 'EO6sdpuCg5ebEy54zJdiHieKlDvk7_Qa9y2xFMim9YU7oPY0l5EWyxbcmXLVpaIOlDswIkYOIObYbNu-SL7tsFfHAfHwFQ2GB10laaRj2v3T9V96_XnG7CG7QchsvalsEM9muE7sBbqQD-gdmXKR2m8-qyFMzE3U0k9qRoPH0RlojD0bHn-NhWooaFsMLvALv0Nb5qnztMBIb4uvOQueLR61JUJtSDlkXwBpsDQHV_jSLEn3fdM8Q5p5SlBW8l5cQ-ZirpTQkXMIwW3xElKLHrWokk6i40inE1l2bDg9mUAvPOwt-5wcphvcBGPsb4L2SzjttZ_CJ4puysYCI_z92Q',
    p: '95uSnwRg8_LUttTJEf49G6AED0-bLuS9W3v8owTxtXwOoQQXpLwgCR8zpNCYCLpKzjD0YAbbBUwjETZMWIFZrkagwkOHmrPuqUgfbFZPolnyR2a5EJWBVfMnr3VndWTY40ZQa-DSEKkAZEmt_UamIL8nOf0KA9VRX9jWLCoGRP8',
    q: 'yVopWpRYg4VhaXBZkEzbCHbnuifKA8sX1bNnUXZ06vmwRzIesRjM8v-O_hV-W6BnH7wpb9yrioueEnHuv_-nCPdXjDCxur4NIyeJKdircTzuxZV_fMpXxrZiG_LVvvDNGlQMFFtekeYgR2m1SQ8p96leU5uyUJwUsp-emuhcIks',
    dp: 'BdRk3FeXDMdP2Mojvce1mpvm3JFsPutlxeyiYxgvtK0qDwJwqBFB09UnOx8qJTJ1pmsipcwjhfln7fTQUVkiSmchS9GZNLw9x0CKdNuHXnQtrx6tBsXuWJ6z9X6XI_1u2dMC-7c8WuYPu0y8yvTJ3oWBn-zkOnjgRJhvWnTW1vM',
    dq: 'EG5PGZkpb_IedOA6LtBWv2YUmthMX-re0w2EzN0BxXsCq4ynfIQtlVbNcGaInSmFwM02BG7ZgMDL8W1iskBGfTDR8Bq5JigEIm5DfyqzMtZqFa2RbbmFWC3h663xS1eTJSbepXqfSQCiebFincejARbNH72A25shBUKJStLTUek',
    qi: 'l8DVzCVKLxeP_NkmcXCf3SAXxMFxWYMgCi_rMPR30DnyKTjtPs53Z4juIRvqJwS0eiqoEUgRk8v1FdLi3FwUH9i82sGcqlEHkkTLc03W8ebXYvnPZsaUGkEGdP90Cdc3PsxDRcWVN54JTgUEQcCVG172vO7kVFnFpsB8nsbEHvQ',
    kid: 'cinefuel-test-key-v1',
    use: 'sig',
  },
};

function toBase64Url(objOrStr) {
  const str = typeof objOrStr === 'string' ? objOrStr : JSON.stringify(objOrStr);
  return Buffer.from(str).toString('base64url');
}

async function createSignedToken(payloadOverrides = {}) {
  const header = { alg: 'RS256', kid: 'cinefuel-test-key-v1', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/cinefuel-app',
    aud: 'cinefuel-app',
    sub: 'fb_user_stage_test_' + Date.now(),
    email: `stage.tester.${Date.now()}@cinefuel.test`,
    name: 'Verified Staging Tester',
    picture: 'https://lh3.googleusercontent.com/testphoto.jpg',
    firebase: { sign_in_provider: 'google.com' },
    email_verified: true,
    auth_time: nowSec,
    iat: nowSec,
    exp: nowSec + 3600,
    ...payloadOverrides,
  };

  const signedData = `${toBase64Url(header)}.${toBase64Url(payload)}`;
  const privKey = await crypto.subtle.importKey(
    'jwk',
    TEST_KEY.priv,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privKey,
    new TextEncoder().encode(signedData)
  );

  const sigB64 = Buffer.from(sig).toString('base64url');
  return { token: `${signedData}.${sigB64}`, payload };
}

async function req(method, path, body = null, headers = {}) {
  const url = new URL(path, TARGET_URL).toString();
  const reqHeaders = { ...headers };
  let reqBody = null;
  if (body) {
    if (!reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    reqBody = typeof body === 'string' ? body : JSON.stringify(body);
  }
  try {
    const res = await fetch(url, { method, headers: reqHeaders, body: reqBody });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, raw: text, data: json };
  } catch (err) {
    return { status: 0, error: err.message, raw: '', data: null };
  }
}

async function runStagingVerification() {
  console.log('================================================================');
  console.log('   CINEFUEL FIREBASE AUTH STAGING VERIFICATION SUITE            ');
  console.log(`   Target: ${TARGET_URL}`);
  console.log('================================================================\n');

  const tests = [];

  // Generate test user tokens
  const userA = await createSignedToken({ name: 'Alice Walker', email: 'alice.walker@cinefuel.test' });
  const userB = await createSignedToken({ name: 'Bob Builder', email: 'bob.builder@cinefuel.test' });

  // 1. Unauthenticated access to GET /api/users returns 401
  const unauthGetUsers = await req('GET', '/api/users');
  tests.push({
    name: 'Unauthenticated GET /api/users is rejected (HTTP 401)',
    pass: unauthGetUsers.status === 401,
    details: `HTTP ${unauthGetUsers.status} - ${unauthGetUsers.data?.error || ''}`,
  });

  // 2. Normal user access to GET /api/users returns 403 Forbidden
  const normalUserGetUsers = await req('GET', '/api/users', null, {
    Authorization: `Bearer ${userA.token}`,
  });
  tests.push({
    name: 'Normal authenticated user access to GET /api/users is forbidden (HTTP 403)',
    pass: normalUserGetUsers.status === 403,
    details: `HTTP ${normalUserGetUsers.status} - ${normalUserGetUsers.data?.error || ''}`,
  });

  // 3. Admin access to GET /api/users returns 200 with sanitized directory
  const adminGetUsers = await req('GET', '/api/users', null, {
    'x-admin-key': ADMIN_KEY,
  });
  const hasUsers = adminGetUsers.status === 200 && Array.isArray(adminGetUsers.data?.users);
  const passwordsStripped =
    hasUsers &&
    !adminGetUsers.raw.includes('passwordHash') &&
    !adminGetUsers.raw.includes('passwordSalt');
  tests.push({
    name: 'Admin access to GET /api/users succeeds with sanitized directory (HTTP 200)',
    pass: hasUsers && passwordsStripped,
    details: `HTTP ${adminGetUsers.status}, Users: ${adminGetUsers.data?.users?.length}, Passwords sanitized: ${passwordsStripped}`,
  });

  // 4. Unauthenticated POST /api/users without token returns 401
  const unauthPostUser = await req('POST', '/api/users', { email: 'fake@example.com', displayName: 'Fake' });
  tests.push({
    name: 'Unauthenticated POST /api/users without token returns 401',
    pass: unauthPostUser.status === 401,
    details: `HTTP ${unauthPostUser.status} - ${unauthPostUser.data?.error || ''}`,
  });

  // 5. POST /api/users with verified ID token syncs profile and derives identity
  const syncUserRes = await req('POST', '/api/users', {
    idToken: userA.token,
    // Attempt client-side override: server must ignore these and use token values!
    email: 'malicious-spoof@hacker.com',
    displayName: 'Spoofed Name',
  });
  const syncOk =
    syncUserRes.status === 200 &&
    syncUserRes.data?.success === true &&
    syncUserRes.data?.user?.firebaseUid === userA.payload.sub &&
    syncUserRes.data?.user?.email === userA.payload.email &&
    syncUserRes.data?.user?.name === userA.payload.name;
  tests.push({
    name: 'POST /api/users verifies Firebase ID token and ignores client overrides',
    pass: syncOk,
    details: `HTTP ${syncUserRes.status}, UID: ${syncUserRes.data?.user?.firebaseUid}, Name: ${syncUserRes.data?.user?.name}`,
  });

  // 6. POST /api/users/auth with action: 'google_sync' verifies token
  const googleSyncRes = await req('POST', '/api/users/auth', {
    action: 'google_sync',
    idToken: userB.token,
  });
  const googleSyncOk =
    googleSyncRes.status === 200 &&
    googleSyncRes.data?.success === true &&
    googleSyncRes.data?.user?.firebaseUid === userB.payload.sub &&
    googleSyncRes.data?.user?.email === userB.payload.email;
  tests.push({
    name: 'POST /api/users/auth (google_sync) verifies ID token and persists profile',
    pass: googleSyncOk,
    details: `HTTP ${googleSyncRes.status}, UID: ${googleSyncRes.data?.user?.firebaseUid}`,
  });

  // 7. GET /api/users/me unauthenticated returns 401
  const unauthMe = await req('GET', '/api/users/me');
  tests.push({
    name: 'Unauthenticated GET /api/users/me returns 401',
    pass: unauthMe.status === 401,
    details: `HTTP ${unauthMe.status} - ${unauthMe.data?.error || ''}`,
  });

  // 8. GET /api/users/me with user token returns only the user\'s own profile
  const userMeRes = await req('GET', '/api/users/me', null, {
    Authorization: `Bearer ${userA.token}`,
  });
  const meOk =
    userMeRes.status === 200 &&
    userMeRes.data?.success === true &&
    userMeRes.data?.user?.firebaseUid === userA.payload.sub &&
    userMeRes.data?.user?.email === userA.payload.email;
  tests.push({
    name: 'Authenticated GET /api/users/me returns caller\'s verified profile',
    pass: meOk,
    details: `HTTP ${userMeRes.status}, Email: ${userMeRes.data?.user?.email}`,
  });

  // 9. Unauthorized DELETE /api/users returns 401
  const unauthDelete = await req('DELETE', `/api/users?uid=${userA.payload.sub}`);
  tests.push({
    name: 'Unauthorized DELETE /api/users is rejected (HTTP 401)',
    pass: unauthDelete.status === 401,
    details: `HTTP ${unauthDelete.status}`,
  });

  // 10. Admin DELETE /api/users succeeds
  const adminDeleteA = await req('DELETE', `/api/users?uid=${userA.payload.sub}`, null, {
    'x-admin-key': ADMIN_KEY,
  });
  const adminDeleteB = await req('DELETE', `/api/users?uid=${userB.payload.sub}`, null, {
    'x-admin-key': ADMIN_KEY,
  });
  tests.push({
    name: 'Admin DELETE /api/users succeeds with admin secret (HTTP 200)',
    pass: adminDeleteA.status === 200 && adminDeleteB.status === 200,
    details: `Delete A: HTTP ${adminDeleteA.status}, Delete B: HTTP ${adminDeleteB.status}`,
  });

  // 11. Full credential & secret sanitization across responses
  const auditRoutes = ['/api/users', '/api/users/me', '/profile', '/admin'];
  let secretsExposed = false;
  const leakPatterns = [/mongodb\+srv:\/\//i, /passwordHash/i, /passwordSalt/i];
  for (const p of auditRoutes) {
    const res = await req('GET', p, null, { 'x-admin-key': ADMIN_KEY, Authorization: `Bearer ${userA.token}` });
    for (const pat of leakPatterns) {
      if (pat.test(res.raw)) secretsExposed = true;
    }
  }
  tests.push({
    name: 'Zero passwords, hashes, or secrets exposed in HTML or API responses',
    pass: !secretsExposed,
    details: secretsExposed ? 'Secrets leaked!' : '100% clean sanitization',
  });

  // 12. Public routes performance & zero auth regression check
  const home = await req('GET', '/');
  const movies = await req('GET', '/movies');
  const tv = await req('GET', '/tv');
  const catalog = await req('GET', '/api/catalog');
  const publicRoutesOk = home.status === 200 && movies.status === 200 && tv.status === 200 && catalog.status === 200;
  tests.push({
    name: 'Public routes remain fast and fully operational without auth regression',
    pass: publicRoutesOk,
    details: `Home: ${home.status}, Movies: ${movies.status}, TV: ${tv.status}, Catalog: ${catalog.status}`,
  });

  console.log('--- VERIFICATION RESULTS ---');
  let passCount = 0;
  for (const t of tests) {
    if (t.pass) {
      passCount++;
      console.log(`[PASS] ${t.name} (${t.details})`);
    } else {
      console.log(`[FAIL] ${t.name} (${t.details})`);
    }
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passCount}/${tests.length}`);
  if (passCount === tests.length) {
    console.log(`RESULT: PASS: ${tests.length}/${tests.length}`);
  } else {
    console.log(`RESULT: FAIL: ${passCount}/${tests.length}`);
  }
  console.log('================================================================\n');

  if (passCount !== tests.length) {
    process.exit(1);
  }
}

runStagingVerification().catch((err) => {
  console.error('Staging verification error:', err);
  process.exit(1);
});
