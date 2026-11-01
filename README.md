# Bin Verdict

Which bin does this go in, **in your city**, and what does the city itself say about it?

Bin Verdict answers that question for 65 kinds of household items in 10 U.S. cities. Every ruling carries a quote from the city's own page, the link, and the date the page was read. It also measures something most recycling apps skip: how often one-size-fits-all advice is wrong.

Live demo: https://bin-verdict.vercel.app

Built for the Theme Track ("Rethinking Waste") of Arbiter Hacks V1.

## The waste problem

Curbside recycling fails mostly at the cart, not the plant. Residents put in things their city does not take (wish-cycling) and throw out things it does. The rules are local: the same pizza box is compost in San Francisco and Seattle, recycling in Chicago and Portland, and refused for recycling in Urbana. Generic advice and national labels cannot get all of those right.

## What the data says

From `npm run stats` (10 cities, 421 rulings that the pages name directly or cover with a stated rule):

| Measure | Result |
| --- | --- |
| Rulings that contradict the majority of the *other* cities | 38 of 392 (9.7%) |
| ...that would put a non-accepted item in the recycling cart | 19 |
| ...that would send an accepted item to the trash | 19 |
| Common items on which cities split (some accept, some do not) | 18 of 59 |

Most contested items: paint cans, plastic toys, plastic lids, greasy pizza boxes, paper coffee cups, scrap metal, rigid #6 plastic, wrapping paper. Full output in `docs/stats.json`.

Method: for each ruling, take the majority answer to "does it belong in the recycling cart?" from all other cities that rule on the item (at least 3 of them, ties resolve to "no"), and count how often it differs from the city's own answer. Rulings inferred by the curator rather than stated or covered by the page are excluded.

## How it works

1. **Rulings as data** (`data/cities/*.json`). One file per city. Each ruling is `{verdict, basis, source, quote}`. Verdicts: `recycle`, `compost`, `trash`, `special` (no cart: drop-off, hazardous, pickup), `not-recycling` (the page rejects it for the recycling cart without saying where it goes). `basis` is `listed` (item named), `general-rule` (covered by a stated rule) or `inferred` (excluded from all statistics). A city that does not mention an item gets "not stated", never a guess.
2. **Engine** (`src/engine.js`). Validation, lookup, cross-city comparison, the leave-one-out majority baseline and the contested-item ranking. Pure functions, no I/O.
3. **Free text to item** (`src/retrieve.js`, `src/lexical.js`). A resident describes an item in their own words. A MiniLM sentence-embedding model (int8 ONNX, 23 MB, shipped in the repo, runs in the browser through transformers.js) scores the description against 681 label and synonym phrases. The top three items are shown so a wrong first guess is one click away.
4. **Web app** (`web/`). Static files, no server and no API keys. City picker, free-text box, the ruling with its quote and source, the same item across all cities, the findings above, and a printable cart sticker.
5. **City onboarding** (`scripts/onboard.mjs`). A city or a volunteer drops in a rules file, gets validation, coverage, a list of items where that city departs from the majority of others (the likeliest sources of wish-cycling), and a printable sticker.

### Retrieval ablation

195 descriptions written by the author after the item list was fixed (so they are not drawn from the synonym lists, but they are not independent of the author's vocabulary either). Run `npm run eval`.

| Ranker | Right item first | Right item in top 3 |
| --- | --- | --- |
| Plain text matching (token overlap + trigram) | 64.6% | 84.6% |
| MiniLM embeddings (used by the app) | 80.0% | 95.9% |
| 50/50 blend (untuned) | 74.9% | 94.4% |

Without the embedding model, one description in three lands on the wrong item first. The blend was not better than embeddings alone, so the app uses embeddings, with plain text matching as the fallback if the model cannot load. Misses are listed in `docs/retrieval-eval.json`.

## Run it

```bash
npm install          # only needed for the eval and the web build (transformers.js)
npm test             # 15 tests, node:test
npm run validate     # schema check on every city file
npm run stats        # findings table -> docs/stats.json
npm run eval         # retrieval ablation -> docs/retrieval-eval.json
npm run build:web    # copy engine and data into web/
npm run serve        # http://localhost:5173/
node scripts/onboard.mjs data/cities/chicago-il.json --sticker chicago.html
```

Node 20 or newer. The web folder is self-contained (model, runtime and WebAssembly are vendored), so it deploys to any static host.

## How to measure whether it works

The target problem is contamination of curbside recycling carts (wish-cycling) and recyclables lost to the trash. A pilot would pair routes that receive a city-specific sticker and link with matched control routes, and compare cart-audit contamination rates (percent of audited carts with non-accepted items, and percent of material by weight) before and after, using the city's existing cart-tagging or MRF audit method. This repository does not contain pilot results and makes no claim about contamination reduction. What it measures today is how often generic advice would have been wrong and how well the item lookup works.

## Limits

- 10 cities and 65 item types. Rulings were read from each city's own pages on 2026-10-31 and transcribed by hand with an AI coding agent. Cities change rules, so confirm with the source link.
- Chicago's accepted-materials list comes from a city article dated December 12, 2018; the current Chicago page is an interactive tool, so only the aerosol, lithium battery, plastic film and pizza box rulings come from current pages.
- San Francisco's page lists milk cartons in more than one column; the ruling follows the recycle column and the Recology FAQ.
- Mixed city programs (for example Portland's separate glass bin, or buildings with private haulers) are noted in each ruling's `note`, not modelled.
- Item types are coarse (for example "plastic cup lid and coffee lid"). A real deployment would use the city's own item vocabulary.
- The retrieval test set was written by one person.

## Repository

```
data/items.json        65 item types with synonyms
data/cities/*.json     one file per city, every ruling quoted and linked
src/                   engine, lexical matching, retrieval
scripts/               validate, stats, eval, onboard, build-web, serve, smoke, curation
test/                  node:test suites
eval/queries.json      195 held-out descriptions
web/                   static site (vendored model and runtime)
docs/                  stats.json, retrieval-eval.json
```

## AI assistance

The code, the transcription of rulings from city pages, and this text were produced with a Claude-based coding agent working for the author, who owns and answers for the repository. The model used for lookups is the open MiniLM-L6-v2 (Apache-2.0, via the Xenova ONNX export).

## License

MIT. See `LICENSE`. City quotations remain the property of the cities and are reproduced briefly with attribution.
