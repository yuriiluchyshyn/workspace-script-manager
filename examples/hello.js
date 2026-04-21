#!/usr/bin/env node

const os = require('os');

console.log('Hello from JavaScript file!');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Current time: ${new Date().toISOString()}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${os.platform()}`);

// Simulate some async work
async function countdown() {
    for (let i = 1; i <= 5; i++) {
        console.log(`Count: ${i}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('JavaScript script completed!');
}

countdown().catch(console.error);