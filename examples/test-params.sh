#!/bin/bash
# Test shell script with parameters

# Positional parameters
echo "Script name: $0"
echo "First argument: $1"
echo "Second argument: $2"
echo "All arguments: $@"

# getopts example
while getopts ":n:a:v" opt; do
  case $opt in
    n)
      NAME="$OPTARG"
      ;;
    a)
      AGE="$OPTARG"
      ;;
    v)
      VERBOSE=true
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

echo "Name: ${NAME:-Unknown}"
echo "Age: ${AGE:-Unknown}"
if [ "$VERBOSE" = true ]; then
    echo "Verbose mode is ON"
fi