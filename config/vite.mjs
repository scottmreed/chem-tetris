import { DiscordProxy } from '@robojs/patch'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
	base: process.env.GITHUB_PAGES ? '/chem-tetris/' : '/',
	// DiscordProxy.Vite() injects discord-proxy-patch.umd.js which patches
	// global WebSocket via new Proxy(window.WebSocket,...). In Discord's
	// Activity iframe sandbox window.WebSocket may be undefined/non-object,
	// causing a TypeError that crashes the app before React mounts (blank screen).
	// Only apply the plugin in dev (serve) mode where the tunnel is active.
	plugins: [react(), command === 'serve' ? DiscordProxy.Vite() : null].filter(Boolean),
	css: {
		postcss: 'config/postcss.config.mjs'
	},
	server: {
		allowedHosts: true,
		port: 3003
	}
}))
