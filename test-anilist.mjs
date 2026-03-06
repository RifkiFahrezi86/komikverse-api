// Test AniList API for manga status
async function checkAniList(title) {
  const query = `query ($search: String) {
    Media(search: $search, type: MANGA) {
      title { romaji english }
      status
    }
  }`;
  
  try {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { search: title } }),
      signal: AbortSignal.timeout(10000)
    });
    const j = await r.json();
    const m = j.data?.Media;
    if (m) {
      console.log(title.padEnd(25) + " => AniList: " + m.status + " (" + (m.title.english || m.title.romaji) + ")");
    } else {
      console.log(title.padEnd(25) + " => NOT FOUND");
    }
  } catch (e) {
    console.log(title.padEnd(25) + " => ERROR: " + e.message);
  }
}

(async () => {
  const titles = [
    "Oshi no Ko",
    "Naruto",
    "Kimetsu no Yaiba",
    "One Piece",
    "Chainsaw Man",
    "Jujutsu Kaisen",
    "Bleach",
    "Shingeki no Kyojin",
    "Death Note",
    "Dragon Ball",
    "Tokyo Ghoul",
    "Blue Lock",
    "Boruto Two Blue Vortex",
  ];
  
  for (const t of titles) {
    await checkAniList(t);
  }
})();
