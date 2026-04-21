#!/bin/bash

echo "=== DEBUG: Ticket Workflow Script ==="
echo "Starting script execution..."

# Test basic functionality first
echo "DEBUG: Testing basic echo..."
echo "This is a test line"

echo ""
echo "DEBUG: Testing environment..."
echo "PWD: $PWD"
echo "HOME: $HOME"
echo "SHELL: $SHELL"

echo ""
echo "DEBUG: Testing MCP config access..."
MCP_CONFIG="$HOME/.kiro/settings/mcp.json"
if [ -f "$MCP_CONFIG" ]; then
    echo "MCP config file exists: $MCP_CONFIG"
    
    # Test Python access
    echo "DEBUG: Testing Python JSON parsing..."
    JIRA_EMAIL=$(python3 -c "import json; d=json.load(open('$MCP_CONFIG')); print(d['mcpServers']['jira']['env']['JIRA_USERNAME'])" 2>&1)
    echo "JIRA_EMAIL result: $JIRA_EMAIL"
    
    JIRA_API_TOKEN=$(python3 -c "import json; d=json.load(open('$MCP_CONFIG')); print(d['mcpServers']['jira']['env']['JIRA_API_TOKEN'])" 2>&1)
    echo "JIRA_API_TOKEN length: ${#JIRA_API_TOKEN}"
else
    echo "ERROR: MCP config file not found: $MCP_CONFIG"
fi

echo ""
echo "DEBUG: Testing interactive input..."
echo "About to prompt for ticket ID..."

# Test the problematic section
TICKET_ID="${1:-}"

if [ -z "$TICKET_ID" ]; then
  echo ""
  echo "Multi-Repository Ticket Workflow"
  echo "================================"
  echo ""
  echo "DEBUG: About to call read -p..."
  read -p "Enter Jira ticket ID (e.g., PHX-3290): " TICKET_ID
  echo "DEBUG: Read completed, TICKET_ID='$TICKET_ID'"
  
  if [ -z "$TICKET_ID" ]; then
    echo "Error: Ticket ID is required"
    exit 1
  fi
else
  echo "DEBUG: Using provided TICKET_ID: $TICKET_ID"
fi

echo ""
echo "DEBUG: Script completed successfully!"
echo "Final TICKET_ID: $TICKET_ID"