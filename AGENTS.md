# Poker · совет — permanent Codex project instructions

These rules apply to every Codex task opened against this repository. Treat them as project-specific instructions, not as a replacement for the user's latest explicit request.

## Required workflow for design, UX, UI, typography and animation
1. Read the local skill `.agents/skills/poker-design-guard/SKILL.md` before any interface-related task.
2. Use **Impeccable** for critique, audit, typeset and polish when installed. Use **UI/UX Pro Max** for design-system and mobile usability research when installed. Use **Emil Kowalski's animate / review-animations** for motion when installed, and **Vercel web-design-guidelines** for UX and accessibility audits when installed.
3. If any third-party skill is absent, explicitly report that it is not installed; do not pretend to have used it or silently fetch/run scripts. Use the local guard skill meanwhile.
4. Propose a critique and a bounded change list **before modifying visual code**. Wait for the user to approve the chosen changes. Only then implement. Prefer small, reversible diffs and screenshots at mobile widths.
5. For requests unrelated to UI (e.g., poker math or solver validation), use domain-appropriate testing and reasoning. Design skills do not override poker correctness or the user's instructions.

## Hard constraints for the existing adviser
- Preserve the existing table, seat geometry, player positions, dealer placement, hero cards, board input, action input, and recommendation flow unless the user explicitly authorizes a specific structural change.
- The user's approved reference screenshot and stated placement constraints are the source of truth. Do not use later rejected AI-generated images as references.
- **No gold at all** in newly approved styling: no gold borders, gradients, glow or decorative tokens. Dark Focus palette: deep emerald, burgundy, cream and graphite; no pink.
- No generic casino redesign, extra players, MP position, unnecessary buttons, new street navigation or decorative imagery.
- Keep the "number of players" control compatible with manual numeric input and plus/minus, not capped artificially at 4.
- Keep "Рейз / Ререйз" to the LEFT of "Сделал", and the explanation BELOW these actions in the approved design.
- Treat button and sizing calculations as functional behavior requiring explicit tests; never refactor or change poker strategy as a side effect of visual work.
- Add any new features (action history, bankroll contributions, street progression) only after a separate explicit user approval.

## Quality gates
- Before: capture/inspect the original UI and enumerate components to preserve.
- After: compare screenshots and DOM behavior at narrow and normal mobile widths, test focus/touch targets, overflow and accessibility.
- Report the files changed, every functional difference, and tests run. If visual inspection is unavailable, say so.
- Do not merge or deploy to public production without explicit user authorization.
