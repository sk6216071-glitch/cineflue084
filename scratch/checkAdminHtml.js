async function main() {
  const res = await fetch('https://cinephile.sk6216071.workers.dev/admin');
  const text = await res.text();
  const matches = [...text.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  for (const src of matches) {
    try {
      const sRes = await fetch('https://cinephile.sk6216071.workers.dev' + src);
      const sText = await sRes.text();
      console.log(src, sText.length, 'bytes');
    } catch (e) {
      console.log(src, e.message);
    }
  }
}
main();
