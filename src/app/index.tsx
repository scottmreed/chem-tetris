import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

try {
	ReactDOM.createRoot(document.getElementById('root')!).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
	)
} catch (e) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const show = (window as any).__showError
	if (show) {
		show('ReactDOM init error:\n' + (e instanceof Error ? e.stack : String(e)))
	} else {
		const root = document.getElementById('root')
		if (root) {
			root.style.cssText =
				'padding:16px;font-family:monospace;font-size:12px;background:#12121a;color:#ff6b6b;min-height:100vh;white-space:pre-wrap'
			root.textContent = 'ReactDOM init error:\n' + (e instanceof Error ? e.stack : String(e))
		}
	}
}
