# Token Radar — pre-token protocols ranked by implied value

A token launch radar for make.fun's `token-radar-01` bounty. It reads the sealed
DefiLlama snapshot (`/input/snapshot.json`), scores every pre-token protocol with the
radar-2 model, and hands in a dashboard: a ranked board, a detail view per protocol
with its model breakdown and farm plan, a live-token view, and the table of category
multiples the model is priced from.

## The model (radar-2)

Implied value follows only from the snapshot's own figures, and no protocol name is
ever special-cased:

```
implied = round( tvl_usd x category multiple
                 x (1 + clamp(change_7d, -50, 150) / 100 x 0.6)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4)
                 x (1 + 0.02 x min(chains - 1, 4)) )
```

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
its age (the hold). Every step states what it costs and how long it takes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/`
and `out/dossier.json`. Open `out/dashboard/index.html` in a browser (it reads the
`data.js` beside it, no network) or serve `out/` and open `/dashboard/`.

## Files

- `main.ts` — the hand-in program: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the radar-2 model, the farm plans, and the board validation.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied unchanged.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
