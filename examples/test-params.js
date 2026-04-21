#!/usr/bin/env node
/**
 * Test Node.js script with parameters
 */

// Process argv access
console.log('Script:', process.argv[0]);
console.log('File:', process.argv[1]);
console.log('First arg:', process.argv[2]);
console.log('Second arg:', process.argv[3]);

// Simple argument parsing
const args = process.argv.slice(2);
let name = 'World';
let age = null;
let verbose = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
        name = args[i + 1];
        i++; // skip next arg
    } else if (args[i] === '--age' && args[i + 1]) {
        age = parseInt(args[i + 1]);
        i++; // skip next arg
    } else if (args[i] === '--verbose') {
        verbose = true;
    }
}

console.log(`Hello ${name}!`);
if (age) {
    console.log(`You are ${age} years old`);
}
if (verbose) {
    console.log('Verbose mode enabled');
}