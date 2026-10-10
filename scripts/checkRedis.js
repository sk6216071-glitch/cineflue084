const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envFile, 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });

async function check() {
  const hlen = await redis.hlen('cinefuel:curated_links');
  console.log('cinefuel:curated_links hash length:', hlen);
}
check().catch(console.error);
