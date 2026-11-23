---
name: poker-design-guard
description: Repository-specific preservation rules for any Poker · совет UI, UX, typography, interaction or motion design task. Always read before design changes.
---

# Poker · совет: design-preserving workflow

## Purpose
Make the CURRENT user-approved adviser interface better without redesigning its information architecture. A beautiful but rearranged screenshot is a FAIL.

## Stages
1. **Freeze**: inspect the approved screenshot, the live markup, and the exact requested change list. Record each element and its place. When screenshot provenance is unclear, ask or report uncertainty rather than choosing an arbitrary generated image.
2. **Critique only**: name specific problems in colors, contrast, spacing, touch targets, border weight, typography, motion and visual hierarchy. Distinguish findings from preferences.
3. **Propose**: supply a small, reversible diff plan. Do not move any blocks. Obtain approval before writing visual files.
4. **Polish**: use approved Dark Focus visual tokens only. No gold, no pink, no heavy metallic shine. Use existing Manrope and Prata unless an alternative is explicitly approved.
5. **Verify**: screenshots of key adviser states, narrow mobile display, manual input and +/- controls, positions, card picker, recommendation, left Raise/Reraise, right Done, explanation below. Compare to original.
6. **Report**: exact files changed and any changed behavior, with a screenshot or note why visual checks were unavailable.

## Skill routing
- **Impeccable**: critique -> audit -> typeset/polish; never use open-ended page generation for an existing accepted screen.
- **UI/UX Pro Max**: style and accessibility references, not permission to change structure.
- **Emil Kowalski**: animate/review-animations; favor functional feedback under ~200 ms, reduced-motion fallback, no ornamental movement.
- **Vercel web-design-guidelines**: independent audit.
- **Playwright**, when available: browser screenshots and interaction regression checks.
If not installed, state that clearly, and continue with this local skill only rather than claim a third-party agent ran.

## Exclusions
No changing poker strategy, solver logic, positions, action sequencing or table size. No direct main-branch deploy as a side effect of a design task. Do not install dependency stacks or use paid APIs without specific authorization.

## User-approved workflow notes
- "Сделал" means the current betting round is done, not confirmation of every advised action.
- "Рейз" dynamically changes to "Ререйз" with recorded action history, but that future behavior must be scoped and approved separately before coding.
- Player count for the next street is chosen in the board-card selection view; calculate pot using known contributions and dropped chips, not solely last raise × remaining players.
These notes are requirements for future planning, not permission to implement them now.
