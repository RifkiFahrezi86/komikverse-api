const API = 'https://komikverse-api-amber.vercel.app/api';

async function test() {
  // Komiku One Piece with correct slug
  console.log('=== KOMIKU detail: komik-one-piece-indo ===');
  const k = await fetch(`${API}/detail/komik-one-piece-indo?provider=komiku`, { signal: AbortSignal.timeout(20000) });
  const kj = await k.json();
  console.log(`  ${kj.status} | ${kj.data?.title} | status=${kj.data?.status} | ch=${kj.data?.chapters?.length}`);

  // Shinigami One Piece with UUID slug  
  console.log('\n=== SHINIGAMI detail: 48270276-bd79-4a46-b15e-fdd2cf5655b1 ===');
  const s = await fetch(`${API}/detail/48270276-bd79-4a46-b15e-fdd2cf5655b1?provider=shinigami`, { signal: AbortSignal.timeout(20000) });
  const sj = await s.json();
  console.log(`  ${sj.status} | ${sj.data?.title} | status=${sj.data?.status} | ch=${sj.data?.chapters?.length}`);

  // Test Shinigami read (chapter)
  if (sj.data?.chapters?.[0]) {
    const chSlug = sj.data.chapters[0].href.replace('/chapter/', '');
    console.log(`\n=== SHINIGAMI read: ${chSlug} ===`);
    const sr = await fetch(`${API}/read/${chSlug}?provider=shinigami`, { signal: AbortSignal.timeout(15000) });
    const srj = await sr.json();
    console.log(`  ${srj.status} | ${srj.data?.[0]?.title} | panels=${srj.data?.[0]?.panel?.length}`);
  }

  // Test Kiryuu status check (AniList integration)
  console.log('\n=== STATUS CHECK (AniList) ===');
  const statusTests = ['oshi-no-ko', 'one-piece', 'naruto', 'jujutsu-kaisen', 'chainsaw-man'];
  for (const slug of statusTests) {
    const r = await fetch(`${API}/detail/${slug}?provider=kiryuu`, { signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    console.log(`  ${slug.padEnd(20)} status=${j.data?.status}`);
  }
}
test();
