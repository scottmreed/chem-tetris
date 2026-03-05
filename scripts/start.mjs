#!/usr/bin/env node
/**
 * Startup script for ChemIllusion Discord Activity
 * 
 * This script ensures extensionless is loaded before any Node.js processes start,
 * making it compatible with Cursor's cloud environment and other environments
 * where NODE_OPTIONS may not be properly loaded.
 * 
 * Usage:
 *   node scripts/start.mjs dev    # Start development server
 *   node scripts/start.mjs start   # Start production server
 *   node scripts/start.mjs build   # Build the project
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

// Import extensionless/register FIRST before any other imports
// This enables extensionless module resolution for Node.js
import 'extensionless/register';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Ensure we're in the project root
process.chdir(projectRoot);

// Check if node_modules exists (dependencies installed)
const nodeModulesPath = join(projectRoot, 'node_modules');
if (!existsSync(nodeModulesPath)) {
	console.error('Error: node_modules not found. Please run "npm install" first.');
	process.exit(1);
}

// Check if extensionless is installed
const extensionlessPath = join(nodeModulesPath, 'extensionless');
if (!existsSync(extensionlessPath)) {
	console.error('Error: extensionless package not found. Please run "npm install" first.');
	process.exit(1);
}

// Get the command to run (dev, start, build, etc.)
const command = process.argv[2] || 'dev';

// Map commands to robox commands
const roboxCommands = {
	dev: 'dev',
	start: 'start',
	build: 'build',
	deploy: 'deploy',
	doctor: 'doctor',
	invite: 'invite',
};

const roboxCommand = roboxCommands[command] || command;

// Find robox executable (relative path)
const roboxPath = join(nodeModulesPath, '.bin', 'robox');

if (!existsSync(roboxPath)) {
	console.error(`Error: robox executable not found at ${roboxPath}`);
	console.error('Please run "npm install" to install dependencies.');
	process.exit(1);
}

console.log(`Starting with extensionless support: robox ${roboxCommand}`);
console.log(`Project root: ${projectRoot}`);

// Spawn robox with the requested command
const child = spawn(roboxPath, [roboxCommand], {
	stdio: 'inherit',
	env: {
		...process.env,
		NODE_OPTIONS: '--enable-source-maps',
	},
	cwd: projectRoot,
});

child.on('error', (error) => {
	console.error(`Failed to start robox: ${error.message}`);
	process.exit(1);
});

child.on('exit', (code) => {
	process.exit(code || 0);
});
