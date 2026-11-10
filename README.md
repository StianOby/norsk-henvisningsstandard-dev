# Norsk henvisningsstandard: development repo

Regression tests and a test copy of the style, for the two Norsk henvisningsstandard variants. The folder is listed in the
parent repo's `.git/info/exclude`, so it never shows up in `git status` or in a PR. It has its
own git repo, which gives snapshot changes and the test copy a history.

To set it up, clone this repo into the root of a style-variant-builder checkout, as
`norsk-henvisningsstandard-dev/`, because the scripts read the template and diffs from the parent
folder. Then add `/norsk-henvisningsstandard-dev/` to that checkout's `.git/info/exclude`.

## Commands

Run these from this folder, after `npm install`.

| Command | What it does |
| --- | --- |
| `npm test` | Builds both variants from the template and diffs, then compares every supported item with its snapshot. Fails on any difference. Also writes the test copy to `test-style/`. |
| `npm run dev` | Prints how the "Under utvikling" items render. Never fails. |
| `npm run update` | Accepts the current output as the new snapshots, and writes the test copy. |
| `npm run fetch` | Refreshes `fixtures/` from the Zotero group library and the CSL locales repo. |
| `npm run export` | Writes the test copy and copies it into Zotero's styles folder. |

## What is tested

Each supported item is rendered in both variants, in bokmål and nynorsk, as: first note, later
note and ibid (each with and without a locator), and bibliography entry. All supported items are
also rendered as one bibliography, which covers sort order.

Items in the Zotero folder "Under utvikling" and its subfolders are excluded from the snapshots.
To promote an item when support is ready, move it to another folder in Zotero, then run
`npm run fetch` and `npm run update`.

## Workflow

1. Change the template or diffs.
2. Run `npm test`. Any difference it lists is either a regression or an intended change.
3. If the change is intended, run `npm run update` and commit the snapshots and `test-style/` in this folder.

Snapshots record what the style currently does, not what the guide requires. A pass means nothing
changed, not that the output is correct.

## Test copy for Zotero

`test-style/norsk-henvisningsstandard-for-rettsvitenskapelige-tekster-test.csl` is a test copy of the
short note variant, built by the real builder from the current template and short note diff. `npm test`,
`npm run update` and `npm run export` all rewrite it, so the committed copy matches the committed
snapshots. To install it, add the file in Zotero's Cite settings with the + button, or run
`npm run export`.

`npm run export` also copies the file to `~/Zotero/styles`, or to the folder in `ZOTERO_STYLES`.
Restart Zotero to load it.

The copy step writes only the test copy's own file. It stops without writing if that file holds a
style with another ID, or if any other style has the test copy's ID or title. It then compares hashes of
every file in the folder, and fails if anything else changed.

The copy differs from the built style in three lines only, and the script fails if it finds more:

- The title starts with `[TEST]`.
- The ID ends in `-test`. Zotero takes the file name from the ID, so this also gives a new file name.
- The `self` link matches the new ID, because Zotero sends that link to its style repository.

Zotero overwrites an installed style with the same ID, file name or title, so all of these must stay
different from the regular style. A document set to the test copy stores the test ID, so switch it back
to the regular style before removing the test copy from Zotero.

Set `NORSK_TEMPLATE` to a file path to test a modified copy of the template.

## CSL processor

The tests render with the `citeproc` package from npm, version 2.4.63 from 2023. Zotero doesn't use
that package. It keeps its own copy of citeproc-js in `chrome/content/zotero/xpcom/citeproc.js` in the
zotero/zotero repo, and updates it from Juris-M/citeproc-js now and then. So a fix merged in
citeproc-js reaches Zotero only when Zotero updates that file, and reaches users only with the next
Zotero release after that. The npm package hasn't been updated since 2023, so the tests can show bugs
that Zotero has already fixed.

Zotero commit d569d42 (2026-11-10, on `main`, after 10.0.8) pulled in Juris-M/citeproc-js#263, which fixes
`locator="article-locator"`, and #272, which fixes the serial comma between treaty parties. The npm
package has neither, so treaties and EU acts still show "art. 3" in the snapshots, while Zotero will print
"artikkel 3".
