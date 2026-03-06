const API = 'https://komikverse-api-amber.vercel.app/api';

async function test() {
  const tests = [
    // Shinigami
    ['shinigami', 'terbaru', ''],
    ['shinigami', 'popular', ''],
    ['shinigami', 'detail/one-piece', ''],
    // Komiku  
    ['komiku', 'terbaru', ''],
    ['komiku', 'popular', ''],
    ['komiku', 'search', 'keyword=naruto'],
    ['komiku', 'detail/manga-one-piece', ''],
    // Kiryuu
    ['kiryuu', 'terbaru', ''],
    ['kiryuu', 'popular', ''],
    ['kiryuu', 'detail/one-piece', ''],
    ['kiryuu', 'detail/oshi-no-ko', ''],
  ];

  for (const [prov, ep, extra] of tests) {
    const url = `${API}/${ep}?provider=${prov}${extra ? '&' + extra : ''}`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      let info = '';
      if (j.data?.title) info = `title=${j.data.title}, status=${j.data.status}`;
      else if (Array.isArray(j.data)) info = `${j.data.length} items`;
      else info = j.message || j.status;
      console.log(`${prov.padEnd(10)} ${ep.padEnd(25)} ${j.status.padEnd(8)} ${info}`);
    } catch (e) {
      console.log(`${prov.padEnd(10)} ${ep.padEnd(25)} FAIL     ${e.cause?.code || e.message}`);
    }
  }
}
test();
