#!/usr/bin/env node
/**
 * Startup script for web build/dev server
 * 
 * This script ensures extensionless is loaded before running Vite commands,
 * making it compatible with Cursor's cloud environment.
 * 
 * Usage:
 *   node scripts/start-web.mjs dev    # Start Vite dev server
 *   node scripts/start-web.mjs build  # Build for production
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

// Import extensionless/register FIRST before any other imports
import 'extensionless/register';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Ensure we're in the project root
process.chdir(projectRoot);

// Check if node_modules exists
const nodeModulesPath = join(projectRoot, 'node_modules');
if (!existsSync(nodeModulesPath)) {
	console.error('Error: node_modules not found. Please run "npm install" first.');
	process.exit(1);
}

// Get the command to run (dev or build)
const command = process.argv[2] || 'dev';

// Map commands to vite commands
const viteCommands = {
	dev: ['vite', '--config', 'config/vite.mjs'],
	build: ['vite', 'build', '--config', 'config/vite.mjs'],
};

const viteArgs = viteCommands[command];

if (!viteArgs) {
	console.error(`Error: Unknown command "${command}". Use "dev" or "build".`);
	process.exit(1);
}

// Find vite executable (relative path)
const vitePath = join(nodeModulesPath, '.bin', 'vite');

if (!existsSync(vitePath)) {
	console.error(`Error: vite executable not found at ${vitePath}`);
	console.error('Please run "npm install" to install dependencies.');
	process.exit(1);
}

console.log(`Starting Vite with extensionless support: ${command}`);
console.log(`Project root: ${projectRoot}`);

// Spawn vite with the requested command
const child = spawn(vitePath, viteArgs, {
	stdio: 'inherit',
	env: {
		...process.env,
		NODE_OPTIONS: '--enable-source-maps',
	},
	cwd: projectRoot,
});

child.on('error', (error) => {
	console.error(`Failed to start vite: ${error.message}`);
	process.exit(1);
});

child.on('exit', (code) => {
	process.exit(code || 0);
});
