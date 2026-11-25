# 🍣 Sushi Sprint

[![Make.fun](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/c/best-cooking-game-20261125-0137)
[![Rank](https://make.fun/badge/best-cooking-game-20261125-0137/sukamtiindrawati-dot/sushi-sprint/rank.svg)](https://make.fun/c/best-cooking-game-20261125-0137)
[![Reward](https://make.fun/badge/best-cooking-game-20261125-0137/sukamtiindrawati-dot/sushi-sprint/reward.svg)](https://make.fun/c/best-cooking-game-20261125-0137)

A fast-paced sushi-bar game for the **Make the best cooking game** bounty on
[make.fun](https://make.fun/c/best-cooking-game-20261125-0137). Vanilla
HTML/CSS/JS only — no libraries, no network calls. Open `game/index.html` in a
desktop browser and play.

## How to play

The lunch rush is on! Orders appear on the board with a patience bar.

- **Cook rice** — click the Rice cooker, wait 3 seconds, click again to take it.
- **Add ingredients** — click Nori, Salmon, Tuna or Tamago to put them on the plate.
  Fish stocks refill over time. Click a plate item to remove it.
- **Serve** — click Serve when the plate matches an order exactly. A wrong serve
  costs 30 points; an order that walks out costs 20.
- **Combo** — serve orders in a row to multiply your points.
- **Shift** — 2 minutes. Serve as many orders as you can before time runs out.

Keyboard: `1` rice, `2` nori, `3` salmon, `4` tuna, `5` tamago, `Enter` serve.

## Files

- `game/` — the playable game (`index.html`, `style.css`, `game.js`)
- `screenshots/` — real renders of the game in a browser
- `main.ts` — hands the game in (`MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see [LICENSE](LICENSE).
