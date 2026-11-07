# Norsk henvisningsstandard: local tests

Regression tests for the two Norsk henvisningsstandard variants. The folder is listed in the
parent repo's `.git/info/exclude`, so it never shows up in `git status` or in a PR. It has its
own git repo, which gives snapshot changes a history.

## Commands

Run these from this folder, after `npm install`.

| Command | What it does |
| --- | --- |
| `npm test` | Builds both variants from the template and diffs, then compares every supported item with its snapshot. Fails on any difference. |
| `npm run dev` | Prints how the "Under utvikling" items render. Never fails. |
| `npm run update` | Accepts the current output as the new snapshots. |
| `npm run fetch` | Refreshes `fixtures/` from the Zotero group library and the CSL locales repo. |
| `npm run export` | Builds a test copy of the short note variant in `export/`, for installing in Zotero. |

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
3. If the change is intended, run `npm run update` and commit the snapshots in this folder.

Snapshots record what the style currently does, not what the guide requires. A pass means nothing
changed, not that the output is correct.

## Test copy for Zotero

`npm run export` runs the real builder on the current template and short note diff, and writes
`export/norsk-henvisningsstandard-for-rettsvitenskapelige-tekster-test.csl`. Open that file in
Zotero to install it. Exporting again and reinstalling replaces the test copy, not the regular style.

The copy differs from the built style in three lines only, and the script fails if it finds more:

- The title starts with `[TEST]`.
- The ID ends in `-test`. Zotero takes the file name from the ID, so this also gives a new file name.
- The `self` link matches the new ID, because Zotero sends that link to its style repository.

Zotero overwrites an installed style with the same ID, file name or title, so all of these must stay
different from the regular style. A document set to the test copy stores the test ID, so switch it back
to the regular style before removing the test copy from Zotero.

Set `NORSK_TEMPLATE` to a file path to test a modified copy of the template.
