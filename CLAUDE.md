# Earth Jukebox: Guardian of Dhaka — notes for Claude Code

Read `docs/HANDOFF.md` first: setup, commands, file map, science rules and the list of tasks left.

- The game is in `game/` (bun + Vite + plain JavaScript + three.js). Work on the `claude/3d-game`
  branch. Use **bun**, never npm.
- Setup: `cd game && bun install && bun run dev`. Checks: `bun run check` (build + smoke test + balance),
  plus `bun tests/planting.js <dev-server-url>`.
- Before saying something works, run it in a browser test and report what passed and what failed.
- Keep the science rules in `docs/HANDOFF.md` ("Rules to keep"): invented streets, real NASA heat;
  land surface temperature is not air temperature; four snapshots are not a trend; fix effects are game
  estimates; 2035/2050 are imagined; the audio is not official NASA audio.
- Keep accessibility working: every sound cue gets a written description (`say()`), HTML UI,
  text-only mode, captions, relaxed mode, reduced motion.
- No runtime network requests; keep the first load under 8 MB; record new assets in `docs/CREDITS.md`.
- Do not rewrite or force-push history. No AI co-author lines in commit messages.
- Ask the user before pushing to `main`, publishing (GitHub Pages), or deleting files.
