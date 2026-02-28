import { Component } from 'react'
import type { ReactNode } from 'react'
import { DiscordContextProvider } from '../hooks/useDiscordSdk'
import { SyncContextProvider } from '../hooks/useSharedSync'
import { Activity } from './Activity'
import './App.css'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
	state = { error: null }

	static getDerivedStateFromError(error: Error) {
		return { error }
	}

	componentDidCatch(error: Error, info: { componentStack: string }) {
		console.error('[React ErrorBoundary]', error, info)
	}

	render() {
		if (this.state.error) {
			const err = this.state.error as Error
			return (
				<div
					style={{
						padding: 20,
						fontFamily: 'monospace',
						background: '#12121a',
						color: '#ff6b6b',
						minHeight: '100vh',
						whiteSpace: 'pre-wrap',
						wordBreak: 'break-word',
					}}
				>
					<strong>App Error</strong>
					{'\n'}
					{err.message}
					{'\n\n'}
					{err.stack}
				</div>
			)
		}
		return this.props.children
	}
}

export default function App() {
	return (
		<ErrorBoundary>
			<DiscordContextProvider authenticate scope={['identify']}>
				<SyncContextProvider>
					<Activity />
				</SyncContextProvider>
			</DiscordContextProvider>
		</ErrorBoundary>
	)
}
