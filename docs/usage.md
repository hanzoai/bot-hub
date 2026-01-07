---
summary: 'How to use the CLI in any setup (search, install, sync, publish).'
read_when:
  - Learning the CLI workflow
  - Explaining install/sync to users
---

# CLI usage (works anywhere)

ClawdHub is folder-agnostic. You can run it from any directory, even if there are no skills there yet.

## Choose where skills live

Use `--workdir` to pick *any* folder as your base, and `--dir` to choose the subfolder where skills install.

Examples:

```bash
clawdhub install gifgrep --workdir /tmp/demo --dir skills
clawdhub list --workdir /tmp/demo --dir skills
```

## Search

```bash
clawdhub search gif --limit 5
```

## Install

Install the latest version into `<workdir>/<dir>/<slug>` (default: `./skills/<slug>`):

```bash
clawdhub install gifgrep
```

## List

```bash
clawdhub list
```

## Update

```bash
clawdhub update --all
```

## Sync (publish local skills)

`sync` scans for local skills and publishes new/changed ones.

You can point it at *any* folder:

- a **skills root** that contains multiple skill folders
- a **single skill folder** (with `SKILL.md`)

Examples:

```bash
clawdhub sync --root /path/to/skills
clawdhub sync --root /path/to/skills/1password --all --changelog "Update tmux flow"
```

If the workdir has no skills, `sync` automatically checks known fallback locations.

## Publish (single skill)

```bash
clawdhub publish /path/to/skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --changelog "Initial release"
```

## Notes

- Skill folders require `SKILL.md` (or `skill.md`).
- Config is stored in `~/Library/Application Support/clawdhub/config.json` (override with `CLAWDHUB_CONFIG_PATH`).
- You can always override registry/site with `--registry` and `--site`.
