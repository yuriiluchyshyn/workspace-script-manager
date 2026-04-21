#!/usr/bin/env node

const os = require('os');
const path = require('path');

console.log('Hello from CommonJS script!');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Current time: ${new Date().toISOString()}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${os.platform()}`);
console.log(`Architecture: ${os.arch()}`);

// Simulate some work
for (let i = 1; i <= 5; i++) {
    console.log(`Count: ${i}`);
    // Sleep for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log('CommonJS script completed!');