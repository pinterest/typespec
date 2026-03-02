# Agent Skills — Guide for AI Agents

This directory contains skills that extend your capabilities. Skills are loaded
automatically via symlinks in `.claude/skills/`, `.cursor/skills/`, and
`.codex/skills/`.

## Updating Skills

There are two modes for managing `agent-skills/.source/`:

**Vendored (default):** `.source/` contains committed files that work on any
fresh clone. To update, re-run the bootstrap one-liner and commit the changes.

**Live clone (for developers):** Run the bootstrap script locally to upgrade
`.source/` to a full git clone for pulling updates directly:
```
python3 agent-skills/.source/scripts/manage-skills.py
```
Then pull updates with `cd agent-skills/.source && git pull`. To share updates
with your team, re-vendor and commit:
```
python3 agent-skills/.source/scripts/manage-skills.py --vendor
```

## Creating a New Local Skill

1. Create a directory: `agent-skills/<skill-name>/`
2. Add a `SKILL.md` file with YAML frontmatter (`name`, `description`) and
   skill content. Use the `skill-creator` skill for guidance on authoring.
3. Run bootstrap to create tool symlinks:
   ```
   python3 agent-skills/.source/scripts/manage-skills.py
   ```

## Contributing a Skill to the Shared Marketplace

To promote a local skill so it can be shared across projects:

```
python3 agent-skills/.source/scripts/create-skill.py --adopt <skill-name>
```

This wraps the skill in a plugin structure inside `agent-skills/.source/`,
replaces the local directory with a symlink, and updates the marketplace
manifest. Then push the changes:

```
cd agent-skills/.source
git checkout -b add-<skill-name>
git add <skill-name> .claude-plugin/marketplace.json
git commit -m "Add <skill-name> skill"
git push -u origin add-<skill-name>
```

Then open a pull request.
