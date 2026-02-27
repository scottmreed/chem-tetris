import type { RoboRequest } from '@robojs/server'

interface RequestBody {
	code: string
}

export default async (req: RoboRequest) => {
	const { code } = (await req.json()) as RequestBody

	const clientId = process.env.VITE_DISCORD_CLIENT_ID
	const clientSecret = process.env.DISCORD_CLIENT_SECRET

	if (!clientId || !clientSecret) {
		console.error('[token] Missing VITE_DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET env vars')
		return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const response = await fetch(`https://discord.com/api/oauth2/token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'authorization_code',
			code: code,
		}),
	})

	if (!response.ok) {
		const errorBody = await response.text()
		console.error(`[token] Discord OAuth failed: ${response.status} ${errorBody}`)
		return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
			status: response.status,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const { access_token } = await response.json()
	return { access_token }
}
