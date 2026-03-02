#!/usr/bin/env python3
"""Bootstrap script for agent-skills.

Sets up symlinks so Claude Code, Cursor, and Codex all see the same skill files.

Usage (one-liner install):
    git clone --depth 1 -q git@github.com:pinternal-dev/agent-skills.git "$(mktemp -d)" && python3 "$_/scripts/manage-skills.py"
    git clone --depth 1 -q git@github.com:pinternal-dev/agent-skills.git "$(mktemp -d)" && python3 "$_/scripts/manage-skills.py" --skills emitter-framework,skill-creator

Or run locally (upgrade vendored to live clone, or pull updates):
    python3 agent-skills/.source/scripts/manage-skills.py

Re-vendor (commit live clone changes for your team):
    python3 agent-skills/.source/scripts/manage-skills.py --vendor
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_URL = "git@github.com:pinternal-dev/agent-skills.git"
SOURCE_DIR = Path("agent-skills/.source")
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent


# ── Colors ───────────────────────────────────────────────────────────────

_is_tty = sys.stdout.isatty()

BOLD = "\033[1m" if _is_tty else ""
DIM = "\033[2m" if _is_tty else ""
CYAN = "\033[36m" if _is_tty else ""
YELLOW = "\033[33m" if _is_tty else ""
GREEN = "\033[32m" if _is_tty else ""
RED = "\033[31m" if _is_tty else ""
RESET = "\033[0m" if _is_tty else ""


# ── Helpers ──────────────────────────────────────────────────────────────


def skill_description(skill_md: Path) -> str:
    """Extract description from SKILL.md YAML frontmatter."""
    if not skill_md.is_file():
        return ""
    try:
        import yaml
    except ImportError:
        return ""
    content = skill_md.read_text()
    if not content.startswith("---"):
        return ""
    try:
        end = content.index("---", 3)
    except ValueError:
        return ""
    fm = yaml.safe_load(content[3:end])
    if not isinstance(fm, dict):
        return ""
    return fm.get("description", "") or ""


def print_skill(name: str, color: str, label: str, skill_md: Path) -> None:
    """Print a skill entry with optional description."""
    print(f"    {name} {color}({label}){RESET}")
    desc = skill_description(skill_md)
    if desc:
        if len(desc) > 119:
            desc = desc[:119] + "\u2026"
        print(f"      {DIM}{desc}{RESET}")


def prompt_yn(message: str, default: bool = False) -> bool:
    """Prompt the user for a yes/no answer via /dev/tty."""
    try:
        tty = open("/dev/tty", "r")
    except OSError:
        return default
    try:
        print(message, end=" ", flush=True)
        answer = tty.readline().strip().lower()
    finally:
        tty.close()
    return answer in ("y", "yes")


def prompt_ynd(message: str) -> str:
    """Prompt for y/N/d(iff), return 'y', 'n', or 'd'."""
    try:
        tty = open("/dev/tty", "r")
    except OSError:
        return "n"
    try:
        while True:
            print(message, end=" ", flush=True)
            answer = tty.readline().strip().lower()
            if answer in ("d", "diff"):
                return "d"
            if answer in ("y", "yes"):
                return "y"
            return "n"
    finally:
        tty.close()


# ── .git/info/exclude helpers ────────────────────────────────────────────


def _add_to_info_exclude(entry: str) -> None:
    """Add an entry to .git/info/exclude if not already present."""
    exclude_path = Path(".git/info/exclude")
    if not exclude_path.parent.is_dir():
        exclude_path.parent.mkdir(parents=True, exist_ok=True)
    if exclude_path.is_file():
        content = exclude_path.read_text()
        if entry in content.splitlines():
            return
        with exclude_path.open("a") as f:
            f.write(f"{entry}\n")
    else:
        exclude_path.write_text(f"{entry}\n")
    print(f"    Added {entry} to .git/info/exclude")


def _remove_from_info_exclude(entry: str) -> None:
    """Remove an entry from .git/info/exclude."""
    exclude_path = Path(".git/info/exclude")
    if not exclude_path.is_file():
        return
    lines = exclude_path.read_text().splitlines()
    new_lines = [line for line in lines if line.strip() != entry]
    if len(new_lines) != len(lines):
        exclude_path.write_text(
            ("\n".join(new_lines) + "\n") if new_lines else ""
        )
        print(f"    Removed {entry} from .git/info/exclude")


# ── Source setup ─────────────────────────────────────────────────────────


def setup_source() -> str:
    """Set up .source/ directory. Returns mode: 'fresh', 'upgrade', or 'pull'."""

    if not SOURCE_DIR.is_dir():
        # Fresh install: copy from the repo this script lives in (temp clone)
        print(f"{CYAN}==> Vendoring agent-skills source...{RESET}")
        Path("agent-skills").mkdir(exist_ok=True)
        shutil.copytree(
            str(REPO_ROOT),
            str(SOURCE_DIR),
            ignore=shutil.ignore_patterns(".git"),
        )
        # Write vendor version from the source repo
        commit_hash = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        (SOURCE_DIR / ".vendor-version").write_text(commit_hash + "\n")
        print(f"    Vendored at {commit_hash[:12]}")
        return "fresh"

    if not (SOURCE_DIR / ".git").is_dir():
        # Vendored .source/ -> upgrade to live clone
        print(f"{CYAN}==> Upgrading vendored source to live clone...{RESET}")

        # Mark .source/ files as skip-worktree (keeps them in the index
        # matching HEAD, but git ignores working-tree changes)
        tracked = subprocess.run(
            ["git", "ls-files", "agent-skills/.source/"],
            capture_output=True, text=True, check=True,
        ).stdout.strip().splitlines()

        if tracked:
            subprocess.run(
                ["git", "update-index", "--skip-worktree"] + tracked,
                check=True,
            )

        # Add to .git/info/exclude so the live clone stays invisible to git
        _add_to_info_exclude("agent-skills/.source/")

        # Replace vendored files with a real clone
        shutil.rmtree(SOURCE_DIR)
        subprocess.run(
            ["git", "clone", "--quiet", REPO_URL, str(SOURCE_DIR)],
            check=True,
        )
        print(f"    Cloned live repo into {SOURCE_DIR}")
        return "upgrade"

    # Already a live clone -> pull updates
    print(f"{CYAN}==> Updating existing clone...{RESET}")
    subprocess.run(
        ["git", "-C", str(SOURCE_DIR), "pull", "--ff-only", "--quiet"],
        check=True,
    )
    return "pull"


# ── Vendor ───────────────────────────────────────────────────────────────


def run_vendor() -> None:
    """Re-vendor .source/ from a live clone back to committed files."""
    if not (SOURCE_DIR / ".git").is_dir():
        print(f"{RED}Error: agent-skills/.source/ is not a live clone.{RESET}")
        print("Run bootstrap first to upgrade to a live clone, then use --vendor.")
        sys.exit(1)

    # Read commit hash
    commit_hash = subprocess.run(
        ["git", "-C", str(SOURCE_DIR), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    # Write vendor version
    (SOURCE_DIR / ".vendor-version").write_text(commit_hash + "\n")

    # Remove .git/ from .source/
    shutil.rmtree(SOURCE_DIR / ".git")

    # Remove from .git/info/exclude
    _remove_from_info_exclude("agent-skills/.source/")

    # Clear skip-worktree so git add can stage the updated files
    tracked = subprocess.run(
        ["git", "ls-files", "agent-skills/.source/"],
        capture_output=True, text=True, check=True,
    ).stdout.strip().splitlines()

    if tracked:
        subprocess.run(
            ["git", "update-index", "--no-skip-worktree"] + tracked,
            check=True,
        )

    # Stage changes
    subprocess.run(["git", "add", "agent-skills/.source/"], check=True)

    print(f"{GREEN}==> Re-vendored at {commit_hash[:12]}.{RESET}")
    print(f"Review with {CYAN}git diff --cached{RESET} and commit.")


# ── List installed skills ────────────────────────────────────────────────


def list_skills() -> None:
    """List all installed skills (shared and local)."""
    has_any = False
    has_local = False
    agent_skills = Path("agent-skills")

    if not agent_skills.is_dir():
        print("    (none)")
        return

    # Shared skills (symlinks pointing into .source/)
    for entry in sorted(agent_skills.iterdir()):
        if not entry.is_symlink():
            continue
        target = os.readlink(str(entry))
        if not target.startswith(".source/"):
            continue
        print_skill(entry.name, CYAN, "shared", entry / "SKILL.md")
        has_any = True

    # Local skills (real directories with SKILL.md)
    for entry in sorted(agent_skills.iterdir()):
        if entry.name == ".source":
            continue
        if entry.is_symlink():
            continue
        if not entry.is_dir():
            continue
        if not (entry / "SKILL.md").is_file():
            continue
        print_skill(entry.name, YELLOW, "local", entry / "SKILL.md")
        has_any = True
        has_local = True

    if not has_any:
        print("    (none)")

    if has_local:
        print()
        print(
            f"    {BOLD}Tip:{RESET} Use {CYAN}create-skill.py --adopt <name>{RESET} to promote local skills to shared."
        )


# ── Main bootstrap ───────────────────────────────────────────────────────


def run_bootstrap(skills_arg: str | None) -> None:
    """Run the full bootstrap: set up source, symlink, AGENTS.md."""
    print(f"{BOLD}{CYAN}==> Setting up agent-skills...{RESET}")

    # Step 1: Set up .source/ (state-aware)
    mode = setup_source()

    # Step 2: Determine which skills to install
    if skills_arg:
        skills = [s.strip() for s in skills_arg.split(",") if s.strip()]
    else:
        # Default: all skills from marketplace.json
        marketplace_path = SOURCE_DIR / ".claude-plugin" / "marketplace.json"
        data = json.loads(marketplace_path.read_text())
        skills = [p["name"] for p in data["plugins"]]

    print(f"{CYAN}==> Installing skills: {' '.join(skills)}{RESET}")

    # Step 3: Create skill symlinks
    for skill in skills:
        skill_source = SOURCE_DIR / skill / "skills" / skill
        skill_link = Path("agent-skills") / skill

        if not skill_source.is_dir():
            print(
                f"{YELLOW}Warning: Skill '{skill}' not found at {skill_source}, skipping.{RESET}"
            )
            continue

        # Handle existing path at skill_link
        if skill_link.exists() or skill_link.is_symlink():
            if skill_link.is_symlink():
                # Existing symlink — safe to replace silently
                skill_link.unlink()
            else:
                # Existing directory or file — ask before replacing
                kind = "directory" if skill_link.is_dir() else "file"
                print()
                print(
                    f"    {YELLOW}'{skill_link}' already exists as a {kind}.{RESET}"
                )

                while True:
                    answer = prompt_ynd(f"    {BOLD}Replace it? [y/N/d(iff)]{RESET}")
                    if answer == "d":
                        print()
                        result = subprocess.run(
                            ["git", "diff", "--no-index", "--color=always", str(skill_link), str(skill_source)],
                            capture_output=True,
                            text=True,
                        )
                        output = result.stdout or result.stderr
                        lines = output.splitlines()[:100]
                        if lines:
                            print("\n".join(lines))
                        else:
                            print("    (no differences found)")
                        print()
                        continue
                    elif answer == "y":
                        if skill_link.is_dir():
                            shutil.rmtree(skill_link)
                        else:
                            skill_link.unlink()
                        break
                    else:
                        print(f"    Skipping {skill}.")
                        break
                else:
                    # Should not reach here, but guard anyway
                    continue

                # If user chose 'n', the link still exists — skip
                if skill_link.exists() or skill_link.is_symlink():
                    continue

        os.symlink(f".source/{skill}/skills/{skill}", str(skill_link))
        print(f"    {skill_link} -> .source/{skill}/skills/{skill}")

    # Step 4: Symlink tool skills directories to agent-skills/
    for tool_dir_name in (".claude", ".cursor", ".codex"):
        tool_dir = Path(tool_dir_name)
        tool_dir.mkdir(exist_ok=True)
        tool_link = tool_dir / "skills"

        if tool_link.exists() or tool_link.is_symlink():
            if tool_link.is_symlink():
                tool_link.unlink()
            elif tool_link.is_dir():
                # Find skills inside the existing directory
                existing_skills = [
                    d
                    for d in sorted(tool_link.iterdir())
                    if d.is_dir() and (d / "SKILL.md").is_file()
                ]
                print()
                if existing_skills:
                    names = ", ".join(d.name for d in existing_skills)
                    print(
                        f"    {YELLOW}'{tool_link}' is a directory with skills: {names}{RESET}"
                    )
                    if prompt_yn(
                        f"    {BOLD}Move them to agent-skills/ and replace with symlink? [y/N]{RESET}"
                    ):
                        agent_skills = Path("agent-skills")
                        for skill_dir in existing_skills:
                            dest = agent_skills / skill_dir.name
                            if dest.exists() or dest.is_symlink():
                                print(
                                    f"    {YELLOW}agent-skills/{skill_dir.name} already exists, skipping move.{RESET}"
                                )
                            else:
                                shutil.move(str(skill_dir), str(dest))
                                print(
                                    f"    Moved {skill_dir} -> agent-skills/{skill_dir.name}"
                                )
                        shutil.rmtree(tool_link)
                    else:
                        print(f"    Skipping {tool_dir_name}.")
                        continue
                else:
                    print(
                        f"    {YELLOW}'{tool_link}' already exists as a directory.{RESET}"
                    )
                    if prompt_yn(
                        f"    {BOLD}Replace with symlink to agent-skills/? [y/N]{RESET}"
                    ):
                        shutil.rmtree(tool_link)
                    else:
                        print(f"    Skipping {tool_dir_name}.")
                        continue
            else:
                print()
                print(
                    f"    {YELLOW}'{tool_link}' already exists as a file.{RESET}"
                )
                if prompt_yn(
                    f"    {BOLD}Replace with symlink to agent-skills/? [y/N]{RESET}"
                ):
                    tool_link.unlink()
                else:
                    print(f"    Skipping {tool_dir_name}.")
                    continue

        os.symlink("../agent-skills", str(tool_link))
        print(f"    {tool_link} -> ../agent-skills")

    # Step 5: Discover local skills and offer adoption
    local_skills = []
    agent_skills = Path("agent-skills")
    if agent_skills.is_dir():
        for entry in sorted(agent_skills.iterdir()):
            if entry.name == ".source":
                continue
            if entry.is_symlink():
                continue
            if not entry.is_dir():
                continue
            if not (entry / "SKILL.md").is_file():
                continue
            local_skills.append(entry.name)

    if local_skills:
        print()
        print(
            f"{YELLOW}==> Found local skills: {' '.join(local_skills)}{RESET}"
        )

        for skill in local_skills:
            print()
            if prompt_yn(
                f"    {BOLD}Found local skill '{YELLOW}{skill}{RESET}{BOLD}'. Adopt into shared marketplace? [y/N]{RESET}"
            ):
                print()
                env = os.environ.copy()
                env["PROJECT_ROOT"] = "."
                subprocess.run(
                    [
                        sys.executable,
                        str(SOURCE_DIR / "scripts" / "create-skill.py"),
                        "--adopt",
                        skill,
                    ],
                    env=env,
                    check=False,
                )
            else:
                print(f"    Leaving '{skill}' as a local skill.")

    # Step 6: Generate AGENTS.md
    agents_md = Path("agent-skills/AGENTS.md")
    agents_md.write_text(
        """\
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
"""
    )
    print()
    print(f"{CYAN}==> Generated agent-skills/AGENTS.md{RESET}")

    # Summary
    print()
    print(f"{BOLD}{GREEN}==> Done! Skills installed:{RESET}")
    list_skills()
    print()
    print(
        "Symlinks created for: Claude Code (.claude/skills/), Cursor (.cursor/skills/), Codex (.codex/skills/)"
    )
    print()

    if mode == "fresh":
        if Path(".git").is_dir():
            subprocess.run(
                ["git", "-c", "advice.addEmbeddedRepo=false", "add", "agent-skills/"],
                check=False,
            )
            print(f"Staged. Commit {CYAN}agent-skills/{RESET} to your repo.")
        else:
            print(f"Commit {CYAN}agent-skills/{RESET} to your repo.")
    elif mode == "upgrade":
        print("Live clone ready.")
        print(
            f"  Pull updates:  {CYAN}cd agent-skills/.source && git pull{RESET}"
        )
        print(
            f"  Re-vendor:     {CYAN}python3 agent-skills/.source/scripts/manage-skills.py --vendor{RESET}"
        )
    elif mode == "pull":
        print("Updated.")
        print(
            f"  Re-vendor:     {CYAN}python3 agent-skills/.source/scripts/manage-skills.py --vendor{RESET}"
        )

    print()
    print(
        f"To re-run setup:   {CYAN}python3 agent-skills/.source/scripts/manage-skills.py{RESET}"
    )
    print(
        f"To list skills:    {CYAN}python3 agent-skills/.source/scripts/manage-skills.py --list{RESET}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap agent-skills: clone repo, create symlinks, set up tools."
    )
    parser.add_argument(
        "--list", action="store_true", help="List installed skills and exit"
    )
    parser.add_argument(
        "--skills",
        metavar="skill1,skill2,...",
        help="Comma-separated list of skills to install (default: all from marketplace.json)",
    )
    parser.add_argument(
        "--vendor",
        action="store_true",
        help="Re-vendor .source/ from a live clone back to committed files",
    )
    args = parser.parse_args()

    if args.list:
        print(f"{BOLD}Installed skills:{RESET}")
        list_skills()
        return

    if args.vendor:
        run_vendor()
        return

    run_bootstrap(args.skills)


if __name__ == "__main__":
    main()
