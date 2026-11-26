// Token Radar's dashboard (radar-3). It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol detail
// view with the model's own inputs and the protocol's farm plan, a live-token view, and
// the table of category multiples the model is priced from. No network: every byte it
// shows is in data.js, and every row it shows is scored by the model in lib/model.ts.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlistOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + Number(n).toFixed(2); }

  // The model in one function: the page recomputes a row from the snapshot figures and
  // checks the number board.json carries, so the page's code and the board's data are
  // visibly the same arithmetic. Category multiple comes with the row: the median
  // market-cap/TVL of the live protocols in its category, from this same snapshot.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var breadth = 1 + Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_max_chains) * model.breadth_per_chain;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * breadth));
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains,
  // TVL and age decide the action, the capital, the hold and every cost and time. The
  // chain sets the gas: Ethereum is dear, the fast chains are near free.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    if (p.tvl_usd >= 25e6) return 75;
    return 50;
  }
  function gasFor(chain) {
    var c = chain.toLowerCase();
    if (c === 'ethereum' || c === 'bitcoin') return { setup: 'about $12 of gas', weekly: 'about $8 of gas a week' };
    if (c === 'solana' || c === 'sui' || c === 'aptos' || c === 'near' || c === 'ton') return { setup: 'under $1 of gas', weekly: 'a few cents of gas a week' };
    return { setup: 'about $2 of gas', weekly: 'about $1 of gas a week' };
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('restak') >= 0 || c.indexOf('staking pool') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trad') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk cur') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of the protocol's yield-bearing asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('yield aggregator') >= 0) return 'Deposit $' + capital + " into " + name + "'s auto-compounding vault on " + chain + ' and leave it running.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold the basket.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Spend $' + capital + ' through ' + name + ' on ' + chain + ' and keep the account active.';
    if (c.indexOf('chain') >= 0) return 'Use $' + capital + ' of ' + name + ' for gas and one app transaction on its chain.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0) return 'a swap, a deposit or a rebalance';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'a deposit, a borrow or a repayment';
    if (c.indexOf('bridge') >= 0) return 'a bridge or a swap on the destination chain';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'one small trade or a funding payment';
    if (c.indexOf('prediction') >= 0) return 'one market position';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'a restake, a claim or a delegation change';
    return 'a deposit, a swap or a vote';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function watchOut(p, growthPct, fromGlobal) {
    var age = p.age_days === null || p.age_days === undefined ? null : p.age_days;
    if (growthPct <= -10) return 'TVL fell ' + Math.abs(growthPct).toFixed(1) + '% in the last week — check whether one wallet left before you add capital; a falling base earns fewer points per dollar.';
    if (growthPct >= 50) return 'TVL jumped ' + growthPct.toFixed(1) + '% in one week — confirm the deposits stick for a second week before sizing up; one hot week is often one wallet.';
    if (age !== null && age >= 1095) return 'It has run ' + Math.floor(age / 365) + ' years with no token on record — a launch is less certain than for a younger protocol, so keep this farm small.';
    if (p.chains && p.chains.length >= 4) return 'TVL sits on ' + p.chains.length + ' chains — farm on ' + chainOf(p) + ', where the deepest pool is, and skip the thin ones.';
    if (fromGlobal) return 'Its category has fewer than 3 live protocols, so its multiple is the global median — treat the implied value as a rough guide, not a price.';
    return 'Re-check the 7-day growth before each weekly action: a turn in the trend is the first sign the farm is cooling.';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    var growthPct = Math.min(DATA.model.growth_cap, Math.max(DATA.model.growth_floor, p.change_7d === null || p.change_7d === undefined ? 0 : p.change_7d));
    var fromGlobal = (p.category_live_n === null || p.category_live_n === undefined ? 0 : p.category_live_n) < DATA.model.multiple_min_live;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas.setup, time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as ' + weeklyFor(p) + '.', cost: gas.weekly, time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: watchOut(p, growthPct, fromGlobal), cost: 'nothing to check, and it decides the size', time: '10 minutes' },
      { text: "Before you withdraw, open the protocol's own points or rewards page — start from its DefiLlama page at defillama.com/protocol/" + p.slug + ' — and claim only from a link the protocol itself publishes.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl') === '1') state.watchlistOnly = true;
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('wl', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.category_multiple; bv = b.category_multiple; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function sortBtn(key, label) {
    var arrow = state.sort === key ? (state.dir < 0 ? ' v' : ' ^') : '';
    return '<button type="button" data-sort="' + key + '">' + esc(label) + esc(arrow) + '</button>';
  }

  function headerHtml() {
    return '<header class="top">' +
      '<div class="brand"><span class="mark"></span><span class="brand-name">Token Radar</span></div>' +
      '<div class="top-meta"><span>Snapshot ' + esc(DATA.as_of) + '</span><span>DefiLlama protocol index</span><span>' + esc(DATA.model_version) + ' model</span></div>' +
      '</header>';
  }

  function ledeHtml() {
    return '<section class="lede"><div>' +
      '<h1>' + DATA.watchlist_size + ' watchlist protocols, ranked by implied value</h1>' +
      '<p>The watchlist is the floor: every protocol with at least <b>$' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record</b>. ' +
      'The early radar adds <b>' + DATA.early_size + ' pre-token protocols</b> below that floor, so the board holds ' + DATA.board_size + ' rows in all. ' +
      'Each row is priced at its own category\u2019s market multiple — the median market-cap/TVL of the live protocols in that category, read off this same snapshot — not at one flat guess. Implied value is a model, not a promise.</p>' +
      '</div><div class="facts">' +
      '<div class="fact"><span>Watchlist covered</span><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b></div>' +
      '<div class="fact"><span>Pre-token rows scored</span><b>' + DATA.board_size + '</b></div>' +
      '<div class="fact"><span>Early rows below the floor</span><b>' + DATA.early_size + '</b></div>' +
      '<div class="fact"><span>Live-token protocols set aside</span><b>' + DATA.live_size + '</b></div>' +
      '</div></section>';
  }

  function controlsHtml() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    function opts(list, current, allLabel) {
      var h = '<option value="all"' + (current === 'all' ? ' selected' : '') + '>' + esc(allLabel) + '</option>';
      list.forEach(function (c) { h += '<option value="' + esc(c) + '"' + (c === current ? ' selected' : '') + '>' + esc(c) + '</option>'; });
      return h;
    }
    var tabBtn = function (tab, label) {
      return '<button type="button" data-tab="' + tab + '" aria-pressed="' + (state.tab === tab) + '">' + esc(label) + '</button>';
    };
    return '<div class="controls">' +
      '<div class="field"><label for="q">Search</label><input type="search" id="q" placeholder="Search name, category or chain" value="' + esc(state.q) + '" aria-label="Search the board"></div>' +
      '<div class="field"><label for="category">Category</label><select id="category" aria-label="Filter by category">' + opts(categories, state.category, 'All categories') + '</select></div>' +
      '<div class="field"><label for="chain">Chain</label><select id="chain" aria-label="Filter by chain">' + opts(chains, state.chain, 'All chains') + '</select></div>' +
      '<label class="check"><input type="checkbox" id="wl"' + (state.watchlistOnly ? ' checked' : '') + '> Watchlist only</label>' +
      '<div class="field"><span class="sub">Token status</span><div class="tabs">' + tabBtn('pre-token', 'Pre-token') + tabBtn('live', 'Live token') + tabBtn('multiples', 'Multiples') + '</div></div>' +
      '<span class="count">' + (state.tab === 'pre-token' ? filteredRows().length + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : DATA.multiples.length + ' category multiples') + '</span>' +
      '</div>';
  }

  function boardTableHtml() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return '<div class="panel"><div class="empty"><h2>No protocol matches that filter</h2>' +
        '<p>Clear the search or pick another category to see the board again.</p>' +
        '<button class="button primary" type="button" id="clear-filters">Clear filters</button></div></div>';
    }
    var max = 1;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var rows = list.map(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var chains = r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug) + '" tabindex="0">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><div class="name"><b>' + esc(r.name) + (r.watchlist ? ' <span class="badge">Watchlist</span>' : '') + '</b>' +
        '<span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(chains) + '</span></div></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + growthClass + '">' + growth + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + fmtMult(r.category_multiple) + '</td>' +
        '<td><div class="implied"><div class="bar" aria-hidden="true"><i style="width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%"></i></div>' +
        '<span class="num">' + fmtUsd(r.implied_value_usd) + '</span></div></td>' +
        '<td><span class="status">no token</span></td></tr>';
    }).join('');
    return '<div class="panel"><div class="table-wrap"><table>' +
      '<caption class="sub">Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.</caption>' +
      '<thead><tr><th scope="col">' + sortBtn('implied', 'Rank') + '</th><th scope="col">' + sortBtn('name', 'Protocol') + '</th>' +
      '<th scope="col">' + sortBtn('tvl', 'TVL') + '</th><th scope="col">' + sortBtn('growth', '7d') + '</th>' +
      '<th scope="col">' + sortBtn('age', 'Age') + '</th><th scope="col">' + sortBtn('multiple', 'Multiple') + '</th><th scope="col">' + sortBtn('implied', 'Implied value') + '</th><th scope="col">Token</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function liveTableHtml() {
    var rows = DATA.live.map(function (r) {
      var chains = r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      return '<tr><td class="num">live</td>' +
        '<td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(chains) + '</span></div></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
        '<td><span class="status live">already trades</span></td></tr>';
    }).join('');
    return '<div class="panel"><div class="table-wrap"><table>' +
      '<caption class="sub">Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and their multiples price it.</caption>' +
      '<thead><tr><th scope="col">Status</th><th scope="col">Protocol</th><th scope="col">TVL</th><th scope="col">7d</th><th scope="col">Market cap</th><th scope="col">Token</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function multiplesTableHtml() {
    var rows = DATA.multiples.map(function (m) {
      return '<tr><td><b>' + esc(m.category) + '</b></td>' +
        '<td class="num">' + m.live_n + '</td>' +
        '<td class="num">' + fmtMult(m.multiple) + '</td>' +
        '<td class="sub">' + (m.from_global ? 'too few live protocols — priced at the global median' : 'median of its live protocols') + '</td></tr>';
    }).join('');
    return '<div class="panel"><div class="table-wrap"><table>' +
      '<caption class="sub">Where each row\u2019s multiple comes from: the median market-cap/TVL of the live protocols in its category, read off this snapshot. Categories with fewer than 3 live protocols use the global median of all live protocols. Multiples are clamped to 0.05–1.50.</caption>' +
      '<thead><tr><th scope="col">Category</th><th scope="col">Live protocols</th><th scope="col">Multiple</th><th scope="col">Source</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function modelPanelHtml() {
    var m = DATA.model;
    return '<section class="panel model"><h2>How implied value is computed</h2>' +
      '<p class="sub">Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.</p>' +
      '<div class="formula">implied = round( tvl_usd x <b>category multiple</b> x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + 0.02 x min(chains - 1, 4)) )</div>' +
      '<p class="sub">The category multiple is the median market-cap/TVL of the live-token protocols in that category, from this snapshot; a category with fewer than ' + m.multiple_min_live + ' live protocols uses the global median, and every multiple is clamped to ' + m.multiple_floor + '–' + m.multiple_cap + '. ' +
      'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. ' +
      'The early radar is every pre-token protocol below the watchlist floor, and the live-token protocols are set aside with their market caps shown.</p></section>';
  }

  var dialog = document.createElement('dialog');
  dialog.className = 'detail';
  dialog.id = 'detail';
  dialog.setAttribute('aria-labelledby', 'detail-title');
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    var recomputed = impliedOf(row, DATA.model);
    var match = recomputed === row.implied_value_usd;
    var steps = farmSteps(row);
    var stepsHtml = steps.map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return '<li><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
    }).join('');
    var chains = row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain';
    dialog.innerHTML =
      '<div class="detail-head"><div>' +
      '<span class="brand-name">Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · Watchlist' : ' · Early radar') + '</span>' +
      '<h2 id="detail-title">' + esc(row.name) + '</h2>' +
      '<p class="sub">' + esc(row.category || 'Other') + ' on ' + esc(chains) + '</p></div>' +
      '<button class="close" type="button" aria-label="Close details">Close</button></div>' +
      '<section class="detail-section"><h3>Implied value</h3><div class="equation">' +
      '<div><span>TVL</span><b class="num">' + fmtUsd(row.tvl_usd) + '</b></div>' +
      '<div><span>Category multiple (' + esc(row.category || 'Other') + ')</span><b class="num">' + fmtMult(row.category_multiple) + '</b></div>' +
      '<div><span>Seven-day growth</span><b class="num">' + fmtPct(row.change_7d) + '</b></div>' +
      '<div><span>Growth multiplier</span><b class="num">' + fmtMult(row.growth_multiplier) + '</b></div>' +
      '<div><span>Age with no token</span><b class="num">' + fmtAge(row.age_days) + '</b></div>' +
      '<div><span>Maturity multiplier</span><b class="num">' + fmtMult(row.maturity_multiplier) + '</b></div>' +
      '<div><span>Chain breadth (' + (row.chains || []).length + ' chains)</span><b class="num">' + fmtMult(row.breadth_multiplier) + '</b></div>' +
      '<div class="total"><span>Implied value</span><b class="num">' + fmtUsd(row.implied_value_usd) + '</b></div>' +
      '</div><p class="note">Why rank ' + row.rank + ': ' + fmtUsd(row.tvl_usd) + ' of TVL at the ' + esc(row.category || 'Other') + ' multiple of ' + fmtMult(row.category_multiple) + ', with ' + fmtPct(row.change_7d) + ' seven-day growth and ' + fmtAge(row.age_days) + ' with no token on record.</p>' +
      '<p class="note">Model ' + esc(DATA.model_version) + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) +
      (match ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') +
      ' This is an estimate, not a price. The protocol records no token in the snapshot; that is what the record says, not proof it has none.</p></section>' +
      '<section class="detail-section"><h3>Farm plan</h3><ol class="steps">' + stepsHtml + '</ol>' +
      '<p class="note">Costs are per step, in dollars of capital and gas; times are wall-clock per step except the hold, which is calendar days.</p></section>';
    var closeBtn = dialog.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    var html = '<div class="shell">' + headerHtml() + ledeHtml() + controlsHtml();
    if (state.tab === 'pre-token') html += boardTableHtml();
    else if (state.tab === 'live') html += liveTableHtml();
    else html += multiplesTableHtml();
    if (state.tab === 'pre-token') html += modelPanelHtml();
    html += '</div>';
    app.innerHTML = html;
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    bind();
    if (state.selected) openDetail(state.selected);
  }

  function bind() {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; writeHash(); render(); });
    var cat = document.getElementById('category');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chain = document.getElementById('chain');
    if (chain) chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); render(); });
    var wl = document.getElementById('wl');
    if (wl) wl.addEventListener('change', function () { state.watchlistOnly = wl.checked; writeHash(); render(); });
    var clear = document.getElementById('clear-filters');
    if (clear) clear.addEventListener('click', function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; writeHash(); render(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); writeHash(); render(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = -1; }
        render();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('tbody tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
      });
    });
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
