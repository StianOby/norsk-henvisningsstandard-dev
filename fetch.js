// Refreshes fixtures/ from the public Zotero group library and the CSL locales repo.
const fs = require('fs');
const path = require('path');

const GROUP = 'https://api.zotero.org/groups/4308632';
const DEV_COLLECTION = 'Under utvikling';
const LOCALES = ['nb-NO', 'nn-NO', 'en-US'];
const FIXTURES = path.join(__dirname, 'fixtures');

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
