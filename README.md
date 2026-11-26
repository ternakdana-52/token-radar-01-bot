# Token Radar — pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ternakdana-52/token-radar-01-bot/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ternakdana-52/token-radar-01-bot/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar for make.fun's `token-radar-01` bounty. It reads the sealed
DefiLlama snapshot (`/input/snapshot.json`), scores every pre-token protocol with the
radar-3 model, and hands in a dashboard: a ranked board with each row's category
multiple on show, a detail view per protocol with its model breakdown, a why-this-rank
line and farm plan, a live-token view, and the table of category multiples the model
is priced from.

## The model (radar-3)

Implied value follows only from the snapshot's own figures, and no protocol name is
ever special-cased:

```
implied = round( tvl_usd x category multiple
                 x (1 + clamp(change_7d, -50, 80) / 100 x 0.5)
                 x (0.7 + min(age_days, 1095) / 1095 x 0.3)
                 x (1 + 0.02 x min(chains - 1, 4)) )
```

radar-3 damps the two noisiest inputs. A single week's TVL move is often one wallet,
not a trend, so seven-day growth is clamped to -50..+80 per cent and weighted at 0.5:
the growth multiplier moves implied value by 0.75x to 1.40x, never nearly double. Age
is the weakest signal — a protocol that has run three years with no token is
established but no nearer a launch — so maturity moves implied value by 0.70x to
1.00x. TVL at the category multiple does the pricing; growth and age only tilt it.

The **category multiple** is the market's own FDV/TVL for that category: the median
market-cap/TVL of the live-token protocols in the same category, read off this same
snapshot (at least 3 live protocols, else the global median; clamped to 0.05–1.50).
A lending protocol and a bridge do not trade at the same multiple of TVL, and the
snapshot itself says so.

The board ranks 198 pre-token protocols: the whole 40-protocol watchlist plus every
other pre-token protocol that passes the watchlist's own rule — no Bridge, Canonical
Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX category, no versioned
pool, no name carrying a whole word wrapped, staked or staking, and no name beginning
with an exchange's name. A wrapped or staked product of a token that already trades
is not a launch still to come. Protocols whose token already trades are set aside in
the Live view with their market caps — facts, not a model.

Farm plans are derived per protocol from its category (the action), its first chain
(the gas: Ethereum is dear, the fast chains near free), its TVL (the capital) and
its age (the hold). One step is a watch-out read off the same figures — a falling
week, a hot week, a long run with no token, TVL spread over many chains, or a
multiple borrowed from the global median — and the claim step starts from the
protocol's own DefiLlama page, `defillama.com/protocol/<slug>`. Every step states
what it costs and how long it takes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/`
and `out/dossier.json`. Open `out/dashboard/index.html` in a browser (it reads the
`data.js` beside it, no network) or serve `out/` and open `/dashboard/`.

## Files

- `main.ts` — the hand-in program: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the radar-3 model, the farm plans, and the board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied unchanged.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
