// Refreshes fixtures/ from the public Zotero group library and the CSL locales repo, and vendor/ with
// the citeproc-js copy from the latest Zotero release.
const fs = require('fs');
const path = require('path');

const GROUP = 'https://api.zotero.org/groups/4308632';
const DEV_COLLECTION = 'Under utvikling';
const LOCALES = ['nb-NO', 'nn-NO', 'en-US'];
const FIXTURES = path.join(__dirname, 'fixtures');
const VENDOR = path.join(__dirname, 'vendor');
const CITEPROC_PATH = 'chrome/content/zotero/xpcom/citeproc.js';

async function getAll(url) {
  const results = [];
  for (let start = 0; ; start += 100) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}limit=100&start=${start}`, {
      headers: { 'Zotero-API-Version': '3' },
    });
    if (!res.ok) throw new Error(`${res.status} from ${url}`);
    const body = await res.json();
    const page = Array.isArray(body) ? body : body.items;
    results.push(...page);
    if (results.length >= Number(res.headers.get('Total-Results'))) return results;
  }
}

// Zotero keeps its own copy of citeproc-js. This takes it from the latest release tag, such as 10.0.8,
// leaving out betas and other tags. The tags API has no useful order, so it lists all of them.
async function fetchZoteroCiteproc() {
  const res = await fetch('https://api.github.com/repos/zotero/zotero/git/matching-refs/tags/');
  if (!res.ok) throw new Error(`${res.status} from the GitHub tags API`);
  const versions = (await res.json())
    .map((r) => r.ref.replace('refs/tags/', ''))
    .filter((t) => /^\d+\.\d+\.\d+$/.test(t))
    .sort((a, b) => {
      const [x, y] = [a, b].map((t) => t.split('.').map(Number));
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    });
  const latest = versions.pop();
  const url = `https://raw.githubusercontent.com/zotero/zotero/${latest}/${CITEPROC_PATH}`;
  const file = await fetch(url);
  if (!file.ok) throw new Error(`${file.status} from ${url}`);
  fs.mkdirSync(VENDOR, { recursive: true });
  const before = fs.existsSync(path.join(VENDOR, 'citeproc-zotero.json'))
    ? JSON.parse(fs.readFileSync(path.join(VENDOR, 'citeproc-zotero.json'), 'utf8')).zotero
    : null;
  fs.writeFileSync(path.join(VENDOR, 'citeproc-zotero.js'), await file.text());
  const info = { zotero: latest, path: CITEPROC_PATH };
  fs.writeFileSync(path.join(VENDOR, 'citeproc-zotero.json'), `${JSON.stringify(info, null, 2)}\n`);
  return before && before !== latest ? `${before} -> ${latest}` : latest;
}

async function main() {
  fs.mkdirSync(path.join(FIXTURES, 'locales'), { recursive: true });

  const collections = await getAll(`${GROUP}/collections?format=json`);
  const names = Object.fromEntries(collections.map((c) => [c.key, c.data.name]));
  const parents = Object.fromEntries(collections.map((c) => [c.key, c.data.parentCollection]));
  // True for the development folder and for any folder nested below it.
  const inDev = (key) => Boolean(key) && (names[key] === DEV_COLLECTION || inDev(parents[key]));
  const raw = await getAll(`${GROUP}/items/top?format=json`);
  const csl = await getAll(`${GROUP}/items/top?format=csljson`);
  const cslByKey = Object.fromEntries(csl.map((i) => [i.id.split('/').pop(), i]));

  const items = raw
    .filter((i) => i.data.itemType !== 'note' && i.data.itemType !== 'attachment')
    .map((i) => {
      const folders = i.data.collections.map((k) => names[k]).sort();
      return {
        ...cslByKey[i.key],
        id: i.key,
        _folders: folders,
        _dev: i.data.collections.some(inDev),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  fs.writeFileSync(path.join(FIXTURES, 'items.json'), JSON.stringify(items, null, 2) + '\n');

  for (const locale of LOCALES) {
    const url = `https://raw.githubusercontent.com/citation-style-language/locales/master/locales-${locale}.xml`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} from ${url}`);
    fs.writeFileSync(path.join(FIXTURES, 'locales', `locales-${locale}.xml`), await res.text());
  }

  const dev = items.filter((i) => i._dev).length;
  console.log(`${items.length} items: ${items.length - dev} regression, ${dev} under development`);
  console.log(`citeproc-js from Zotero ${await fetchZoteroCiteproc()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
