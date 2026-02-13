import { DiscordContextProvider } from '../hooks/useDiscordSdk'
import { SyncContextProvider } from '@robojs/sync/client'
import { Activity } from './Activity'
import './App.css'

export default function App() {
	return (
		<DiscordContextProvider authenticate scope={['identify']}>
			<SyncContextProvider>
				<Activity />
			</SyncContextProvider>
		</DiscordContextProvider>
	)
}
