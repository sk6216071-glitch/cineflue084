const React = require('react');
const ReactDOMServer = require('react-dom/server');
const path = require('path');
const fs = require('fs');

// Read .env.local
const envFile = path.join(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envFile, 'utf-8');
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

async function run() {
  const { getPaginatedUploadedTitles } = require('../src/lib/redisDb');
  const res = await getPaginatedUploadedTitles({ type: 'movie', page: 1, limit: 16 });
  console.log('Result total:', res.total, 'items count:', res.items?.length);
}
run().catch(console.error);
