// Generates assets/stats-light.svg and assets/stats-dark.svg from the
// GitHub REST API. Run by .github/workflows/stats.yml on a schedule, or
// locally with GITHUB_TOKEN set for a one-off refresh.
import { writeFileSync } from "node:fs";

const USERNAME = process.env.STATS_USERNAME || "varundevarajrvu";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function collectStats() {
  let page = 1;
  const repos = [];
  while (true) {
    const batch = await gh(`/users/${USERNAME}/repos?per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  // Excludes forks, archived repos, and repos with no content (e.g. a
  // freshly created empty repo) so the count reflects real shipped work.
  const owned = repos.filter((r) => !r.fork && !r.archived && r.size > 0);
  const stars = owned.reduce((sum, r) => sum + r.stargazers_count, 0);
  const langCounts = {};
  for (const r of owned) {
    if (!r.language) continue;
    langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  }
  const topLangs = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lang]) => lang);

  return { repoCount: owned.length, stars, topLangs };
}

function renderCard({ repoCount, stars, topLangs }, theme) {
  const dark = theme === "dark";
  const fg = dark ? "#e7e9ee" : "#16181d";
  const accent = dark ? "#5eead4" : "#2563eb";
  const bg = "none";
  const langLine = topLangs.join("  ·  ");
  return `<svg width="420" height="92" viewBox="0 0 420 92" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub stats: ${repoCount} repos, ${stars} stars. Top languages: ${langLine}">
  <title>GitHub stats — ${repoCount} repos, ${stars} stars</title>
  <style>
    .label { font: 500 13px ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace; fill: ${fg}; opacity: 0.65; }
    .value { font: 700 20px ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace; fill: ${fg}; }
    .lang  { font: 500 14px ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace; fill: ${accent}; }
  </style>
  <rect width="420" height="92" fill="${bg}"/>
  <text x="4" y="22" class="label">repos</text>
  <text x="4" y="46" class="value">${repoCount}</text>
  <text x="110" y="22" class="label">stars</text>
  <text x="110" y="46" class="value">${stars}</text>
  <text x="4" y="78" class="lang">${langLine}</text>
</svg>
`;
}

const stats = await collectStats();
writeFileSync("assets/stats-light.svg", renderCard(stats, "light"));
writeFileSync("assets/stats-dark.svg", renderCard(stats, "dark"));
console.log("stats:", stats);
