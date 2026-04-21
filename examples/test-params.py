#!/usr/bin/env python3
"""
Test script with various parameter patterns for analysis
"""
import sys
import argparse

def main():
    parser = argparse.ArgumentParser(description='Test script with parameters')
    parser.add_argument('--name', help='Your name')
    parser.add_argument('--age', type=int, help='Your age')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    parser.add_argument('input_file', help='Input file path')
    
    args = parser.parse_args()
    
    print(f"Hello {args.name or 'World'}!")
    if args.age:
        print(f"You are {args.age} years old")
    if args.verbose:
        print("Verbose mode enabled")
    print(f"Processing file: {args.input_file}")
    
    # Also test sys.argv access
    if len(sys.argv) > 2:
        print(f"Second argument: {sys.argv[2]}")

if __name__ == "__main__":
    main()