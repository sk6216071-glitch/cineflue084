async function check() {
  const res = await fetch('https://cinephile.sk6216071.workers.dev/admin');
  const text = await res.text();
  console.log('HTTP Status:', res.status);
  console.log('HTML Length:', text.length);
  console.log('Includes admin-theme-backdrop:', text.includes('admin-theme-backdrop'));
  console.log('Includes <img> tag:', text.includes('<img'));
  console.log('Includes rel="preload" as="image":', text.includes('as="image"'));
  console.log('Includes CiNEPHiLE Master Control:', text.includes('CiNEPHiLE Master Control'));
  console.log('Includes blur-[160px]:', text.includes('blur-[160px]'));
}
check().catch(console.error);
