#!/bin/bash

# Script to switch all Phoenix repositories to develop branch if it exists
# This script reads the repos.json file and switches each repository to develop branch

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if develop branch exists (local or remote)
branch_exists() {
    local repo_path=$1
    
    # Check if develop branch exists locally
    if git -C "$repo_path" show-ref --verify --quiet refs/heads/develop; then
        return 0
    fi
    
    # Check if develop branch exists on remote
    if git -C "$repo_path" show-ref --verify --quiet refs/remotes/origin/develop; then
        return 0
    fi
    
    return 1
}

# Function to switch to develop branch
switch_to_develop() {
    local repo_path=$1
    local repo_name=$(basename "$repo_path")
    
    print_status $BLUE "Processing repository: $repo_name"
    
    # Check if directory exists and is a git repository
    if [[ ! -d "$repo_path" ]]; then
        print_status $RED "  ❌ Directory does not exist: $repo_path"
        return 1
    fi
    
    if [[ ! -d "$repo_path/.git" ]]; then
        print_status $RED "  ❌ Not a git repository: $repo_path"
        return 1
    fi
    
    # Change to repository directory
    cd "$repo_path"
    
    # Fetch latest changes from remote
    print_status $YELLOW "  📡 Fetching latest changes..."
    if ! git fetch origin --quiet; then
        print_status $RED "  ❌ Failed to fetch from remote"
        return 1
    fi
    
    # Check if develop branch exists
    if ! branch_exists "$repo_path"; then
        print_status $YELLOW "  ⚠️  Develop branch does not exist, skipping"
        return 0
    fi
    
    # Get current branch
    current_branch=$(git branch --show-current)
    
    # Check if already on develop
    if [[ "$current_branch" == "develop" ]]; then
        print_status $GREEN "  ✅ Already on develop branch"
        # Pull latest changes if on develop
        if git pull origin develop --quiet; then
            print_status $GREEN "  📥 Updated develop branch"
        else
            print_status $YELLOW "  ⚠️  Could not pull latest changes"
        fi
        return 0
    fi
    
    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_status $RED "  ❌ Repository has uncommitted changes, skipping"
        print_status $RED "      Please commit or stash changes first"
        return 1
    fi
    
    # Switch to develop branch
    print_status $YELLOW "  🔄 Switching from '$current_branch' to 'develop'..."
    
    # Check if develop branch exists locally
    if git show-ref --verify --quiet refs/heads/develop; then
        # Local develop branch exists, just checkout
        if git checkout develop --quiet; then
            print_status $GREEN "  ✅ Switched to develop branch"
            # Pull latest changes
            if git pull origin develop --quiet; then
                print_status $GREEN "  📥 Updated develop branch"
            else
                print_status $YELLOW "  ⚠️  Could not pull latest changes"
            fi
        else
            print_status $RED "  ❌ Failed to switch to develop branch"
            return 1
        fi
    else
        # Local develop branch doesn't exist, create and track remote
        if git checkout -b develop origin/develop --quiet; then
            print_status $GREEN "  ✅ Created and switched to develop branch"
        else
            print_status $RED "  ❌ Failed to create develop branch from remote"
            return 1
        fi
    fi
    
    return 0
}

# Main execution
main() {
    print_status $BLUE "🚀 Starting repository branch switching to develop..."
    echo
    
    # Check if repos.json exists
    local repos_file="utils/web-portal-dev-harness/repos.json"
    if [[ ! -f "$repos_file" ]]; then
        print_status $RED "❌ repos.json not found at: $repos_file"
        print_status $RED "   Please run this script from the Phoenix root directory"
        exit 1
    fi
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        print_status $RED "❌ jq is required but not installed"
        print_status $RED "   Please install jq: brew install jq (macOS) or apt-get install jq (Ubuntu)"
        exit 1
    fi
    
    # Read repositories from repos.json
    local repos=$(jq -r '.repos[] | .path' "$repos_file")
    
    local total_repos=0
    local successful_switches=0
    local skipped_repos=0
    local failed_repos=0
    
    # Process each repository
    while IFS= read -r repo_path; do
        if [[ -n "$repo_path" ]]; then
            total_repos=$((total_repos + 1))
            
            if switch_to_develop "$repo_path"; then
                # Check if we actually switched or just skipped
                cd "$repo_path"
                current_branch=$(git branch --show-current)
                if [[ "$current_branch" == "develop" ]]; then
                    successful_switches=$((successful_switches + 1))
                else
                    skipped_repos=$((skipped_repos + 1))
                fi
            else
                failed_repos=$((failed_repos + 1))
            fi
            
            echo
        fi
    done <<< "$repos"
    
    # Summary
    print_status $BLUE "📊 Summary:"
    print_status $BLUE "   Total repositories: $total_repos"
    print_status $GREEN "   Successfully switched: $successful_switches"
    print_status $YELLOW "   Skipped (no develop branch): $skipped_repos"
    print_status $RED "   Failed: $failed_repos"
    
    if [[ $failed_repos -eq 0 ]]; then
        print_status $GREEN "🎉 All repositories processed successfully!"
    else
        print_status $YELLOW "⚠️  Some repositories could not be switched. Check the output above for details."
    fi
}

# Run main function
main "$@"