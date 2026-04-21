#!/bin/bash

echo "=== PTY Interactive Test ==="
echo "This tests the same interactive patterns as the ticket workflow script"
echo ""

# Test 1: Simple prompt (like the ticket ID prompt)
echo "Test 1: Ticket ID prompt simulation"
read -p "Enter a test ticket ID (e.g., PHX-1234): " ticket_id
echo "You entered: $ticket_id"
echo ""

# Test 2: Menu selection (like the repo selection)
echo "Test 2: Menu selection simulation"
echo "Select an option:"
echo "1) Option A"
echo "2) Option B" 
echo "3) Option C"
read -p "Enter your choice (1-3): " choice
echo "You selected: $choice"
echo ""

# Test 3: Confirmation prompt
read -p "Does everything look correct? (y/n): " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    echo "✅ Test completed successfully!"
else
    echo "❌ Test cancelled"
fi

echo ""
echo "=== PTY Test Complete ==="