# Devpost submission text: Arbiter Hacks V1

Paste each section into the matching Devpost field. Submit to the **Theme Track, Rethinking Waste** only (the event allows one track).

## Project name
Bin Verdict

## Elevator pitch (60 characters or fewer)
Your city's own ruling on which bin an item goes in

## Track
Theme Track: Rethinking Waste

## Theme paragraph (required for the Theme Track)
The problem is contamination and loss in curbside recycling caused by local rules that residents cannot easily check: people put items in the recycling cart that their city does not accept, and throw away items it does accept. The rules differ from city to city. In the ten cities I read, the same pizza box is compost in San Francisco, Seattle and Minneapolis, recycling in Chicago, New York and Portland, and not accepted for recycling in Denver and Urbana, and the majority answer of the other cities would contradict a city's own ruling about one time in ten. To measure whether a tool like this works, a city would give matched collection routes either a city-specific sticker and a link to the lookup or nothing, then compare cart-audit contamination before and after on both groups using its existing cart-tagging or recycling-facility audit method: the share of audited carts with non-accepted items and the share of material by weight that is non-accepted, plus the share of accepted recyclables found in the trash cart. This repository contains no pilot results. What it measures today is how often one-size-fits-all advice would have been wrong and how well the item lookup finds the right item.

## About the project

### What it does
Bin Verdict answers one question: which bin does this item go in, in my city, and what does the city itself say? A resident picks a city and describes an item in their own words, for example "greasy pizza box" or "Dunkin cup with the sleeve". The tool matches the description to one of 65 item types and shows the city's ruling together with the exact sentence from the city's own page, a link to that page, and the date I read it. It also shows the same item in all ten cities, so the places where rules split are visible. A city that does not mention an item gets "not stated" instead of a guess.

The project also measures how often generic advice would be wrong. For every ruling that a city page names or covers with a stated rule, the tool compares it with the majority answer of the other cities to the question "does it belong in the recycling cart?". Across ten cities and 392 comparisons, the majority of the others disagreed with a city's own ruling 38 times (9.7%). In 19 of those cases following the majority would have put a non-accepted item in the recycling cart, and in 19 it would have sent an accepted item to the trash. Eighteen of 59 common items are contested, meaning some cities accept them and others do not.

A city can also use the same data format. A command line script validates a city's rules file, reports coverage and lists the items where that city departs from the majority of the others, which are the likeliest sources of wish-cycling, and it writes a printable cart sticker.

### How I built it
Each city is one JSON file. A ruling records a verdict (recycling, compost, trash, special drop-off, or not accepted in the recycling cart), whether the item was named on the page or covered by a general rule, the source, and the quote. Rulings that were inferred rather than stated are marked and excluded from every statistic. The engine in `src/engine.js` is pure JavaScript with validation, lookup, cross-city comparison, the leave-one-out baseline, and the contested-item ranking, and it is covered by 15 `node:test` tests.

To turn free text into an item type, the app uses the open MiniLM-L6-v2 sentence embedding model (an int8 ONNX export, 23 MB) through transformers.js. The model, the runtime and the WebAssembly files are vendored in the repository, so the web app is a static folder that runs entirely in the browser with no server and no API keys. The embedding of each of 681 item phrases is precomputed. The top three candidate items are shown, so a wrong first guess is one click away. If the model cannot load, the app falls back to plain text matching.

I tested the lookup on 195 descriptions written after the item list was fixed. The embedding model picked the right item first for 80.0% of them and within the top three for 95.9%. Plain text matching (token overlap plus trigram similarity) got 64.6% and 84.6%. A 50/50 blend with an untuned weight scored in between (74.9% and 94.4%), so the app uses the embedding model alone, with text matching only as the fallback.

The site is deployed as static files on Vercel. A headless browser smoke test checks the live site, and the screenshots and the demo video were recorded from it.

### Challenges
The hardest part was the data. City pages are written for residents, not for programs, so the same fact appears as a list, a table, an image caption, or an interactive tool. Chicago's current accepted-materials page is an interactive widget, so its main list comes from a city article dated December 12, 2018, and a handful of rulings (aerosol cans, lithium batteries, hoses and pizza boxes) come from current pages. San Francisco's page lists milk cartons in several columns, and I followed the recycle column and the Recology FAQ. Each ruling therefore keeps its quote and a note where the page is ambiguous. Running the embedding model in plain Node also needed a fix for macOS quarantine flags on the ONNX Runtime library, and running it in the browser needed the self-contained transformers.js bundle.

### Accomplishments
The data and the claims can be checked: every ruling links to its source and every statistic can be regenerated with `npm run stats` and `npm run eval`. The retrieval ablation shows what the language model adds over plain text matching on the same test set.

### What I learned
Local rules differ more than a national label suggests, and the disagreements cluster in a small set of items: paint cans, plastic toys, plastic lids, greasy pizza boxes, paper coffee cups, scrap metal, rigid number 6 plastic and wrapping paper. A city has the most to gain from telling residents about the items on which it departs from its neighbors.

### What is next
More cities and a way for a city to publish its own rules file. A larger test set written by more than one person. Local vocabulary, so a city can use its own item names. A pilot with a city partner using cart audits, as described in the Theme paragraph.

## Honest caveats
- Ten cities and 65 item types, read from each city's own pages on 2026-10-31 and transcribed by hand with an AI coding agent. Cities change their rules, so the source link must be checked.
- The retrieval test set was written by one person after seeing the item list, so it is not independent of that person's vocabulary.
- The 9.7% figure compares each city with the other nine in this dataset. It is not a national estimate.
- Programs with extra rules, such as Portland's separate glass bin or buildings with private haulers, are noted in each ruling and not modeled.
- No users, pilot, contamination reduction or deployment are claimed.

## AI assistance
A Claude-based AI coding agent wrote the code, transcribed the rulings from the city pages, ran the evaluations and drafted this text on my behalf. The lookup uses the open MiniLM-L6-v2 model (Apache-2.0). The narration in the demo video was generated with a text-to-speech voice.

## Built with
JavaScript, Node.js, HTML, CSS, transformers.js, ONNX Runtime Web, MiniLM-L6-v2, Playwright, Vercel, GitHub

## Links
- Public repository: https://github.com/rishabhcli/bin-verdict
- Live demo: https://bin-verdict.vercel.app
- Demo video: the YouTube link added when the video is uploaded (the video file is `arbiter-demo.mp4`)

## Image gallery (in this order)
1. `docs/screenshots/01-ruling-san-francisco.png`: a free-text query matched to an item, with the ruling, the quote and the source
2. `docs/screenshots/02-same-item-every-city.png`: the same item across all ten cities
3. `docs/screenshots/03-ruling-chicago.png`: the same item in Chicago
4. `docs/screenshots/04-findings.png`: how often generic advice is wrong, and the retrieval check
5. `docs/screenshots/05-cart-sticker.png`: a printable cart sticker generated from the rulings

## Team
Solo entry: Rishabh Bansal (Devpost user risban933).
