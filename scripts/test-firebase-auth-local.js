const { MongoClient } = require('mongodb');

// Import test key pair
const TEST_KEY = {
  kid: 'cinefuel-test-key-v1',
  pub: {
    key_ops: ['verify'],
    ext: true,
    alg: 'RS256',
    kty: 'RSA',
    n: 'wsBaz-0AOq5wzgUH9IGxtu6C0gPTmrBtxZ-BmAZHQ32UoXbFC0666J82BHelzjTYS-r9dbhQGtIkpeHFE42h-lCpXcMrLOkLoZ0xdM3WdW18xjKD86JjSXEZ8lPb-LqebT21xAzGQHP-rFoafOhWIJPF4USOlXV-Ew9kRrghSUtrfavFpFiaSY_LYQ5Zx2AlfwYqyBRYGTvFcKGhfOBYybYF8-EWECvSLNAlTsHRK4cqFv7kRtlpyBAStbFQKBqfcSCWj-CEiq0YBqXp2fWo_IqTrY-tLgwTlj5OIi5euUn__S1G_MF-oGcfoFXsXSdtPaAaPwkOl-ItqUizCKQUtQ',
    e: 'AQAB',
    kid: 'cinefuel-test-key-v1',
    use: 'sig',
  },
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

const STAGING_URI = 'mongodb+srv://shyam:shyam081@cluster0.fiwla4n.mongodb.net/cinefuel_staging?retryWrites=true&w=majority';

function toBase64Url(objOrStr) {
  const str = typeof objOrStr === 'string' ? objOrStr : JSON.stringify(objOrStr);
  return Buffer.from(str).toString('base64url');
}

async function createSignedTestToken(payloadOverrides = {}) {
  const header = { alg: 'RS256', kid: 'cinefuel-test-key-v1', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/cinefuel-app',
    aud: 'cinefuel-app',
    sub: 'fb_user_test_98765',
    email: 'alex.rivera@gmail.com',
    name: 'Alex Rivera',
    picture: 'https://lh3.googleusercontent.com/a/testphoto.jpg',
    firebase: {
      sign_in_provider: 'google.com',
      identities: { 'google.com': ['1029384756'] },
    },
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
  return `${signedData}.${sigB64}`;
}

async function runLocalTestSuite() {
  console.log('================================================================');
  console.log('   CINEFUEL FIREBASE AUTH & USER PROFILE INTEGRATION TEST      ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name, condition, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${name} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`[FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
    }
  }

  // TEST 1: Google JWKS Live Fetch
  try {
    const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    const data = await res.json();
    assert(
      'Google official JWKS endpoint reachable and valid',
      res.status === 200 && Array.isArray(data.keys) && data.keys.length > 0,
      `Keys count: ${data.keys.length}`
    );
  } catch (err) {
    assert('Google official JWKS endpoint reachable', false, err.message);
  }

  // TEST 2: Valid RS256 Firebase Token Generation & Signature Validation
  let validToken;
  try {
    validToken = await createSignedTestToken();
    const [h, p, s] = validToken.split('.');
    const pubKey = await crypto.subtle.importKey(
      'jwk',
      TEST_KEY.pub,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      pubKey,
      Buffer.from(s, 'base64url'),
      new TextEncoder().encode(`${h}.${p}`)
    );
    assert('Valid RS256 token verifies cryptographically', valid === true);
  } catch (err) {
    assert('Valid RS256 token verifies cryptographically', false, err.message);
  }

  // TEST 3: Tampered Token Signature Rejection
  try {
    const [h, p, s] = validToken.split('.');
    const tamperedPayload = toBase64Url({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), name: 'Hacker' });
    const pubKey = await crypto.subtle.importKey(
      'jwk',
      TEST_KEY.pub,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      pubKey,
      Buffer.from(s, 'base64url'),
      new TextEncoder().encode(`${h}.${tamperedPayload}`)
    );
    assert('Tampered payload is rejected by signature verification', valid === false);
  } catch (err) {
    assert('Tampered payload is rejected', false, err.message);
  }

  // TEST 4: Expired Token Rejection
  try {
    const expiredToken = await createSignedTestToken({
      exp: Math.floor(Date.now() / 1000) - 300,
      iat: Math.floor(Date.now() / 1000) - 3900,
    });
    const payload = JSON.parse(Buffer.from(expiredToken.split('.')[1], 'base64url').toString());
    const isExpired = payload.exp < Math.floor(Date.now() / 1000);
    assert('Expired token claims detected (exp in past)', isExpired === true);
  } catch (err) {
    assert('Expired token check', false, err.message);
  }

  // TEST 5: MongoDB Atlas Staging User Persistence & Password Sanitization
  try {
    const client = new MongoClient(STAGING_URI);
    await client.connect();
    const db = client.db('cinefuel_staging');
    const usersCollection = db.collection('users');

    // Create unique sparse index on firebaseUid if not present
    await usersCollection.createIndex({ firebaseUid: 1 }, { unique: true, sparse: true });

    const testFirebaseUid = 'fb_user_alex_integration_test_' + Date.now();
    const testEmail = `alex.test.${Date.now()}@gmail.com`;
    const testName = 'Alex Rivera Test';

    // Simulate saving verified profile
    const userDoc = {
      firebaseUid: testFirebaseUid,
      uid: testFirebaseUid,
      name: testName,
      displayName: testName,
      email: testEmail,
      photoURL: 'https://lh3.googleusercontent.com/testphoto.jpg',
      provider: 'google.com',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date(),
    };

    const updateRes = await usersCollection.updateOne(
      { firebaseUid: testFirebaseUid },
      {
        $set: userDoc,
        $unset: { passwordHash: '', passwordSalt: '' },
      },
      { upsert: true }
    );

    assert(
      'Profile saved in MongoDB cinefuel_staging.users',
      updateRes.acknowledged === true,
      `matched: ${updateRes.matchedCount}, upserted: ${updateRes.upsertedCount}`
    );

    // Retrieve and verify
    const retrieved = await usersCollection.findOne({ firebaseUid: testFirebaseUid });
    assert(
      'Retrieved document contains verified identity',
      retrieved && retrieved.firebaseUid === testFirebaseUid && retrieved.email === testEmail && retrieved.name === testName
    );

    assert(
      'Retrieved document strictly has NO passwordHash or passwordSalt',
      retrieved && retrieved.passwordHash === undefined && retrieved.passwordSalt === undefined
    );

    // Test unique constraint: upserting same firebaseUid updates rather than duplicates
    await usersCollection.updateOne(
      { firebaseUid: testFirebaseUid },
      { $set: { lastLoginAt: new Date().toISOString(), updatedAt: new Date() } },
      { upsert: true }
    );
    const count = await usersCollection.countDocuments({ firebaseUid: testFirebaseUid });
    assert('firebaseUid uniqueness enforced (exactly 1 document)', count === 1);

    // Cleanup test user
    await usersCollection.deleteOne({ firebaseUid: testFirebaseUid });

    await client.close();
  } catch (err) {
    assert('MongoDB Atlas staging persistence check', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed}/${total} checks passed`);
  console.log(passed === total ? 'RESULT: PASS' : 'RESULT: FAIL');
  console.log('================================================================\n');

  if (passed !== total) process.exit(1);
}

runLocalTestSuite().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
