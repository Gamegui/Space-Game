# feature/hangar-mythic-ui — progress and next steps

This file is a working changelog for the branch `feature/hangar-mythic-ui` created and updated by Copilot.

Commits pushed so far
- feat(hangar/mythic/ui): memoize hangar/upgrades, extract cards, reduce mythic particles and memoize views
  - Added: src/components/UpgradeCard.tsx, ChoiceCard.tsx, Hangar.tsx, UpgradePanel.tsx, MythicReveal.tsx
  - Purpose: reduce React re-renders and lower UI GPU/CPU cost for MythicReveal.

- chore(mythics): minor buffs and QoL for existing mythics — post-nova rapid boost, stronger judgement escalation, fleet salvo short boost, void bullets gain homing
  - Updated: src/game/gameLoop.ts (behavioral tweaks for mythics, visual triggers and small rewards)
  - Purpose: make existing mythics feel more impactful without changing drop chances.

Work I'm going to finish in this branch (plan to be executed and committed):
1. Finalize mythic behavior polish
   - Ensure post-nova rapid boost and audio/visual cue are consistent and temporary.
   - Make Judgement escalation slightly stronger + visual clarity.
   - Make Singularity collapse grant a small XP reward and show clear floating text.
   - Overdrive: add temporary crit bonus during active window and restore on end.
   - Fleet: make Final Fleet Salvo visibly stronger and provide brief global damage multiplier while salvo active.
   - Void: while active, player bullets gain homing and extra pierce (already implemented in part); ensure balanced and tested.

2. Hangar / Shards UX
   - Add filters (All / Available / Maxed) and a small recent-shards history area.
   - Ensure buy flow has explicit feedback and does not permit overspend.

3. Menu / ship select polish
   - Display base stats in card, CTA clarity.

4. Performance & tests
   - Run unit + perf smoke tests and address regressions.
   - Keep particle/object budgets enforced.

Notes
- All changes will preserve existing mythic drop logic (rollMythicDrop, MYTHIC_DROP_CHANCE, MAX_MYTHIC_PER_RUN).
- I'll split the work into small commits and PRs where practical for easier review. If you prefer one big PR, tell me and I'll squash before opening.

Status: continuing work now. Next step: run the remaining mythic polish + Hangar history UI and push commits. I will update this changelog as I push.
