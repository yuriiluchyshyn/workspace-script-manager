#!/bin/bash
# =============================================================================
# ticket-workflow.sh - Multi-Repository Ticket Workflow Automation
#
# Supports single or multiple repository workflows with cross-dependency handling
# =============================================================================

set -e

# -- Config -------------------------------------------------------------------
PHOENIX_ROOT="/Volumes/Work/projects/ccsi-ptg/phoenix"
GITHUB_ORG="ccsi-ptg"
JIRA_BASE_URL="https://consensus.atlassian.net"
REQUIRED_GPG_EMAIL="yurii.luchyshyn@consensus.com"
REVIEWERS="FredLackeyCCSI,jeanbucad,AlHaghy"
FRED_ACCOUNT_ID="712020:efeff26b-377b-40b7-b3e7-6e85629992dc"

# Jira credentials from MCP config
MCP_CONFIG="$HOME/.kiro/settings/mcp.json"
JIRA_EMAIL=$(python3 -c "import json; d=json.load(open('$MCP_CONFIG')); print(d['mcpServers']['jira']['env']['JIRA_USERNAME'])")
JIRA_API_TOKEN=$(python3 -c "import json; d=json.load(open('$MCP_CONFIG')); print(d['mcpServers']['jira']['env']['JIRA_API_TOKEN'])")

# Available repos
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

# Global variables for multi-repo workflow
declare -a SELECTED_REPOS=()
declare -a REPO_PATHS=()
declare -a REPO_NAMES=()
declare -a BRANCH_NAMES=()
declare -a PR_URLS=()

# -- Helpers ------------------------------------------------------------------
print_header() {
  echo ""
  echo "============================================================"
  echo "  $1"
  echo "============================================================"
  echo ""
}
print_step()  { echo ">> STEP $1: $2"; }
print_ok()    { echo "   OK: $1"; }
print_error() { echo "   ERROR: $1"; exit 1; }

to_kebab() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | sed 's/  */ /g' | sed 's/ /-/g' | cut -c1-50
}
# -- Validate inputs ----------------------------------------------------------
TICKET_ID="${1:-}"

# Ask for ticket ID if not provided
if [ -z "$TICKET_ID" ]; then
  echo ""
  echo "Multi-Repository Ticket Workflow"
  echo "================================"
  echo ""
  read -p "Enter Jira ticket ID (e.g., PHX-3290): " TICKET_ID
  if [ -z "$TICKET_ID" ]; then
    echo "Error: Ticket ID is required"
    exit 1
  fi
fi

# Extract ticket ID from URL if a full Jira URL was provided
if echo "$TICKET_ID" | grep -q "consensus.atlassian.net/browse/"; then
  EXTRACTED_ID=$(echo "$TICKET_ID" | sed 's/.*\/browse\///' | sed 's/[?#].*//')
  echo "   Extracted ticket ID: $EXTRACTED_ID"
  TICKET_ID="$EXTRACTED_ID"
fi

TICKET_ID=$(echo "$TICKET_ID" | tr '[:lower:]' '[:upper:]')

# Validate ticket ID format
if ! echo "$TICKET_ID" | grep -qE '^[A-Z]+-[0-9]+$'; then
  print_error "Invalid ticket ID format. Expected format: PHX-1234"
fi
print_header "Multi-Repository Workflow: $TICKET_ID"

# -- Step 0: Check GPG key ---------------------------------------------------
print_step "0" "Checking GPG signing key"

GPG_KEY_ID=$(git config --global user.signingkey 2>/dev/null || echo "")
if [ -n "$GPG_KEY_ID" ]; then
  GPG_UID=$(gpg --list-keys --keyid-format long "$GPG_KEY_ID" 2>/dev/null | grep uid | head -1 || echo "")
  if echo "$GPG_UID" | grep -q "$REQUIRED_GPG_EMAIL"; then
    print_ok "GPG key is configured for $REQUIRED_GPG_EMAIL"
  else
    echo "   GPG key is NOT configured for $REQUIRED_GPG_EMAIL"
    echo "   Please fix your GPG configuration and try again."
    read -p "   Press Enter after you have fixed the GPG key (or Ctrl+C to abort)... "
    GPG_UID=$(gpg --list-keys --keyid-format long "$GPG_KEY_ID" 2>/dev/null | grep uid | head -1 || echo "")
    if ! echo "$GPG_UID" | grep -q "$REQUIRED_GPG_EMAIL"; then
      print_error "GPG key still not configured for $REQUIRED_GPG_EMAIL. Aborting."
    fi
    print_ok "GPG key resolved"
  fi
else
  echo "   No GPG signing key found in git config."
  echo "   Please configure: git config --global user.signingkey <KEY_ID>"
  read -p "   Press Enter after you have fixed the GPG key (or Ctrl+C to abort)... "
fi

# -- Step 1: Fetch Jira ticket info ------------------------------------------
print_step "1" "Fetching Jira ticket info for $TICKET_ID"

# Test Jira API connectivity first
echo "   Testing Jira API connectivity..."
TEST_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/jira_test.json \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/myself" 2>/dev/null)

if [ "$TEST_RESPONSE" != "200" ]; then
  echo "   Jira API connectivity test failed (HTTP $TEST_RESPONSE)"
  echo "   Please check:"
  echo "   1. Internet connection"
  echo "   2. Jira credentials in ~/.kiro/settings/mcp.json"
  echo "   3. VPN connection if required"
  echo ""
  echo "   Current credentials:"
  echo "   - Email: $JIRA_EMAIL"
  echo "   - Token: ${JIRA_API_TOKEN:0:8}..."
  echo ""
  read -p "   Press Enter to continue anyway or Ctrl+C to abort... "
else
  JIRA_USER=$(cat /tmp/jira_test.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('displayName', 'Unknown'))" 2>/dev/null)
  echo "   ✓ Connected to Jira as: $JIRA_USER"
fi

TICKET_JSON=$(curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_ID?fields=summary,description,reporter,status" 2>/dev/null)

if [ -z "$TICKET_JSON" ]; then
  print_error "Failed to fetch ticket data. Check your internet connection and Jira credentials."
fi

if echo "$TICKET_JSON" | grep -q '"errorMessages"'; then
  echo "   Jira API Error:"
  echo "$TICKET_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   ', d.get('errorMessages', ['Unknown error'])[0])" 2>/dev/null || echo "   Unknown Jira error"
  echo "   Raw response: $TICKET_JSON"
  exit 1
fi

TICKET_SUMMARY=$(echo "$TICKET_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['fields']['summary'])" 2>/dev/null)
TICKET_STATUS=$(echo "$TICKET_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['fields']['status']['name'])" 2>/dev/null)
REPORTER_NAME=$(echo "$TICKET_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['fields'].get('reporter'); print(r['displayName'] if r else 'Unknown')" 2>/dev/null)
REPORTER_ACCOUNT_ID=$(echo "$TICKET_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d['fields'].get('reporter'); print(r['accountId'] if r else '')" 2>/dev/null)

if [ -z "$TICKET_SUMMARY" ]; then
  print_error "Could not fetch ticket $TICKET_ID. Check ticket ID and Jira credentials."
fi

print_ok "Ticket: $TICKET_SUMMARY"
print_ok "Status: $TICKET_STATUS"
print_ok "Reporter: $REPORTER_NAME"

SHORT_DESC=$(to_kebab "$TICKET_SUMMARY")
BASE_BRANCH_NAME="${TICKET_ID}_${SHORT_DESC}"
echo "   Base branch name: $BASE_BRANCH_NAME"
# -- Step 2: Multi-Repository Selection ---------------------------------------
print_step "2" "Selecting repositories (multi-select supported)"

# Interactive multi-repo selection
selected=0
total=${#REPOS[@]}
declare -a selected_repos=()

# Function to display menu without clearing screen (fixes blinking)
show_menu() {
  # Save cursor position and clear from current position down
  printf "\033[s\033[J"
  
  echo ""
  echo "============================================================"
  echo "  Multi-Repository Workflow: $TICKET_ID"
  echo "============================================================"
  echo ""
  echo ">> STEP 2: Selecting repositories (multi-select supported)"
  echo ""
  echo "   Use ↑↓ arrows, SPACE to select/deselect, ENTER when done"
  echo "   --------------------------------------------------------"
  
  for i in $(seq 0 $((total - 1))); do
    repo_name=$(basename "${REPOS[$i]}")
    
    # Check if this repo is selected
    is_selected=""
    for sel_repo in "${selected_repos[@]}"; do
      if [ "$sel_repo" = "$i" ]; then
        is_selected="✓"
        break
      fi
    done
    
    if [ $i -eq $selected ]; then
      if [ -n "$is_selected" ]; then
        printf "   → %2d) \033[42m\033[30m[✓] %-35s\033[0m\n" $((i + 1)) "$repo_name"
      else
        printf "   → %2d) \033[44m\033[37m[ ] %-35s\033[0m\n" $((i + 1)) "$repo_name"
      fi
    else
      if [ -n "$is_selected" ]; then
        printf "     %2d) \033[32m[✓] %-35s\033[0m\n" $((i + 1)) "$repo_name"
      else
        printf "     %2d) [ ] %-35s\n" $((i + 1)) "$repo_name"
      fi
    fi
  done
  
  echo ""
  if [ ${#selected_repos[@]} -gt 0 ]; then
    echo "   Selected: ${#selected_repos[@]} repositories"
    echo "   Repositories: $(for idx in "${selected_repos[@]}"; do basename "${REPOS[$idx]}"; done | tr '\n' ' ')"
  else
    echo "   No repositories selected yet"
  fi
  echo "   Use ↑↓ to navigate, SPACE to toggle, ENTER to continue, q to quit"
  
  # Restore cursor position
  printf "\033[u"
}

# Main selection loop
echo ""
echo "============================================================"
echo "  Multi-Repository Workflow: $TICKET_ID"
echo "============================================================"
echo ""
echo ">> STEP 2: Selecting repositories (multi-select supported)"
echo ""
echo "   Use ↑↓ arrows, SPACE to select/deselect, ENTER when done"
echo "   --------------------------------------------------------"

while true; do
  show_menu
  
  # Read single character
  read -rsn1 key
  
  case "$key" in
    $'\x1b')  # ESC sequence
      read -rsn2 key
      case "$key" in
        '[A') # Up arrow
          selected=$(( (selected - 1 + total) % total ))
          ;;
        '[B') # Down arrow
          selected=$(( (selected + 1) % total ))
          ;;
      esac
      ;;
    ' ') # Space - toggle selection
      # Check if already selected
      found=""
      for i in "${!selected_repos[@]}"; do
        if [ "${selected_repos[$i]}" = "$selected" ]; then
          found="$i"
          break
        fi
      done
      
      if [ -n "$found" ]; then
        # Remove from selection
        unset selected_repos[$found]
        selected_repos=("${selected_repos[@]}")  # Re-index array
      else
        # Add to selection
        selected_repos+=("$selected")
      fi
      ;;
    '') # Enter
      if [ ${#selected_repos[@]} -eq 0 ]; then
        echo ""
        echo "   Please select at least one repository"
        sleep 1
        continue
      fi
      break
      ;;
    'q'|'Q')
      echo ""
      echo "   Aborted by user"
      exit 0
      ;;
  esac
done

# Store selected repositories
for repo_idx in "${selected_repos[@]}"; do
  SELECTED_REPOS+=("${REPOS[$repo_idx]}")
  REPO_PATHS+=("$PHOENIX_ROOT/${REPOS[$repo_idx]}")
  REPO_NAMES+=("$(basename "${REPOS[$repo_idx]}")")
  BRANCH_NAMES+=("$BASE_BRANCH_NAME")
done

# Clear screen and show final selection
printf "\033[2J\033[H"
print_header "Multi-Repository Workflow: $TICKET_ID"
print_step "2" "Repository selection complete"

echo "   Selected repositories:"
for i in "${!REPO_NAMES[@]}"; do
  echo "     $((i + 1)). ${REPO_NAMES[$i]}"
done

if [ ${#SELECTED_REPOS[@]} -gt 1 ]; then
  echo ""
  echo "   🔗 Multi-repository workflow detected."
  echo "   📋 Cross-dependency warnings will be added to PRs and Jira comments."
  echo "   ⚠️  All PRs must be merged together for the feature to work properly."
fi
# -- Step 3: Create branches for all repositories ----------------------------
print_step "3" "Creating feature branches in all selected repositories"

for i in "${!REPO_PATHS[@]}"; do
  repo_path="${REPO_PATHS[$i]}"
  repo_name="${REPO_NAMES[$i]}"
  branch_name="${BRANCH_NAMES[$i]}"
  
  echo ""
  echo "   Processing repository: $repo_name"
  
  if [ ! -d "$repo_path/.git" ]; then
    print_error "Not a git repository: $repo_path"
  fi
  
  git -C "$repo_path" fetch origin develop 2>/dev/null || git -C "$repo_path" fetch origin 2>/dev/null
  current_branch=$(git -C "$repo_path" branch --show-current)
  echo "     Current branch: $current_branch"
  
  git -C "$repo_path" checkout develop 2>/dev/null || git -C "$repo_path" checkout -b develop origin/develop 2>/dev/null
  git -C "$repo_path" pull origin develop 2>/dev/null || true
  
  # Check if branch already exists
  if git -C "$repo_path" show-ref --verify --quiet "refs/heads/$branch_name" 2>/dev/null; then
    echo "     Branch '$branch_name' already exists locally."
    read -p "     Create with _v2 suffix? (y/n): " USE_V2
    if [ "$USE_V2" = "y" ] || [ "$USE_V2" = "Y" ]; then
      branch_name="${branch_name}_v2"
      if git -C "$repo_path" show-ref --verify --quiet "refs/heads/$branch_name" 2>/dev/null; then
        branch_name="${branch_name%_v2}_v3"
      fi
      git -C "$repo_path" checkout -b "$branch_name"
      echo "     ✓ Created and switched to branch: $branch_name"
    else
      echo "     ✓ Continuing with existing branch: $branch_name"
      git -C "$repo_path" checkout "$branch_name"
      echo "     ✓ Switched to existing branch: $branch_name"
    fi
    # Update the branch name in our array
    BRANCH_NAMES[$i]="$branch_name"
  else
    git -C "$repo_path" checkout -b "$branch_name"
    echo "     ✓ Created and switched to branch: $branch_name"
  fi
done

print_ok "All branches created successfully"

# -- Step 4: Generate Kiro prompt --------------------------------------------
print_step "4" "Generating Kiro prompt for multi-repository workflow"

JIRA_LINK="$JIRA_BASE_URL/browse/$TICKET_ID"

# Build repository list for prompt
REPO_LIST=""
for i in "${!REPO_NAMES[@]}"; do
  REPO_LIST="$REPO_LIST- ${REPO_NAMES[$i]} (branch: ${BRANCH_NAMES[$i]})\n"
done

MULTI_REPO_NOTE=""
if [ ${#SELECTED_REPOS[@]} -gt 1 ]; then
  MULTI_REPO_NOTE="

**🔗 MULTI-REPOSITORY IMPLEMENTATION**: This ticket spans ${#SELECTED_REPOS[@]} repositories. 

⚠️ **CRITICAL COORDINATION REQUIRED**:
- All PRs must be reviewed together
- All PRs must be merged in coordinated fashion
- Test integration after all merges are complete
- Consider deployment order and timing

Please include prominent cross-dependency warnings in both Jira and PR descriptions."
fi

KIRO_PROMPT="I need you to generate content for ticket $TICKET_ID spanning multiple repositories.

Ticket: $TICKET_SUMMARY
Jira Link: $JIRA_LINK
Repositories:
$REPO_LIST$MULTI_REPO_NOTE

Please generate separate sections for EACH repository:

=== JIRA COMMENT (for product owners) ===
Write a user-friendly Jira comment for product owners. Include:
- Status: ready to review
- Clear summary of what was implemented/fixed
- Business benefits and user impact
- Cross-dependency warning if multiple repositories
- Keep it concise and non-technical

DO NOT include 'PR Link: (will be filled after PR creation)' - the script will add PR links automatically.

=== GIT PR DESCRIPTIONS (for technical leads) ===
For EACH repository, write a separate PR description:

**${REPO_NAMES[0]}:**
[Technical description for ${REPO_NAMES[0]} changes]

$(if [ ${#REPO_NAMES[@]} -gt 1 ]; then
  for i in $(seq 1 $((${#REPO_NAMES[@]} - 1))); do
    echo "**${REPO_NAMES[$i]}:**"
    echo "[Technical description for ${REPO_NAMES[$i]} changes]"
    echo ""
  done
fi)

Include cross-repository dependencies and deployment order if applicable.

Format your response with the exact headers so I can easily copy each section."

echo "$KIRO_PROMPT" | pbcopy

echo ""
echo "   ============================================================"
echo "   Multi-repository Kiro prompt copied to clipboard"
echo "   ============================================================"
echo ""
echo "   Repositories involved: ${#SELECTED_REPOS[@]}"
for repo_name in "${REPO_NAMES[@]}"; do
  echo "   - $repo_name"
done
echo ""
echo "   1. Go to Kiro chat and paste the prompt (Cmd+V)"
echo "   2. Wait for Kiro to generate all sections"
echo "   3. Copy the ENTIRE Kiro response"
echo "   4. Come back here and press Enter"
echo ""
read -p "   Press Enter when you have copied Kiro's response... "
# -- Step 5: Parse Kiro response ---------------------------------------------
print_step "5" "Reading multi-repository Kiro response from clipboard"

KIRO_RESPONSE=$(pbpaste)
if [ -z "$KIRO_RESPONSE" ]; then
  print_error "Clipboard is empty. Please copy Kiro's response and try again."
fi

# Parse Jira comment (single comment for all repos)
JIRA_COMMENT=$(echo "$KIRO_RESPONSE" | sed -n '/=== JIRA COMMENT/,/=== GIT PR DESCRIPTIONS/p' | sed '1d;$d')

if [ -z "$JIRA_COMMENT" ]; then
  echo "   Could not parse JIRA COMMENT section. Using full clipboard."
  JIRA_COMMENT="$KIRO_RESPONSE"
fi

echo ""
echo "   --- Jira Comment Preview (first 3 lines) ---"
echo "$JIRA_COMMENT" | head -3
echo "   ..."
echo ""
read -p "   Jira comment looks good? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "   Aborting. You can re-run the script."
  exit 0
fi

# Parse individual PR descriptions for each repo
declare -a PR_DESCRIPTIONS=()
for i in "${!REPO_NAMES[@]}"; do
  repo_name="${REPO_NAMES[$i]}"
  
  # Extract PR description for this specific repo
  pr_desc=$(echo "$KIRO_RESPONSE" | sed -n "/\*\*$repo_name:\*\*/,/\*\*.*:\*\*/p" | sed '$d' | sed '1d')
  
  # If we couldn't parse individual sections, use a generic description
  if [ -z "$pr_desc" ]; then
    pr_desc="## Multi-Repository Implementation

This PR is part of a multi-repository implementation for $TICKET_ID.

**Cross-Dependencies**: This change requires coordinated deployment with the following repositories:
$(for j in "${!REPO_NAMES[@]}"; do
  if [ $j -ne $i ]; then
    echo "- ${REPO_NAMES[$j]}"
  fi
done)

**⚠️ IMPORTANT**: All related PRs must be merged together for this feature to work properly.

## Changes in this repository
[Repository-specific changes for $repo_name]

## Testing
- Verify functionality works in isolation
- Test integration with other repository changes
- Confirm no breaking changes to existing functionality"
  fi
  
  PR_DESCRIPTIONS+=("$pr_desc")
done

# -- Step 6: Process each repository ------------------------------------------
print_step "6" "Processing commits and PRs for all repositories"

for i in "${!REPO_PATHS[@]}"; do
  repo_path="${REPO_PATHS[$i]}"
  repo_name="${REPO_NAMES[$i]}"
  branch_name="${BRANCH_NAMES[$i]}"
  pr_desc="${PR_DESCRIPTIONS[$i]}"
  
  echo ""
  echo "   === Processing $repo_name ==="
  
  # Determine commit type
  COMMIT_TYPE="fix"
  SUMMARY_LOWER=$(echo "$TICKET_SUMMARY" | tr '[:upper:]' '[:lower:]')
  if echo "$SUMMARY_LOWER" | grep -qE "^(add|implement|create|new|feat)"; then
    COMMIT_TYPE="feat"
  elif echo "$SUMMARY_LOWER" | grep -qE "^(refactor|clean|reorganize)"; then
    COMMIT_TYPE="refactor"
  elif echo "$SUMMARY_LOWER" | grep -qE "^(style|css|design)"; then
    COMMIT_TYPE="style"
  fi
  
  # Check for changes
  CHANGES=$(git -C "$repo_path" status --porcelain)
  if [ -z "$CHANGES" ]; then
    echo "     No changes detected. Skipping commit for $repo_name."
    
    # Check if branch has commits ahead of develop
    AHEAD=$(git -C "$repo_path" rev-list develop.."$branch_name" --count 2>/dev/null || echo "0")
    if [ "$AHEAD" = "0" ]; then
      echo "     No commits ahead of develop. Skipping PR creation for $repo_name."
      PR_URLS+=("")
      continue
    fi
    echo "     Branch has $AHEAD commit(s) ahead of develop. Creating PR..."
  else
    # Commit changes
    COMMIT_MSG="$COMMIT_TYPE($TICKET_ID): $(echo "$TICKET_SUMMARY" | tr '[:upper:]' '[:lower:]' | cut -c1-60) [$repo_name]"
    echo "     Commit message: $COMMIT_MSG"
    
    git -C "$repo_path" add -A
    git -C "$repo_path" commit -S -m "$COMMIT_MSG"
    echo "     ✓ Committed with GPG signature"
    
    git -C "$repo_path" push origin "$branch_name"
    echo "     ✓ Pushed to origin/$branch_name"
  fi
  
  # Create PR
  PR_TITLE="$COMMIT_TYPE($TICKET_ID): $(echo "$TICKET_SUMMARY" | cut -c1-50) [$repo_name]"
  
  # Enhanced PR body with prominent Jira link and cross-repo info
  CROSS_REPO_WARNING=""
  if [ ${#SELECTED_REPOS[@]} -gt 1 ]; then
    CROSS_REPO_WARNING="## ⚠️ Multi-Repository Implementation

This PR is part of a coordinated implementation across ${#SELECTED_REPOS[@]} repositories:
$(for j in "${!REPO_NAMES[@]}"; do
  echo "- ${REPO_NAMES[$j]}"
done)

**CRITICAL**: All related PRs must be reviewed and merged together for this feature to work properly.

## Cross-Dependencies
- This change depends on modifications in other repositories
- Test thoroughly after all PRs are merged
- Coordinate deployment timing with other repository changes

"
  fi

  PR_BODY="## 🎫 Jira Ticket
**[$TICKET_ID: $TICKET_SUMMARY]($JIRA_LINK)**

$CROSS_REPO_WARNING## Description
$pr_desc

## Related Links
- **Jira Ticket**: [$TICKET_ID]($JIRA_LINK)
- **Repository**: $repo_name
- **Branch**: $branch_name"
  
  REPO_FULL="$GITHUB_ORG/$repo_name"
  
  PR_URL=$(gh pr create \
    --repo "$REPO_FULL" \
    --head "$branch_name" \
    --base develop \
    --title "$PR_TITLE" \
    --body "$PR_BODY" 2>&1) || true
  
  if ! echo "$PR_URL" | grep -q "github.com"; then
    echo "     PR creation issue: $PR_URL"
    PR_URL=$(gh pr view "$branch_name" --repo "$REPO_FULL" --json url --jq '.url' 2>/dev/null || echo "")
    if [ -z "$PR_URL" ]; then
      echo "     Could not create or find PR for $repo_name"
      PR_URLS+=("")
      continue
    fi
  fi
  
  PR_URLS+=("$PR_URL")
  PR_NUMBER=$(basename "$PR_URL")
  echo "     ✓ PR created: $PR_URL"
  
  # Add reviewers
  gh pr edit "$PR_NUMBER" --repo "$REPO_FULL" --add-reviewer "$REVIEWERS" 2>/dev/null || echo "     Warning: Could not add some reviewers"
  echo "     ✓ Reviewers added"
done

print_ok "All repositories processed successfully"
# -- Step 7: Create comprehensive Jira comment -------------------------------
print_step "7" "Posting user-friendly Jira comment with all PR links"

# Build PR links list for Jira comment
PR_LINKS_TEXT=""
if [ ${#SELECTED_REPOS[@]} -gt 1 ]; then
  PR_LINKS_TEXT="Pull Requests:"
  for i in "${!REPO_NAMES[@]}"; do
    if [ -n "${PR_URLS[$i]}" ]; then
      PR_TITLE="$COMMIT_TYPE($TICKET_ID): $(echo "$TICKET_SUMMARY" | cut -c1-50) [${REPO_NAMES[$i]}]"
      PR_LINKS_TEXT="$PR_LINKS_TEXT\n• ${REPO_NAMES[$i]}: $PR_TITLE"
    fi
  done
else
  if [ -n "${PR_URLS[0]}" ]; then
    PR_TITLE="$COMMIT_TYPE($TICKET_ID): $(echo "$TICKET_SUMMARY" | cut -c1-50)"
    PR_LINKS_TEXT="Pull Request: $PR_TITLE"
  fi
fi

# Create user-friendly ADF formatted comment
# Split the Jira comment into paragraphs for better formatting
IFS=$'\n' read -rd '' -a COMMENT_LINES <<< "$JIRA_COMMENT"

# Build ADF content array
ADF_CONTENT="["

# Add mention paragraph
ADF_CONTENT="$ADF_CONTENT{\"type\":\"paragraph\",\"content\":[{\"type\":\"mention\",\"attrs\":{\"id\":\"$FRED_ACCOUNT_ID\",\"text\":\"@Fred Lackey\"}},{\"type\":\"text\",\"text\":\" \"},{\"type\":\"mention\",\"attrs\":{\"id\":\"$REPORTER_ACCOUNT_ID\",\"text\":\"@$REPORTER_NAME\"}}]},"

# Add status
ADF_CONTENT="$ADF_CONTENT{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Status: \",\"marks\":[{\"type\":\"strong\"}]},{\"type\":\"text\",\"text\":\"ready to review\"}]},"

# Add PR links as clickable links
for i in "${!PR_URLS[@]}"; do
  if [ -n "${PR_URLS[$i]}" ]; then
    pr_title="$COMMIT_TYPE($TICKET_ID): $(echo "$TICKET_SUMMARY" | cut -c1-40) [${REPO_NAMES[$i]}]"
    ADF_CONTENT="$ADF_CONTENT{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"${REPO_NAMES[$i]}: \",\"marks\":[{\"type\":\"strong\"}]},{\"type\":\"text\",\"text\":\"$pr_title\",\"marks\":[{\"type\":\"link\",\"attrs\":{\"href\":\"${PR_URLS[$i]}\"}}]}]},"
  fi
done

# Add main comment content with proper paragraph breaks
JIRA_COMMENT_CLEAN=$(echo "$JIRA_COMMENT" | sed 's/"/\\"/g' | sed 's/\n/\\n/g')
ADF_CONTENT="$ADF_CONTENT{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"$JIRA_COMMENT_CLEAN\"}]}"

ADF_CONTENT="$ADF_CONTENT]"

ADF_BODY="{\"body\":{\"version\":1,\"type\":\"doc\",\"content\":$ADF_CONTENT}}"

COMMENT_RESULT=$(curl -s -w "%{http_code}" -o /tmp/jira_comment_response.json \
  -X POST \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_ID/comment" \
  -d "$ADF_BODY")

if [ "$COMMENT_RESULT" = "201" ]; then
  print_ok "User-friendly Jira comment posted with all PR links"
else
  echo "   Warning: Jira comment returned HTTP $COMMENT_RESULT"
  echo "   Response: $(cat /tmp/jira_comment_response.json 2>/dev/null)"
fi

# Add remote links for all PRs
for i in "${!PR_URLS[@]}"; do
  if [ -n "${PR_URLS[$i]}" ]; then
    pr_title="$COMMIT_TYPE($TICKET_ID): $(echo "$TICKET_SUMMARY" | cut -c1-40) [${REPO_NAMES[$i]}]"
    curl -s -X POST \
      -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
      -H "Content-Type: application/json" \
      "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_ID/remotelink" \
      -d "{\"object\":{\"url\":\"${PR_URLS[$i]}\",\"title\":\"$pr_title\",\"icon\":{\"url16x16\":\"https://github.com/favicon.ico\",\"title\":\"GitHub\"}}}" \
      > /dev/null 2>&1
  fi
done
print_ok "Remote links added for all PRs"

# -- Step 8: Log time and transition ticket ----------------------------------
print_step "8" "Logging work time and transitioning ticket to Ready to Review"

WORKLOG_DESC="Implemented $TICKET_ID across ${#SELECTED_REPOS[@]} repositories: $(echo "$TICKET_SUMMARY" | cut -c1-80)"
WORKLOG_RESULT=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_ID/worklog" \
  -d "{\"timeSpent\":\"1h\",\"comment\":{\"version\":1,\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"$WORKLOG_DESC\"}]}]}}")

if [ "$WORKLOG_RESULT" = "201" ]; then
  print_ok "Logged 1 hour"
else
  echo "   Warning: Worklog returned HTTP $WORKLOG_RESULT"
fi

# Get available transitions
echo "   Fetching available transitions..."
TRANSITIONS=$(curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_ID/transitions")

echo "   Available transitions:"
echo "$TRANSITIONS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    transitions = data.get('transitions', [])
    for t in transitions:
        print(f'     - {t[\"name\"]} (ID: {t[\"id\"]})')
except:
    print('     Error parsing transitions')
" 2>/dev/null

# Find the best transition with improved logic
TRANSITION_ID=$(echo "$TRANSITIONS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    transitions = data.get('transitions', [])
    
    # Priority order for transitions
    priority_names = [
        'Ready to Review',
        'Ready for Review', 
        'Code Review',
        'Review',
        'In Review',
        'Advance To',
        'To Do'
    ]
    
    # First try exact matches
    for priority_name in priority_names:
        for t in transitions:
            if t['name'].lower().strip() == priority_name.lower().strip():
                print(t['id'])
                sys.exit(0)
    
    # Then try partial matches
    for priority_name in priority_names:
        for t in transitions:
            if priority_name.lower() in t['name'].lower():
                print(t['id'])
                sys.exit(0)
    
    # If no good match, use first available
    if transitions:
        print(transitions[0]['id'])
        
except Exception as e:
    print('', file=sys.stderr)
" 2>/dev/null)

if [ -n "$TRANSITION_ID" ]; then
  echo "   Attempting transition with ID: $TRANSITION_ID"
  TRANS_RESULT=$(curl -s -w "%{http_code}" -o /tmp/jira_transition_response.json \
    -X POST \
    -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$JIRA_BASE_URL/rest/api/3/issue/$TICKET_ID/transitions" \
    -d "{\"transition\":{\"id\":\"$TRANSITION_ID\"}}")
  
  if [ "$TRANS_RESULT" = "204" ]; then
    print_ok "Ticket transitioned to Ready to Review"
  else
    echo "   Warning: Transition returned HTTP $TRANS_RESULT"
    echo "   Response: $(cat /tmp/jira_transition_response.json 2>/dev/null)"
    echo "   Ticket may need manual status update"
  fi
else
  echo "   Warning: No suitable transition found"
  echo "   Please manually update ticket status to 'Ready to Review'"
fi

# -- Step 9: Update CSV reports ----------------------------------------------
print_step "9" "Creating daily CSV report entries for all PRs"

CSV_DIR="/Volumes/Work/projects/ccsi-ptg/phoenix/.pr-reports"
CSV_DATE=$(date +%Y-%m-%d)
CSV_FILE="$CSV_DIR/$CSV_DATE.csv"

# Ensure directory exists
if [ ! -d "$CSV_DIR" ]; then
  mkdir -p "$CSV_DIR"
  echo "   Created directory: $CSV_DIR"
fi

# Create CSV file with headers if it doesn't exist
if [ ! -f "$CSV_FILE" ]; then
  echo "Date,PR Created At,Ticket,Ticket Link,PR Link,Status,Description" > "$CSV_FILE"
  echo "   Created new CSV file: $CSV_FILE"
fi

PR_CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CSV_DESC=$(echo "$TICKET_SUMMARY" | sed 's/,/ /g' | cut -c1-100)

# Add entries for each PR
ENTRIES_ADDED=0
for i in "${!PR_URLS[@]}"; do
  if [ -n "${PR_URLS[$i]}" ]; then
    repo_desc="$CSV_DESC [${REPO_NAMES[$i]}]"
    echo "$CSV_DATE,$PR_CREATED_AT,$TICKET_ID,$JIRA_LINK,${PR_URLS[$i]},ready to review,$repo_desc" >> "$CSV_FILE"
    ENTRIES_ADDED=$((ENTRIES_ADDED + 1))
    echo "   Added CSV entry for ${REPO_NAMES[$i]}"
  fi
done

if [ $ENTRIES_ADDED -gt 0 ]; then
  print_ok "Added $ENTRIES_ADDED CSV entries to $CSV_FILE"
  echo "   File location: $CSV_FILE"
  echo "   Total lines in file: $(wc -l < "$CSV_FILE")"
else
  echo "   Warning: No PR URLs available, no CSV entries added"
fi

# -- Final Summary --------------------------------------------------------
print_header "MULTI-REPOSITORY WORKFLOW COMPLETE"

echo "   🎫 Ticket:      $TICKET_ID - $TICKET_SUMMARY"
echo "   📊 Status:      Ready to Review"
echo "   🔗 Jira Link:   $JIRA_LINK"
echo "   ⏱️  Time logged: 1 hour"
echo "   👥 Reviewers:   $REVIEWERS"
echo "   📁 CSV Report:  $CSV_FILE"
echo ""
echo "   📦 Repositories (${#SELECTED_REPOS[@]}):"
for i in "${!REPO_NAMES[@]}"; do
  echo "     ${REPO_NAMES[$i]}:"
  echo "       Branch: ${BRANCH_NAMES[$i]}"
  if [ -n "${PR_URLS[$i]}" ]; then
    echo "       PR:     ${PR_URLS[$i]}"
  else
    echo "       PR:     ❌ Not created (no changes or error)"
  fi
done
echo ""

if [ ${#SELECTED_REPOS[@]} -gt 1 ]; then
  echo "   🚨 CRITICAL MULTI-REPOSITORY COORDINATION REQUIRED:"
  echo "   =================================================="
  echo "   ⚠️  All PRs must be reviewed together as a coordinated set"
  echo "   ⚠️  All PRs must be merged in the correct order"
  echo "   ⚠️  Test integration thoroughly after all merges"
  echo "   ⚠️  Consider deployment timing and dependencies"
  echo ""
  echo "   📋 Next Steps:"
  echo "   1. Notify reviewers about multi-repo coordination"
  echo "   2. Review all PRs together before any merges"
  echo "   3. Plan merge order and timing"
  echo "   4. Test integration after all merges complete"
else
  echo "   📋 Next Steps:"
  echo "   1. PR is ready for standard review process"
  echo "   2. Address any review feedback"
  echo "   3. Merge when approved"
fi
echo ""
echo "   ✅ Workflow completed successfully!"
echo ""