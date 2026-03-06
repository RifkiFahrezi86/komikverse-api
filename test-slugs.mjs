const API = 'https://komikverse-api-amber.vercel.app/api';

async function test() {
  // 1. Find Shinigami slugs from terbaru
  console.log('=== SHINIGAMI TERBARU (first 3) ===');
  const s = await fetch(`${API}/terbaru?provider=shinigami`, { signal: AbortSignal.timeout(15000) });
  const sj = await s.json();
  sj.data?.slice(0, 3).forEach(c => console.log(`  ${c.title} | ${c.href}`));

  // 2. Search Shinigami for one piece
  console.log('\n=== SHINIGAMI SEARCH "one piece" ===');
  const ss = await fetch(`${API}/search?provider=shinigami&keyword=one+piece`, { signal: AbortSignal.timeout(15000) });
  const ssj = await ss.json();
  ssj.data?.slice(0, 3).forEach(c => console.log(`  ${c.title} | ${c.href}`));

  // 3. Find Komiku slugs from terbaru
  console.log('\n=== KOMIKU TERBARU (first 3) ===');
  const k = await fetch(`${API}/terbaru?provider=komiku`, { signal: AbortSignal.timeout(15000) });
  const kj = await k.json();
  kj.data?.slice(0, 3).forEach(c => console.log(`  ${c.title} | ${c.href}`));

  // 4. Search Komiku for one piece
  console.log('\n=== KOMIKU SEARCH "one piece" ===');
  const ks = await fetch(`${API}/search?provider=komiku&keyword=one+piece`, { signal: AbortSignal.timeout(15000) });
  const ksj = await ks.json();
  ksj.data?.slice(0, 5).forEach(c => console.log(`  ${c.title} | ${c.href}`));

  // 5. Test Shinigami detail with a slug from search
  if (ssj.data?.[0]) {
    const slug = ssj.data[0].href.replace('/manga/', '');
    console.log(`\n=== SHINIGAMI DETAIL: ${slug} ===`);
    const sd = await fetch(`${API}/detail/${slug}?provider=shinigami`, { signal: AbortSignal.timeout(15000) });
    const sdj = await sd.json();
    console.log(`  ${sdj.status} | ${sdj.data?.title} | status=${sdj.data?.status} | ch=${sdj.data?.chapters?.length}`);
  }

  // 6. Test Komiku detail with slug from search
  if (ksj.data?.[0]) {
    const slug = ksj.data[0].href.replace('/manga/', '');
    console.log(`\n=== KOMIKU DETAIL: ${slug} ===`);
    const kd = await fetch(`${API}/detail/${slug}?provider=komiku`, { signal: AbortSignal.timeout(15000) });
    const kdj = await kd.json();
    console.log(`  ${kdj.status} | ${kdj.data?.title} | status=${kdj.data?.status} | ch=${kdj.data?.chapters?.length}`);
  }
}
test();
