import { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk'
import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type DiscordSession = UnwrapPromise<ReturnType<typeof discordSdk.commands.authenticate>>
type AuthorizeInput = Parameters<typeof discordSdk.commands.authorize>[0]
type SdkSetupResult = ReturnType<typeof useDiscordSdkSetup>

const queryParams = new URLSearchParams(
	typeof window !== 'undefined' ? window.location.search : ''
)
const isEmbedded = queryParams.get('frame_id') != null

let discordSdk: DiscordSDK | DiscordSDKMock
let usingMockDiscord = false

export { discordSdk }

enum SessionStorageQueryParam {
	user_id = 'user_id',
	guild_id = 'guild_id',
	channel_id = 'channel_id'
}

function safeSessionStorageGet(key: string) {
	try {
		return sessionStorage.getItem(key)
	} catch (error) {
		console.warn('[sessionStorage unavailable:getItem]', error)
		return null
	}
}

function safeSessionStorageSet(key: string, value: string) {
	try {
		sessionStorage.setItem(key, value)
	} catch (error) {
		console.warn('[sessionStorage unavailable:setItem]', error)
	}
}

function getOverrideOrRandomSessionValue(queryParam: `${SessionStorageQueryParam}`) {
	const overrideValue = queryParams.get(queryParam)
	if (overrideValue != null) {
		return overrideValue
	}

	const currentStoredValue = safeSessionStorageGet(queryParam)
	if (currentStoredValue != null) {
		return currentStoredValue
	}

	// Set queryParam to a random 8-character string
	const randomString = Math.random().toString(36).slice(2, 10)
	safeSessionStorageSet(queryParam, randomString)
	return randomString
}

function createMockDiscordSdk() {
	const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID ?? ''
	const mockUserId = getOverrideOrRandomSessionValue('user_id')
	const mockGuildId = getOverrideOrRandomSessionValue('guild_id')
	const mockChannelId = getOverrideOrRandomSessionValue('channel_id')
	const discriminator = String(mockUserId.charCodeAt(0) % 5)
	const mockDiscordSdk = new DiscordSDKMock(clientId, mockGuildId, mockChannelId)

	mockDiscordSdk._updateCommandMocks({
		authenticate: async () => ({
			access_token: 'mock_token',
			user: {
				username: mockUserId,
				discriminator,
				id: mockUserId,
				avatar: null,
				public_flags: 1,
			},
			scopes: [],
			expires: new Date(2112, 1, 1).toString(),
			application: {
				description: 'mock_app_description',
				icon: 'mock_app_icon',
				id: 'mock_app_id',
				name: 'mock_app_name',
			},
		}),
	})

	return mockDiscordSdk
}

function enableMockDiscord(reason?: unknown) {
	if (reason) {
		console.warn('[DiscordSDK fallback to mock]', reason)
	}
	usingMockDiscord = true
	discordSdk = createMockDiscordSdk()
	return discordSdk
}

if (isEmbedded) {
	try {
		discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID)
	} catch (e) {
		enableMockDiscord(e)
	}
} else {
	enableMockDiscord()
}

const DiscordContext = createContext<SdkSetupResult>({
	accessToken: null,
	authenticated: false,
	discordSdk: discordSdk,
	error: null,
	session: {
		user: {
			id: '',
			username: '',
			discriminator: '',
			avatar: null,
			public_flags: 0
		},
		access_token: '',
		scopes: [],
		expires: '',
		application: {
			rpc_origins: undefined,
			id: '',
			name: '',
			icon: null,
			description: ''
		}
	},
	status: 'pending'
})

interface DiscordContextProviderProps {
	authenticate?: boolean
	children: ReactNode
	loadingScreen?: ReactNode
	scope?: AuthorizeInput['scope']
}
export function DiscordContextProvider(props: DiscordContextProviderProps) {
	const { authenticate, children, loadingScreen = null, scope } = props
	const setupResult = useDiscordSdkSetup({ authenticate, scope })

	if (loadingScreen && !['error', 'ready'].includes(setupResult.status)) {
		return <>{loadingScreen}</>
	}

	return <DiscordContext.Provider value={setupResult}>{children}</DiscordContext.Provider>
}

export function useDiscordSdk() {
	return useContext(DiscordContext)
}

interface AuthenticateSdkOptions {
	scope?: AuthorizeInput['scope']
}

/**
 * Authenticate with Discord and return the access token.
 * See full list of scopes: https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
 *
 * @param scope The scope of the authorization (default: ['identify', 'guilds'])
 * @returns The result of the Discord SDK `authenticate()` command
 */
export async function authenticateSdk(options?: AuthenticateSdkOptions) {
	const { scope = ['identify', 'guilds'] } = options ?? {}

	await discordSdk.ready()

	// In browser (non-embedded) dev mode the SDK is a mock — skip real OAuth
	if (!isEmbedded || usingMockDiscord) {
		const auth = await discordSdk.commands.authenticate({ access_token: 'mock_token' })
		if (auth == null) throw new Error('Discord authenticate command failed')
		return { accessToken: 'mock_token', auth }
	}

	const { code } = await discordSdk.commands.authorize({
		client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
		response_type: 'code',
		state: '',
		prompt: 'none',
		scope: scope
	})

	const tokenEndpoint = isEmbedded ? '/.proxy/api/token' : '/api/token'

	const response = await fetch(tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ code })
	})

	if (!response.ok) {
		const errorText = await response.text().catch(() => 'unknown error')
		throw new Error(`Token exchange failed (${response.status}): ${errorText}`)
	}

	const tokenData = await response.json()
	const { access_token } = tokenData

	if (!access_token) {
		throw new Error('Token exchange returned empty access_token')
	}

	// Authenticate with Discord client (using the access_token)
	const auth = await discordSdk.commands.authenticate({ access_token })

	if (auth == null) {
		throw new Error('Discord authenticate command failed')
	}
	return { accessToken: access_token, auth }
}

interface UseDiscordSdkSetupOptions {
	authenticate?: boolean
	scope?: AuthorizeInput['scope']
}

export function useDiscordSdkSetup(options?: UseDiscordSdkSetupOptions) {
	const { authenticate, scope } = options ?? {}
	const [accessToken, setAccessToken] = useState<string | null>(null)
	const [session, setSession] = useState<DiscordSession | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [status, setStatus] = useState<'authenticating' | 'error' | 'loading' | 'pending' | 'ready'>('pending')

	const setupDiscordSdk = useCallback(async () => {
		try {
			setStatus('loading')
			await discordSdk.ready()

			if (authenticate) {
				setStatus('authenticating')
				const { accessToken, auth } = await authenticateSdk({ scope })
				setAccessToken(accessToken)
				setSession(auth)
			}

			setStatus('ready')
		} catch (e) {
			console.error(e)
			const message = e instanceof Error ? e.message : 'An unknown error occurred'

			if (isEmbedded && !usingMockDiscord) {
				try {
					enableMockDiscord(e)
					if (authenticate) {
						const { accessToken, auth } = await authenticateSdk({ scope })
						setAccessToken(accessToken)
						setSession(auth)
					}
					setError('Discord SDK was unavailable in this client, so the game switched to local mode.')
					setStatus('ready')
					return
				} catch (fallbackError) {
					console.error('[DiscordSDK mock fallback failed]', fallbackError)
				}
			}

			setError(message)
			setStatus('error')
		}
	}, [authenticate, scope])

	useStableEffect(() => {
		setupDiscordSdk()
	})

	return { accessToken, authenticated: !!accessToken, discordSdk, error, session, status }
}

/**
 * React in development mode re-mounts the root component initially.
 * This hook ensures that the callback is only called once, preventing double authentication.
 */
function useStableEffect(callback: () => void | Promise<void>) {
	const isRunning = useRef(false)

	useEffect(() => {
		if (!isRunning.current) {
			isRunning.current = true
			callback()
		}
	}, [])
}
