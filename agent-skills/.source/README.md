# agent-skills

Shared skill marketplace for coding agents. Skills can be consumed via the Claude Code plugin system or installed into any tool (Cursor, Codex, etc.) using the bootstrap script.

## Available Skills

| Skill | Description |
|-------|-------------|
| `emitter-framework` | Guide for building TypeSpec emitters using `@typespec/emitter-framework` |
| `skill-creator` | Guide for creating effective skills that extend agent capabilities |

## Quick Start: Claude Code

Add the marketplace and install skills as plugins:

```bash
# Add the marketplace
claude plugin marketplace add pinternal-dev/agent-skills

# Install a skill
claude plugin install emitter-framework --scope project

# Update a skill
claude plugin update emitter-framework
```

## Quick Start: Cross-Tool (Cursor, Codex, Claude Code)

Run the bootstrap script to set up symlinks for all tools at once:

```bash
# Install all skills
git clone --depth 1 -q git@github.com:pinternal-dev/agent-skills.git "$(mktemp -d)" && python3 "$_/scripts/manage-skills.py"

# Install specific skills only
git clone --depth 1 -q git@github.com:pinternal-dev/agent-skills.git "$(mktemp -d)" && python3 "$_/scripts/manage-skills.py" --skills emitter-framework,skill-creator
```

This creates symlinks so `.claude/skills/`, `.cursor/skills/`, and `.codex/skills/` all point to the same skill files. The bootstrap also detects any local skills you've created in `agent-skills/` and offers to link them to your tools or adopt them into the shared marketplace.

To update skills after installation:

- **Vendored mode (default):** Re-run the one-liner above, then commit the updated `agent-skills/` directory.
- **Clone mode:** Run the bootstrap script once to upgrade `.source/` to a live git clone, then pull updates directly:
  ```bash
  # Upgrade to live clone (one-time)
  python3 agent-skills/.source/scripts/manage-skills.py

  # Pull updates
  cd agent-skills/.source && git pull

  # Re-vendor to share with your team
  python3 agent-skills/.source/scripts/manage-skills.py --vendor
  ```

## Creating a New Skill

```bash
./scripts/create-skill.py my-new-skill
```

This creates the full plugin structure with SKILL.md template, scaffolded resources, and adds the skill to the marketplace manifest. Edit the generated files to fill in your skill content.

## Repository Structure

```
agent-skills/
  .claude-plugin/
    marketplace.json          # Marketplace manifest listing all plugins
  <skill-name>/               # Plugin wrapper for each skill
    .claude-plugin/
      plugin.json             # Plugin metadata
    skills/
      <skill-name>/           # Skill content
        SKILL.md              # Skill definition (required)
        scripts/              # Executable scripts (optional)
        references/           # Reference documentation (optional)
        assets/               # Output assets (optional)
  scripts/
    manage-skills.py              # Cross-tool symlink setup
    create-skill.py           # New skill scaffolding
```

## Contributing

### Option A: Create directly in the repo

1. Create a new skill: `./scripts/create-skill.py <name>`
2. Edit `<name>/skills/<name>/SKILL.md` and fill in the content
3. Update `<name>/.claude-plugin/plugin.json` with the description
4. Update `.claude-plugin/marketplace.json` with the description
5. Submit a PR

### Option B: Develop locally, then adopt

Build and test a skill in your own project, then contribute it back:

1. Create a local skill directory: `agent-skills/<name>/SKILL.md`
2. Run bootstrap to link it to your tools: `python3 agent-skills/.source/scripts/manage-skills.py`
3. Iterate on the skill content locally
4. When ready to share, adopt it into the marketplace:
   ```bash
   python3 agent-skills/.source/scripts/create-skill.py --adopt <name>
   ```
5. Push and open a PR:
   ```bash
   cd agent-skills/.source
   git checkout -b add-<name>
   git add <name> .claude-plugin/marketplace.json
   git commit -m "Add <name> skill"
   git push -u origin add-<name>
   ```
