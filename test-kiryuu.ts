import * as cheerio from "cheerio";

async function test() {
  const res = await fetch("https://v3.kiryuu.to/manga/?order=popular", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  console.log("Status:", res.status);
  const html = await res.text();
  console.log("Length:", html.length);
  
  const $ = cheerio.load(html);
  const items = $("#search-results > div");
  console.log("Items found:", items.length);
  
  // Parse first item
  items.each((i, el) => {
    if (i > 2) return;
    const $el = $(el);
    const titleEl = $el.find("h1").first();
    const title = titleEl.text().trim();
    const link = $el.find("a[href*='/manga/']").first();
    const href = link.attr("href") || "";
    const img = $el.find(".wp-post-image").first();
    const thumbnail = img.attr("src") || "";
    const rating = $el.find(".numscore").first().text().trim();
    const chapterEl = $el.find("a.link-self p.inline-block, a[class*='link-self'] p.inline-block").first();
    const chapter = chapterEl.text().trim();
    console.log(`\n[${i}] Title: "${title}"`);
    console.log(`    Href: "${href}"`);
    console.log(`    Thumb: "${thumbnail.substring(0, 80)}..."`);
    console.log(`    Rating: "${rating}"`);
    console.log(`    Chapter: "${chapter}"`);
  });
}

test().catch(console.error);
