#!/bin/bash

echo "Hello from shell script!"
echo "Current directory: $(pwd)"
echo "Current time: $(date)"

for i in {1..5}; do
    echo "Count: $i"
    sleep 1
done

echo "Shell script completed!"