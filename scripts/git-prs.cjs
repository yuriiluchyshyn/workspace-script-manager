#!/usr/bin/env node

"use strict";

/**
 * git-prs.cjs
 *
 * Lists open pull requests for all Phoenix repositories using GitHub CLI (gh).
 *
 * Usage:
 *   node scripts/git-prs.cjs
 */

const execSync = require('child_process').execSync;
const path = require('path');
const fs = require('fs');

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m'; // No Color

// Directory setup - Phoenix root is always at this absolute path
const PHOENIX_DIR = '/Volumes/Work/projects/ccsi-ptg/phoenix';
const DATA_FILE = path.join(PHOENIX_DIR, 'utils', 'web-portal-dev-harness', 'data', 'repos.json');

/**
 * Pads a string to a fixed width.
 * @param {string} str - The string to pad
 * @param {number} width - Target width
 * @returns {string} Padded string
 */
function padEnd(str, width) {
  const safeStr = String(str || '');
  const len = safeStr.replace(/\x1b\[[0-9;]*m/g, '').length;
  return safeStr + ' '.repeat(Math.max(0, width - len));
}

/**
 * Gets open pull requests for a repository using GitHub CLI.
 * @param {string} repoPath - Path to the repository
 * @returns {Array} Array of PR objects
 */
function getOpenPRs(repoPath) {
  try {
    const output = execSync('gh pr list --state open --json isDraft,number,url,title,author,createdAt', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000
    });

    if (!output || output.trim() === '') return [];

    return JSON.parse(output);
  } catch (e) {
    // Check if it is an authentication error
    const stderr = e.stderr ? e.stderr.toString() : '';
    if (stderr.includes('auth login') || stderr.includes('authenticate')) {
        console.error(`${YELLOW}  (Auth required for ${path.basename(repoPath)})${NC}`);
    } else if (stderr) {
        // Log other errors quietly or if verbose
        // console.error(stderr);
    }
    return [];
  }
}

// Check prerequisites
if (!fs.existsSync(DATA_FILE)) {
  console.error(`${RED}Error: Configuration file not found at ${DATA_FILE}${NC}`);
  process.exit(1);
}

// Read repositories from JSON
let reposData;
try {
  const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
  reposData = JSON.parse(rawData);
} catch (e) {
  console.error(`${RED}Error: Failed to parse ${DATA_FILE}: ${e.message}${NC}`);
  process.exit(1);
}

// Map new structure to old format for compatibility
const activeRepos = reposData.repos || [];
const repos = activeRepos.map(function(item) {
  return {
    name: item.name,
    target: item.target
  };
});

console.log(`${BLUE}Fetching Pull Requests for Phoenix repositories...${NC}`);
console.log('');

const allPRs = [];
let authErrors = 0; // Track auth errors

let processed = 0;
// Iterate over repos
for (let i = 0; i < repos.length; i++) {
  const repo = repos[i];
  const repoRelPath = `${repo.target}/${repo.name}`;
  const repoFullPath = path.join(PHOENIX_DIR, repoRelPath); // Corrected path logic using join

  // Visual progress
  processed++;
  process.stdout.write(`\r${DIM}Scanning ${processed}/${repos.length}: ${repo.name}...${NC}   `);

  if (!fs.existsSync(repoFullPath)) {
    continue;
  }

  const prs = getOpenPRs(repoFullPath);
  
  // Add repo name to each PR object for the table
  for (let j = 0; j < prs.length; j++) {
    const pr = prs[j];
    pr.repoName = repo.name;
    allPRs.push(pr);
  }
}

// Clear progress line
process.stdout.write('\r' + ' '.repeat(80) + '\r');

// Display Table
if (allPRs.length === 0) {
  console.log(`${GREEN}No open pull requests found.${NC}`);
  
  // Suggest auth if we saw errors (heuristic: checking if gh auth status is bad)
  try {
      execSync('gh auth status', { stdio: 'ignore' });
  } catch (e) {
      console.log('');
      console.log(`${YELLOW}Warning: GitHub CLI is not authenticated.${NC}`);
      console.log(`Please run: ${BLUE}gh auth login${NC}`);
  }
} else {
  // Sort by date descending (newest first)
  allPRs.sort(function(a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const COL_REPO = 30;
  const COL_AUTHOR = 20;
  const COL_DATE = 12;
  const COL_TYPE = 10;
  
  const header = 
    padEnd('Repository', COL_REPO) +
    padEnd('Author', COL_AUTHOR) +
    padEnd('Created', COL_DATE) +
    padEnd('Type', COL_TYPE) +
    'Link';
    
  console.log(`${DIM}${header}${NC}`);
  console.log(`${DIM}${'─'.repeat(header.length + 30)}${NC}`);

  for (let i = 0; i < allPRs.length; i++) {
    const pr = allPRs[i];
    
    const dateStr = pr.createdAt ? pr.createdAt.substring(0, 10) : '-';
    const typeStr = pr.isDraft ? 'Draft' : 'Open';
    const authorStr = pr.author ? pr.author.login : '?';
    
    // Color code the type
    let typeDisplay = typeStr;
    if (pr.isDraft) {
        typeDisplay = `${DIM}${typeStr}${NC}`;
    } else {
        typeDisplay = `${GREEN}${typeStr}${NC}`;
    }
    
    console.log(
      padEnd(pr.repoName, COL_REPO) +
      padEnd(authorStr, COL_AUTHOR) +
      padEnd(dateStr, COL_DATE) +
      padEnd(typeDisplay, COL_TYPE) +
      pr.url
    );
  }
}
console.log('');
