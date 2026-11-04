// Builds the variants from the template and diffs, and renders items with citeproc-js.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const CSL = require('citeproc');

const REPO = path.resolve(__dirname, '..');
const BUILD = path.join(__dirname, 'build');
const BASE = 'norsk-henvisningsstandard-for-rettsvitenskapelige-tekster';
const VARIANTS = { kortnoter: BASE, 'full-firstnote': `${BASE}-full-firstnote` };
const LANGS = ['nb-NO', 'nn-NO'];

function findPatch() {
  const candidates = ['patch', 'C:\\Program Files\\Git\\usr\\bin\\patch.exe'];
  const found = candidates.find((c) => spawnSync(c, ['--version']).status === 0);
  if (!found) throw new Error('patch not found (it ships with Git for Windows)');
  return found;
}

// Same steps as the builder: normalise the template to LF, then apply each diff.
// NORSK_TEMPLATE overrides the template path, for trying out a modified copy.
function buildStyles() {
  const template = process.env.NORSK_TEMPLATE || path.join(REPO, 'templates', `${BASE}-template.csl`);
  fs.rmSync(BUILD, { recursive: true, force: true });
  fs.mkdirSync(BUILD);
  fs.writeFileSync(
    path.join(BUILD, 'template.csl'),
    fs.readFileSync(template, 'utf8').replace(/\r\n/g, '\n'),
  );
  const patch = findPatch();
  const styles = {};
  for (const [variant, name] of Object.entries(VARIANTS)) {
    const diff = path.relative(BUILD, path.join(REPO, 'diffs', `${name}.diff`));
    const result = spawnSync(patch, ['-s', '-N', '-o', `${variant}.csl`, 'template.csl', diff], {
      cwd: BUILD,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(`Diff for ${variant} does not apply:\n${result.stdout}${result.stderr}`);
    }
    styles[variant] = fs.readFileSync(path.join(BUILD, `${variant}.csl`), 'utf8');
  }
  return styles;
}

function loadItems() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'items.json'), 'utf8'));
}

// A fixed item cited between two citations, so the second one is "subsequent" rather than "ibid".
const INTERVENING = { id: '__intervening__', type: 'book', title: 'Mellomliggende verk' };

function locatorFor(item) {
  if (item.type === 'legal_case') return { locator: '19', label: 'paragraph' };
  if (item.type === 'legislation' || item.type === 'regulation') return { locator: '3', label: 'section' };
  if (item.type === 'treaty') return { locator: '3', label: 'article-locator' };
  return { locator: '3', label: 'page' };
}

function clean(html) {
  return html
    .replace(/<i>(.*?)<\/i>/g, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/&#38;/g, '&')
    .replace(/\u00a0/g, '~')
    .trim();
}

function renderer(style, items, lang) {
  const byId = Object.fromEntries([...items, INTERVENING].map((i) => [i.id, i]));
  const sys = {
    retrieveLocale: (l) => {
      const file = path.join(__dirname, 'fixtures', 'locales', `locales-${l}.xml`);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : false;
    },
    retrieveItem: (id) => structuredClone(byId[id]),
  };
  const engine = () => {
    const e = new CSL.Engine(sys, style, lang, true);
    e.setOutputFormat('html');
    return e;
  };
  // Renders a sequence of notes and returns the text of each one.
  const notes = (cites) => {
    const e = engine();
    const previous = [];
    return cites.map((cite, n) => {
      const id = `c${n}`;
      const citation = { citationID: id, citationItems: [cite], properties: { noteIndex: n + 1 } };
      const [, updated] = e.processCitationCluster(citation, previous, []);
      previous.push([id, n + 1]);
      return clean(updated.find((u) => u[2] === id)[1]);
    });
  };
  const bibliography = (ids) => {
    const e = engine();
    e.updateItems(ids);
    return e.makeBibliography()[1].map(clean);
  };
  return { notes, bibliography };
}

function renderItem(r, item) {
  const id = item.id;
  const loc = { id, ...locatorFor(item) };
  const other = { id: INTERVENING.id };
  return {
    first: r.notes([{ id }])[0],
    firstLocator: r.notes([loc])[0],
    subsequent: r.notes([{ id }, other, { id }])[2],
    subsequentLocator: r.notes([{ id }, other, loc])[2],
    ibid: r.notes([{ id }, { id }])[1],
    ibidLocator: r.notes([{ id }, loc])[1],
    bibliography: r.bibliography([id]).join(' '),
  };
}

// Under utvikling items are left out of the shared bibliography, so that work on them
// cannot change the sort position snapshot of the supported items.
function renderAll(style, items, lang) {
  const r = renderer(style, items, lang);
  const out = { items: {}, bibliography: r.bibliography(items.map((i) => i.id)) };
  for (const item of items) out.items[item.id] = renderItem(r, item);
  return out;
}

module.exports = { LANGS, buildStyles, loadItems, renderAll };
