import * as cheerio from "cheerio";

async function checkKomiku(slug) {
  try {
    const r = await fetch("https://komiku.org/manga/" + slug + "/");
    const html = await r.text();
    const $ = cheerio.load(html);
    const info = {};
    $("table tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        info[$(cells[0]).text().trim().toLowerCase()] = $(cells[1]).text().trim();
      }
    });
    console.log("Komiku " + slug + ": status=" + (info["status"] || "N/A"));
  } catch (e) {
    console.log("Komiku " + slug + ": ERROR " + e.message);
  }
}

async function checkKiryuu(slug) {
  try {
    const r = await fetch("https://v1.kiryuu.to/wp-json/wp/v2/manga?slug=" + slug + "&_embed=wp:term", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    if (d[0] && d[0]._embedded) {
      d[0]._embedded["wp:term"].forEach(g => g.forEach(t => {
        if (t.taxonomy === "status") console.log("Kiryuu " + slug + ": status=" + t.name);
      }));
    }
  } catch (e) {
    console.log("Kiryuu " + slug + ": ERROR " + e.message);
  }
}

// Test multiple completed manga
const completed = [
  "oshi-no-ko",
  "naruto",
  "kimetsu-no-yaiba",
  "shingeki-no-kyojin",
  "death-note",
  "bleach",
  "fullmetal-alchemist",
  "dragon-ball",
  "tokyo-ghoul",
  "chainsaw-man",
];

const ongoing = [
  "one-piece",
  "jujutsu-kaisen",
  "boruto-two-blue-vortex",
  "blue-lock",
];

(async () => {
  console.log("=== COMPLETED MANGA ===");
  for (const slug of completed) {
    await checkKiryuu(slug);
  }
  console.log("\n=== ONGOING MANGA ===");
  for (const slug of ongoing) {
    await checkKiryuu(slug);
  }

  console.log("\n=== KOMIKU STATUS ===");
  for (const slug of [...completed.slice(0, 4), ...ongoing.slice(0, 2)]) {
    await checkKomiku(slug);
  }
})();
