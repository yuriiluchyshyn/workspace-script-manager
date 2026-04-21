#!/bin/bash
# =============================================================================
# pull-branches.sh - Pull selected branches from remote across multiple repos
#
# Allows selection of repositories and branches, then pulls them from remote
# =============================================================================

set -e

# -- Config -------------------------------------------------------------------
PHOENIX_ROOT="/Volumes/Work/projects/ccsi-ptg/phoenix"

# Available repos (same as other scripts)
REPOS=(
  "apps/public/web-mfe-settings"
  "apps/public/web-mfe-paywall"
  "apps/public/web-mfe-send-fax"
  "apps/public/web-mfe-inbound-faxes"
  "apps/public/web-mfe-fax-cover-pages"
  "apps/public/web-mfe-contacts"
  "apps/public/web-mfe-admin"
  "apps/public/web-mfe-referrals"
  "apps/public/web-mfe-sign"
  "apps/public/web-mfe-help"
  "apps/public/web-mfe-reports"
  "apps/public/web-mfe-billing"
  "apps/public/web-mfe-clarity-presales-admin"
  "apps/public/web-mfe-clarity-presales-customer"
  "apps/public/web-mfe-clarity-self-demo"
  "apps/public/web-mfe-digital-mailroom"
  "apps/public/web-portal-shell"
  "apps/public/web-portal-api"
  "packages/public/web-portal-toolkit"
  "packages/public/web-portal-ui"
  "packages/public/web-portal-theme"
  "packages/public/web-cover-page-templates"
  "packages/public/web-payment-stripe"
  "packages/public/web-theme-core"
  "packages/public/web-theme-efax"
)

# Global variables
declare -a SELECTED_REPOS=()
declare -a REPO_PATHS=()
declare -a REPO_NAMES=()

# -- Helpers ------------------------------------------------------------------
print_header() {
  echo ""
  echo "============================================================"
  echo "  $1"
  echo "============================================================"
  echo ""
}

print_step()  { echo ">> STEP $1: $2"; }
print_ok()    { echo "   ✓ $1"; }
print_error() { echo "   ❌ ERROR: $1"; exit 1; }

# -- Repository Selection ----------------------------------------------------
print_header "Pull Branches from Remote"
print_step "1" "Select repositories"

# Use Python for interactive repository selection
SELECTED_REPOS_RAW=$(python3 << 'PYEOF'
import sys
import tty
import termios
import os

# Open /dev/tty directly so keyboard input works even when stdin is a pipe
tty_fd = open('/dev/tty', 'r')

repos = [
  "apps/public/web-mfe-settings",
  "apps/public/web-mfe-paywall", 
  "apps/public/web-mfe-send-fax",
  "apps/public/web-mfe-inbound-faxes",
  "apps/public/web-mfe-fax-cover-pages",
  "apps/public/web-mfe-contacts",
  "apps/public/web-mfe-admin",
  "apps/public/web-mfe-referrals",
  "apps/public/web-mfe-sign",
  "apps/public/web-mfe-help",
  "apps/public/web-mfe-reports",
  "apps/public/web-mfe-billing",
  "apps/public/web-mfe-clarity-presales-admin",
  "apps/public/web-mfe-clarity-presales-customer",
  "apps/public/web-mfe-clarity-self-demo",
  "apps/public/web-mfe-digital-mailroom",
  "apps/public/web-portal-shell",
  "apps/public/web-portal-api",
  "packages/public/web-portal-toolkit",
  "packages/public/web-portal-ui",
  "packages/public/web-portal-theme",
  "packages/public/web-cover-page-templates",
  "packages/public/web-payment-stripe",
  "packages/public/web-theme-core",
  "packages/public/web-theme-efax",
]

cursor = 0
selected = set()

def get_key():
    fd = tty_fd.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = tty_fd.read(1)
        if ch == '\x1b':
            ch2 = tty_fd.read(1)
            ch3 = tty_fd.read(1)
            return ch + ch2 + ch3
        return ch
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)

def draw():
    out = open('/dev/tty', 'w')
    out.write('\033[2J\033[H')
    out.write('\n')
    out.write('============================================================\n')
    out.write('  Select Repositories (SPACE=toggle, ENTER=confirm, q=quit)\n')
    out.write('============================================================\n\n')

    for i, repo in enumerate(repos):
        name = repo.split('/')[-1]
        check = '[x]' if i in selected else '[ ]'
        if i == cursor:
            out.write(f'  \033[44m\033[97m > {check} {name:<40}\033[0m\n')
        elif i in selected:
            out.write(f'     \033[32m{check} {name}\033[0m\n')
        else:
            out.write(f'     {check} {name}\n')

    out.write('\n')
    if selected:
        names = [repos[i].split('/')[-1] for i in sorted(selected)]
        out.write(f'  Selected ({len(selected)}): {", ".join(names)}\n')
    else:
        out.write('  No repositories selected yet\n')
    out.write('\n  UP/DOWN = navigate   SPACE = toggle   ENTER = confirm   q = quit\n')
    out.flush()
    out.close()

while True:
    draw()
    key = get_key()

    if key == '\x1b[A':  # Up arrow
        cursor = (cursor - 1) % len(repos)
    elif key == '\x1b[B':  # Down arrow
        cursor = (cursor + 1) % len(repos)
    elif key == ' ':  # Space - toggle
        if cursor in selected:
            selected.discard(cursor)
        else:
            selected.add(cursor)
    elif key in ('\r', '\n'):  # Enter
        if not selected:
            out = open('/dev/tty', 'w')
            out.write('\033[31m  Please select at least one repository!\033[0m\n')
            out.flush()
            out.close()
            import time
            time.sleep(1.5)
            continue
        break
    elif key in ('q', 'Q', '\x03'):  # q or Ctrl+C
        out = open('/dev/tty', 'w')
        out.write('\033[2J\033[H')
        out.write('Aborted.\n')
        out.flush()
        out.close()
        sys.exit(1)

# Clear screen and print selected repos one per line to stdout
out = open('/dev/tty', 'w')
out.write('\033[2J\033[H')
out.flush()
out.close()
for i in sorted(selected):
    print(repos[i])
PYEOF
)

# Check if user aborted
if [ $? -ne 0 ]; then
  echo "Aborted by user."
  exit 0
fi

# Parse selected repos into arrays
while IFS= read -r repo_path; do
  [ -z "$repo_path" ] && continue
  SELECTED_REPOS+=("$repo_path")
  REPO_PATHS+=("$PHOENIX_ROOT/$repo_path")
  REPO_NAMES+=("$(basename "$repo_path")")
done <<< "$SELECTED_REPOS_RAW"

print_ok "Selected ${#SELECTED_REPOS[@]} repositories:"
for repo_name in "${REPO_NAMES[@]}"; do
  echo "   - $repo_name"
done

# -- Branch Selection and Pull -----------------------------------------------
print_step "2" "Select branches and pull from remote"

declare -a PULL_RESULTS=()
declare -a FAILED_PULLS=()

for i in "${!REPO_PATHS[@]}"; do
  repo_path="${REPO_PATHS[$i]}"
  repo_name="${REPO_NAMES[$i]}"
  
  echo ""
  echo "   === Processing $repo_name ==="
  
  # Validate git repository
  if [ ! -d "$repo_path/.git" ]; then
    echo "     ❌ Not a git repository: $repo_path"
    FAILED_PULLS+=("$repo_name: Not a git repository")
    continue
  fi
  
  # Fetch latest from remote
  echo "     🔄 Fetching from remote..."
  git -C "$repo_path" fetch origin 2>/dev/null || {
    echo "     ❌ Failed to fetch from remote"
    FAILED_PULLS+=("$repo_name: Failed to fetch from remote")
    continue
  }
  
  # Get current branch
  current_branch=$(git -C "$repo_path" branch --show-current 2>/dev/null || echo "")
  if [ -z "$current_branch" ]; then
    echo "     ❌ No current branch (detached HEAD?)"
    FAILED_PULLS+=("$repo_name: No current branch")
    continue
  fi
  
  echo "     Current branch: $current_branch"
  
  # Get remote branches that have local counterparts
  remote_branches=$(git -C "$repo_path" branch -r --format='%(refname:short)' | grep '^origin/' | grep -v 'origin/HEAD' | sed 's/^origin\///' | sort)
  local_branches=$(git -C "$repo_path" branch --format='%(refname:short)' | sort)
  
  # Find branches that exist both locally and remotely
  available_branches=""
  for remote_branch in $remote_branches; do
    if echo "$local_branches" | grep -q "^$remote_branch$"; then
      available_branches="$available_branches$remote_branch\n"
    fi
  done
  
  # Also add remote-only branches that can be checked out
  remote_only_branches=""
  for remote_branch in $remote_branches; do
    if ! echo "$local_branches" | grep -q "^$remote_branch$"; then
      remote_only_branches="$remote_only_branches$remote_branch (remote-only)\n"
    fi
  done
  
  all_branches=$(echo -e "$available_branches$remote_only_branches" | grep -v '^$' | sort)
  
  if [ -z "$all_branches" ]; then
    echo "     ❌ No remote branches found"
    FAILED_PULLS+=("$repo_name: No remote branches")
    continue
  fi
  
  # Count branches
  branch_count=$(echo "$all_branches" | wc -l | tr -d ' ')
  echo "     Found $branch_count branch(es) available for pull"
  
  # If only current branch is available, ask if user wants to pull it
  if [ "$branch_count" -eq 1 ] && echo "$all_branches" | grep -q "^$current_branch$"; then
    echo "     Only current branch available: $current_branch"
    read -p "     Pull latest changes for $current_branch? (y/n): " PULL_CURRENT
    if [ "$PULL_CURRENT" = "y" ] || [ "$PULL_CURRENT" = "Y" ]; then
      selected_branch="$current_branch"
    else
      echo "     ⏭️  Skipped $repo_name"
      continue
    fi
  else
    # Multiple branches - let user select
    echo "     Available branches:"
    echo "$all_branches" | nl -w2 -s'. '
    echo ""
    read -p "     Select branch number (1-$branch_count) or 'c' for current [$current_branch]: " BRANCH_CHOICE
    
    if [ "$BRANCH_CHOICE" = "c" ] || [ "$BRANCH_CHOICE" = "C" ] || [ -z "$BRANCH_CHOICE" ]; then
      selected_branch="$current_branch"
    elif [[ "$BRANCH_CHOICE" =~ ^[0-9]+$ ]] && [ "$BRANCH_CHOICE" -ge 1 ] && [ "$BRANCH_CHOICE" -le "$branch_count" ]; then
      selected_branch=$(echo "$all_branches" | sed -n "${BRANCH_CHOICE}p" | sed 's/ (remote-only)$//')
    else
      echo "     ❌ Invalid selection"
      FAILED_PULLS+=("$repo_name: Invalid branch selection")
      continue
    fi
  fi
  
  echo "     Selected branch: $selected_branch"
  
  # Check if branch exists locally
  if ! echo "$local_branches" | grep -q "^$selected_branch$"; then
    echo "     🆕 Branch doesn't exist locally, will create and checkout"
    
    # Create and checkout the branch from remote
    checkout_output=$(git -C "$repo_path" checkout -b "$selected_branch" "origin/$selected_branch" 2>&1)
    checkout_result=$?
    
    if [ $checkout_result -eq 0 ]; then
      echo "     ✅ Successfully created and checked out $selected_branch"
      PULL_RESULTS+=("$repo_name: $selected_branch created and checked out from remote")
    else
      echo "     ❌ Failed to create branch from remote"
      echo "     Error: $checkout_output"
      FAILED_PULLS+=("$repo_name: Failed to create $selected_branch - $checkout_output")
    fi
    continue
  fi
  
  # Switch to selected branch if not current
  if [ "$selected_branch" != "$current_branch" ]; then
    echo "     Switching to $selected_branch..."
    
    # Check for uncommitted changes before switching
    uncommitted=$(git -C "$repo_path" status --porcelain)
    if [ -n "$uncommitted" ]; then
      echo "     ⚠️  Uncommitted changes detected:"
      git -C "$repo_path" status --short | head -5
      read -p "     Stash changes and continue? (y/n): " STASH_CHANGES
      if [ "$STASH_CHANGES" = "y" ] || [ "$STASH_CHANGES" = "Y" ]; then
        git -C "$repo_path" stash push -m "Auto-stash before pull script" 2>/dev/null
        echo "     📦 Changes stashed"
      else
        echo "     ⏭️  Skipped (uncommitted changes)"
        FAILED_PULLS+=("$repo_name: Uncommitted changes")
        continue
      fi
    fi
    
    git -C "$repo_path" checkout "$selected_branch" 2>/dev/null
    if [ $? -ne 0 ]; then
      echo "     ❌ Failed to switch to branch"
      FAILED_PULLS+=("$repo_name: Failed to switch to $selected_branch")
      continue
    fi
  fi
  
  # Check if branch is behind remote
  if git -C "$repo_path" show-ref --verify --quiet "refs/remotes/origin/$selected_branch" 2>/dev/null; then
    behind_count=$(git -C "$repo_path" rev-list "$selected_branch..origin/$selected_branch" --count 2>/dev/null || echo "0")
    ahead_count=$(git -C "$repo_path" rev-list "origin/$selected_branch..$selected_branch" --count 2>/dev/null || echo "0")
    
    if [ "$behind_count" -eq 0 ] && [ "$ahead_count" -eq 0 ]; then
      echo "     ✅ Branch is up to date with remote"
      PULL_RESULTS+=("$repo_name: $selected_branch already up to date")
    elif [ "$behind_count" -gt 0 ] && [ "$ahead_count" -eq 0 ]; then
      echo "     📥 Branch is $behind_count commit(s) behind remote"
      echo "     🔄 Pulling latest changes..."
      
      pull_output=$(git -C "$repo_path" pull origin "$selected_branch" 2>&1)
      pull_result=$?
      
      if [ $pull_result -eq 0 ]; then
        echo "     ✅ Successfully pulled $behind_count commit(s)"
        PULL_RESULTS+=("$repo_name: $selected_branch pulled $behind_count commit(s)")
      else
        echo "     ❌ Failed to pull changes"
        echo "     Error: $pull_output"
        FAILED_PULLS+=("$repo_name: Pull failed - $pull_output")
      fi
    elif [ "$behind_count" -gt 0 ] && [ "$ahead_count" -gt 0 ]; then
      echo "     ⚠️  Branch has diverged: $ahead_count ahead, $behind_count behind"
      read -p "     Attempt to pull (may cause merge conflicts)? (y/n): " PULL_DIVERGED
      if [ "$PULL_DIVERGED" = "y" ] || [ "$PULL_DIVERGED" = "Y" ]; then
        pull_output=$(git -C "$repo_path" pull origin "$selected_branch" 2>&1)
        pull_result=$?
        
        if [ $pull_result -eq 0 ]; then
          echo "     ✅ Successfully merged diverged branch"
          PULL_RESULTS+=("$repo_name: $selected_branch merged (was diverged)")
        else
          echo "     ❌ Failed to merge diverged branch"
          echo "     Error: $pull_output"
          FAILED_PULLS+=("$repo_name: Merge failed - $pull_output")
        fi
      else
        echo "     ⏭️  Skipped (diverged branch)"
        FAILED_PULLS+=("$repo_name: Branch diverged, user skipped")
      fi
    else
      echo "     📤 Branch is $ahead_count commit(s) ahead of remote"
      PULL_RESULTS+=("$repo_name: $selected_branch is ahead of remote")
    fi
  else
    echo "     ❌ Remote branch not found"
    FAILED_PULLS+=("$repo_name: Remote branch $selected_branch not found")
  fi
  
  # Switch back to original branch if we changed it
  if [ "$selected_branch" != "$current_branch" ]; then
    echo "     Switching back to $current_branch..."
    git -C "$repo_path" checkout "$current_branch" 2>/dev/null
  fi
done

# -- Summary ------------------------------------------------------------------
print_header "PULL OPERATION SUMMARY"

echo "   📦 Repositories processed: ${#SELECTED_REPOS[@]}"
echo ""

if [ ${#PULL_RESULTS[@]} -gt 0 ]; then
  echo "   ✅ Successful operations (${#PULL_RESULTS[@]}):"
  for result in "${PULL_RESULTS[@]}"; do
    echo "     ✓ $result"
  done
  echo ""
fi

if [ ${#FAILED_PULLS[@]} -gt 0 ]; then
  echo "   ❌ Failed operations (${#FAILED_PULLS[@]}):"
  for failure in "${FAILED_PULLS[@]}"; do
    echo "     ❌ $failure"
  done
  echo ""
fi

echo "   📊 Total: ${#SELECTED_REPOS[@]} repositories"
echo "   ✅ Successful: ${#PULL_RESULTS[@]}"
echo "   ❌ Failed: ${#FAILED_PULLS[@]}"
echo ""

if [ ${#PULL_RESULTS[@]} -gt 0 ]; then
  echo "   🎉 Pull operation completed!"
else
  echo "   ⚠️  No branches were updated successfully"
fi
echo ""