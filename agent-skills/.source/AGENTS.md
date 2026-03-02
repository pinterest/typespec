# Agent Instructions

Instructions for agents working on the `agent-skills` repository.

## Repository Structure

This repo is a Claude Code plugin marketplace. Each skill is wrapped in a plugin directory:

```
<skill-name>/
  .claude-plugin/
    plugin.json               # Plugin metadata (name, description, author)
  skills/
    <skill-name>/             # Skill content
      SKILL.md                # Skill definition with YAML frontmatter
      scripts/                # Executable scripts (optional)
      references/             # Reference docs (optional)
      assets/                 # Output files (optional)
```

The root `.claude-plugin/marketplace.json` lists all available plugins.

## Adding a New Skill

Run the scaffolding script:

```bash
./scripts/create-skill.py <skill-name>
```

This creates the plugin structure, generates SKILL.md from a template, and registers the skill in `marketplace.json`.

## Conventions

- **Naming**: kebab-case, lowercase letters/digits/hyphens only, max 64 characters
- **Plugin JSON**: Every skill directory must have `.claude-plugin/plugin.json`
- **Skill content**: Lives under `skills/<skill-name>/` within the plugin wrapper
- **SKILL.md frontmatter**: Must have `name` and `description` fields
- **References**: Detailed documentation goes in `references/`, not in SKILL.md body

## Validation

```bash
claude plugin validate .
```

## Key Files

| File | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Marketplace manifest listing all plugins |
| `<skill>/.claude-plugin/plugin.json` | Per-plugin metadata |
| `<skill>/skills/<skill>/SKILL.md` | Skill definition and instructions |
| `scripts/manage-skills.py` | Cross-tool symlink setup for consuming projects |
| `scripts/create-skill.py` | New skill scaffolding automation |
| `skill-creator/skills/skill-creator/scripts/init_skill.py` | Skill content template generator |
| `skill-creator/skills/skill-creator/scripts/quick_validate.py` | Skill name and structure validation |
