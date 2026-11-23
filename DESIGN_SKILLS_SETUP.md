# Optional free Codex design skills — installation instructions

This project includes a local guard skill in `.agents/skills/poker-design-guard/SKILL.md` and project instructions in `AGENTS.md`. Those project files are available to Codex on branches containing them. They do **not** install third-party packages.

To install the requested open-source skills in a **Codex environment that has Node.js and network access**, review their upstream code and run:

```sh
# Official Impeccable installer, supports Codex:
npx impeccable install --providers=codex --scope=project

# Additional agent skills (project-local, no -g):
npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max -a codex
npx skills add emilkowalski/skills --skill animate -a codex
npx skills add emilkowalski/skills --skill review-animations -a codex
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -a codex
```

The official Impeccable installer may offer a design hook. Review it before enabling it. **Never use Impeccable Live's unsafe bypass-agent fallback**; keep copy apply disabled or explicitly chat-only until verified. Do not run arbitrary third-party scripts without reviewing them.

For global **Codex across different repositories**, use the installer global-scope option for Impeccable and `-g` for agent skills in the user's own Codex environment. Project-local installation does not propagate to all other repositories or all ChatGPT chats.

All tools are open source but execution can consume the user's existing Codex usage limit. No extra paid design service is required.

Sources:
- https://github.com/pbakaus/impeccable
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- https://github.com/emilkowalski/skills
- https://github.com/vercel-labs/agent-skills
