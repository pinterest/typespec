#!/usr/bin/env python3
"""Create a new skill with full plugin structure, or adopt a local skill.

Usage:
    ./scripts/create-skill.py <skill-name>
    ./scripts/create-skill.py --adopt <skill-name>

Examples:
    ./scripts/create-skill.py my-new-skill
    ./scripts/create-skill.py --adopt my-local-skill
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
MARKETPLACE_JSON = REPO_ROOT / ".claude-plugin" / "marketplace.json"
INIT_SCRIPT = (
    REPO_ROOT
    / "skill-creator"
    / "skills"
    / "skill-creator"
    / "scripts"
    / "init_skill.py"
)
VALIDATE_SCRIPT = (
    REPO_ROOT
    / "skill-creator"
    / "skills"
    / "skill-creator"
    / "scripts"
    / "quick_validate.py"
)


def extract_description(skill_md: Path) -> str:
    """Extract description from SKILL.md YAML frontmatter."""
    if not skill_md.is_file():
        return "TODO: Add description"
    try:
        import yaml
    except ImportError:
        return "TODO: Add description"
    content = skill_md.read_text()
    if not content.startswith("---"):
        return "TODO: Add description"
    try:
        end = content.index("---", 3)
    except ValueError:
        return "TODO: Add description"
    fm = yaml.safe_load(content[3:end])
    if not isinstance(fm, dict):
        return "TODO: Add description"
    return fm.get("description", "TODO: Add description")


def adopt_skill(skill_name: str) -> None:
    """Promote a local skill into .source/."""
    project_root = Path(os.environ.get("PROJECT_ROOT", "."))
    skill_dir = project_root / "agent-skills" / skill_name
    source_dir = project_root / "agent-skills" / ".source"

    # 1. Validate the local skill exists and has SKILL.md
    if not skill_dir.is_dir():
        print(f"Error: agent-skills/{skill_name} does not exist.")
        sys.exit(1)
    if skill_dir.is_symlink():
        print(f"Error: agent-skills/{skill_name} is already a symlink (already adopted?).")
        sys.exit(1)
    if not (skill_dir / "SKILL.md").is_file():
        print(f"Error: agent-skills/{skill_name}/SKILL.md not found.")
        sys.exit(1)
    if not source_dir.is_dir():
        print("Error: agent-skills/.source not found. Run manage-skills.py first.")
        sys.exit(1)

    print(f"==> Adopting skill '{skill_name}' into shared marketplace...")

    # 2. Create plugin wrapper in .source/
    dest_plugin = source_dir / skill_name
    if dest_plugin.is_dir():
        print(f"Error: {source_dir}/{skill_name} already exists.")
        sys.exit(1)

    (dest_plugin / ".claude-plugin").mkdir(parents=True)
    (dest_plugin / "skills").mkdir(parents=True)

    # Extract description and write plugin.json
    description = extract_description(skill_dir / "SKILL.md")

    plugin_json = {
        "name": skill_name,
        "description": description,
        "author": {"name": "pinternal-dev"},
    }
    plugin_json_path = dest_plugin / ".claude-plugin" / "plugin.json"
    plugin_json_path.write_text(json.dumps(plugin_json, indent=2) + "\n")
    print(f"    Created .source/{skill_name}/.claude-plugin/plugin.json")

    # 3. Move skill content into plugin structure
    shutil.move(str(skill_dir), str(dest_plugin / "skills" / skill_name))
    print(
        f"    Moved agent-skills/{skill_name} -> .source/{skill_name}/skills/{skill_name}"
    )

    # 4. Replace with symlink
    os.symlink(f".source/{skill_name}/skills/{skill_name}", str(skill_dir))
    print(
        f"    Created symlink agent-skills/{skill_name} -> .source/{skill_name}/skills/{skill_name}"
    )

    # 5. Add entry to .source marketplace.json
    source_marketplace = source_dir / ".claude-plugin" / "marketplace.json"
    if source_marketplace.is_file():
        data = json.loads(source_marketplace.read_text())
        for plugin in data["plugins"]:
            if plugin["name"] == skill_name:
                print("    Skill already in marketplace.json, skipping.")
                break
        else:
            data["plugins"].append(
                {
                    "name": skill_name,
                    "description": description,
                    "source": f"./{skill_name}",
                    "category": "development",
                }
            )
            source_marketplace.write_text(json.dumps(data, indent=2) + "\n")
            print(f"    Added {skill_name} to marketplace.json")

    # 6. Print next steps
    print()
    print(f"==> Skill '{skill_name}' adopted successfully!")
    print()
    print("Next steps — push to the shared repo:")
    print("  cd agent-skills/.source")
    print(f"  git checkout -b add-{skill_name}")
    print(f"  git add {skill_name} .claude-plugin/marketplace.json")
    print(f"  git commit -m 'Add {skill_name} skill'")
    print(f"  git push -u origin add-{skill_name}")
    print("  # Then open a pull request")


def create_skill(skill_name: str) -> None:
    """Create a new skill with full plugin structure."""
    # Step 1: Validate the skill name
    print(f"==> Validating skill name: {skill_name}")
    sys.path.insert(0, str(VALIDATE_SCRIPT.parent))
    from quick_validate import validate_skill_name

    valid, msg = validate_skill_name(skill_name)
    if not valid:
        print(f"Error: {msg}")
        sys.exit(1)
    print("    Name is valid.")

    skill_dir = REPO_ROOT / skill_name

    # Check if skill already exists
    if skill_dir.is_dir():
        print(f"Error: Directory '{skill_name}' already exists.")
        sys.exit(1)

    # Step 2: Create plugin directory structure
    print("==> Creating plugin structure...")
    (skill_dir / ".claude-plugin").mkdir(parents=True)
    (skill_dir / "skills").mkdir(parents=True)

    # Step 3: Create plugin.json
    plugin_json = {
        "name": skill_name,
        "description": "TODO: Add a description of what this skill does and when to use it.",
        "author": {"name": "pinternal-dev"},
    }
    plugin_json_path = skill_dir / ".claude-plugin" / "plugin.json"
    plugin_json_path.write_text(json.dumps(plugin_json, indent=2) + "\n")
    print(f"    Created {skill_name}/.claude-plugin/plugin.json")

    # Step 4: Run init_skill.py to create skill content
    print("==> Initializing skill content...")
    result = subprocess.run(
        [sys.executable, str(INIT_SCRIPT), skill_name, "--path", str(skill_dir / "skills")],
        check=False,
    )
    if result.returncode != 0:
        sys.exit(result.returncode)

    # Step 5: Add entry to marketplace.json
    print("==> Adding to marketplace.json...")
    data = json.loads(MARKETPLACE_JSON.read_text())
    for plugin in data["plugins"]:
        if plugin["name"] == skill_name:
            print("    Skill already exists in marketplace.json, skipping.")
            break
    else:
        data["plugins"].append(
            {
                "name": skill_name,
                "description": "TODO: Add description",
                "source": f"./{skill_name}",
                "category": "development",
            }
        )
        MARKETPLACE_JSON.write_text(json.dumps(data, indent=2) + "\n")
        print(f"    Added {skill_name} to marketplace.json")

    # Summary
    print()
    print(f"==> Skill '{skill_name}' created successfully!")
    print()
    print("Next steps:")
    print(
        f"  1. Edit {skill_name}/skills/{skill_name}/SKILL.md — fill in the description and content"
    )
    print(
        f"  2. Update {skill_name}/.claude-plugin/plugin.json — add a real description"
    )
    print("  3. Update .claude-plugin/marketplace.json — fill in the description")
    print(
        f"  4. Delete any unneeded example files in scripts/, references/, assets/"
    )
    print("  5. Run 'claude plugin validate .' to verify the structure")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a new skill or adopt a local skill into the shared marketplace."
    )
    parser.add_argument("skill_name", metavar="skill-name", help="Name of the skill")
    parser.add_argument(
        "--adopt",
        action="store_true",
        help="Adopt a local skill into .source/ instead of creating a new one",
    )
    args = parser.parse_args()

    if args.adopt:
        adopt_skill(args.skill_name)
    else:
        create_skill(args.skill_name)


if __name__ == "__main__":
    main()
