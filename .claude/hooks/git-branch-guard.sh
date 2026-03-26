#!/bin/bash
# Git branch guard hook for Claude Code
# Blocks direct pushes to main — all changes must go through PRs.
#
# Install as a PreToolUse hook in settings.json:
# "hooks": { "PreToolUse": [{ "matcher": "Bash", "command": "bash .claude/hooks/git-branch-guard.sh" }] }

# Read the tool input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only check git push commands
if [[ "$COMMAND" != *"git push"* ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Block pushes to main (various forms)
if [[ "$COMMAND" =~ git\ push.*\ main ]] || \
   [[ "$COMMAND" =~ git\ push.*\ origin\ main ]] || \
   [[ "$COMMAND" =~ git\ push\ --force.*main ]]; then
  echo '{"decision": "block", "message": "Direct push to main is blocked. Use a feature branch + PR instead. (git-branch-guard.sh)"}'
  exit 0
fi

# Block bare "git push" when on main branch (no explicit branch specified)
if [[ "$COMMAND" =~ ^git\ push$ ]] || [[ "$COMMAND" =~ ^git\ push\ *$ ]]; then
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
  if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    echo '{"decision": "block", "message": "You are on main. Direct push to main is blocked. Create a feature branch first. (git-branch-guard.sh)"}'
    exit 0
  fi
fi

# Block force pushes (always ask)
if [[ "$COMMAND" =~ git\ push\ --force ]] || [[ "$COMMAND" =~ git\ push\ -f\ ]]; then
  echo '{"decision": "block", "message": "Force push detected. Are you sure? If so, run the command manually with ! prefix. (git-branch-guard.sh)"}'
  exit 0
fi

# Allow all other pushes (feature branches)
echo '{"decision": "approve"}'
