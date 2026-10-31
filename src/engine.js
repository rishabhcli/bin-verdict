// Bin Verdict core engine. Pure functions over the JSON data in data/. No I/O.

/** Verdict values a city page can give for an item. */
export const VERDICTS = ['recycle', 'compost', 'trash', 'special', 'not-recycling'];
/** How a ruling was derived from the official page. */
export const BASES = ['listed', 'general-rule', 'inferred'];

export const VERDICT_LABEL = {
  recycle: 'Recycling cart',
  compost: 'Compost or organics cart',
  trash: 'Trash cart',
  special: 'No cart: special drop-off, hazardous waste or pickup',
  'not-recycling': 'Not accepted in the recycling cart (the page does not say where it goes instead)'
};

/** Return problems found in a city record (empty array means valid). */
export function validateCity(city, itemIds) {
  const problems = [];
  const need = ['id', 'name', 'state', 'program', 'carts', 'retrieved', 'sources', 'rulings'];
  for (const k of need) if (city[k] === undefined) problems.push(`${city.id ?? '?'}: missing ${k}`);
  if (problems.length) return problems;
  const srcIds = new Set(city.sources.map(s => s.id));
  for (const s of city.sources) {
    if (!/^https:\/\//.test(s.url)) problems.push(`${city.id}: source ${s.id} url must be https`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(city.retrieved)) problems.push(`${city.id}: retrieved must be YYYY-MM-DD`);
  for (const [item, r] of Object.entries(city.rulings)) {
    const at = `${city.id}/${item}`;
    if (!itemIds.has(item)) problems.push(`${at}: unknown item`);
    if (!VERDICTS.includes(r.verdict)) problems.push(`${at}: bad verdict ${r.verdict}`);
    if (!BASES.includes(r.basis)) problems.push(`${at}: bad basis ${r.basis}`);
    if (!srcIds.has(r.source)) problems.push(`${at}: unknown source ${r.source}`);
    if (!r.quote || r.quote.trim().length < 3) problems.push(`${at}: missing quote`);
    if (r.verdict === 'compost' && !city.carts.includes('compost')) problems.push(`${at}: compost verdict in a city without a compost cart`);
  }
  return problems;
}

export function ruling(city, itemId) {
  return city.rulings[itemId] ?? null;
}

/** Rulings used in statistics: the page names the item or states a rule that covers it. */
export function counted(r) {
  return r !== null && r !== undefined && r.basis !== 'inferred';
}

/** The wish-cycling question: does this belong in the recycling cart? */
export function inRecycling(r) {
  return r.verdict === 'recycle';
}

/**
 * One-size-fits-all baseline for a city/item: the majority answer to "recycling cart?"
 * among all OTHER cities with a counted ruling. Ties resolve to "no" (when in doubt, throw it out).
 * Returns null when fewer than `minOthers` other cities rule on the item.
 */
export function genericAnswer(cities, itemId, excludeCityId, minOthers = 3) {
  let yes = 0;
  let no = 0;
  for (const c of cities) {
    if (c.id === excludeCityId) continue;
    const r = ruling(c, itemId);
    if (!counted(r)) continue;
    if (inRecycling(r)) yes += 1; else no += 1;
  }
  if (yes + no < minOthers) return null;
  return { recycle: yes > no, yes, no };
}

/**
 * Leave-one-out measurement. For every counted ruling, ask what generic advice (the majority of the
 * other cities) would have said, and count disagreements.
 */
export function genericErrorRate(cities, minOthers = 3) {
  let pairs = 0;
  let wrong = 0;
  let falseRecycle = 0; // generic says recycle, city says no: contaminates the cart
  let falseKeep = 0; // generic says no, city accepts it: lost recyclables
  const perCity = {};
  const perItem = {};
  for (const c of cities) {
    perCity[c.id] = { pairs: 0, wrong: 0 };
    for (const [item, r] of Object.entries(c.rulings)) {
      if (!counted(r)) continue;
      const g = genericAnswer(cities, item, c.id, minOthers);
      if (!g) continue;
      const truth = inRecycling(r);
      pairs += 1;
      perCity[c.id].pairs += 1;
      perItem[item] ??= { pairs: 0, wrong: 0 };
      perItem[item].pairs += 1;
      if (g.recycle !== truth) {
        wrong += 1;
        perCity[c.id].wrong += 1;
        perItem[item].wrong += 1;
        if (g.recycle) falseRecycle += 1; else falseKeep += 1;
      }
    }
  }
  return { pairs, wrong, rate: pairs ? wrong / pairs : 0, falseRecycle, falseKeep, perCity, perItem };
}

/** Items where cities split on the recycling-cart question, most contested first. */
export function contestedItems(cities, items, minCities = 3) {
  const out = [];
  for (const it of items) {
    const votes = { yes: [], no: [] };
    for (const c of cities) {
      const r = ruling(c, it.id);
      if (!counted(r)) continue;
      (inRecycling(r) ? votes.yes : votes.no).push(c.id);
    }
    const n = votes.yes.length + votes.no.length;
    if (n < minCities) continue;
    const minority = Math.min(votes.yes.length, votes.no.length);
    out.push({ item: it.id, label: it.label, n, yes: votes.yes, no: votes.no, split: minority / n });
  }
  return out.sort((a, b) => b.split - a.split || b.n - a.n);
}

/** Share of items (with >= minCities counted rulings) on which every city agrees. */
export function unanimity(cities, items, minCities = 3) {
  const all = contestedItems(cities, items, minCities);
  const agree = all.filter(x => x.yes.length === 0 || x.no.length === 0).length;
  return { items: all.length, unanimous: agree, contested: all.length - agree };
}

/** Full answer for one city and item, including how many other cities disagree. */
export function answer(cities, cityId, itemId) {
  const city = cities.find(c => c.id === cityId);
  if (!city) throw new Error(`unknown city ${cityId}`);
  const r = ruling(city, itemId);
  if (!r) {
    return { city: city.id, item: itemId, found: false, message: `${city.name} does not say on its official pages, so Bin Verdict will not guess.` };
  }
  const src = city.sources.find(s => s.id === r.source);
  const others = { recycle: 0, not: 0 };
  for (const c of cities) {
    if (c.id === cityId) continue;
    const o = ruling(c, itemId);
    if (!counted(o)) continue;
    if (inRecycling(o)) others.recycle += 1; else others.not += 1;
  }
  const mine = inRecycling(r);
  const disagree = mine ? others.not : others.recycle;
  return {
    city: city.id,
    cityName: city.name,
    item: itemId,
    found: true,
    verdict: r.verdict,
    verdictLabel: VERDICT_LABEL[r.verdict],
    basis: r.basis,
    quote: r.quote,
    note: r.note ?? null,
    source: { url: src.url, title: src.title, retrieved: city.retrieved },
    otherCities: { ...others, disagreeWithThisAnswer: disagree }
  };
}

/** One row per city for an item: the compare-everywhere view. */
export function compare(cities, itemId) {
  return cities.map(c => {
    const r = ruling(c, itemId);
    return { city: c.id, cityName: c.name, verdict: r ? r.verdict : null, basis: r ? r.basis : null, quote: r ? r.quote : null };
  });
}
