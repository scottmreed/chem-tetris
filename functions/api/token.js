export async function onRequestPost(context) {
	try {
		const { code } = await context.request.json()

		const clientId = context.env.DISCORD_CLIENT_ID
		const clientSecret = context.env.DISCORD_CLIENT_SECRET

		if (!clientId || !clientSecret) {
			return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		const response = await fetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: 'authorization_code',
				code,
			}),
		})

		if (!response.ok) {
			const errorBody = await response.text()
			console.error(`Discord OAuth failed: ${response.status} ${errorBody}`)
			return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		const { access_token } = await response.json()
		return new Response(JSON.stringify({ access_token }), {
			headers: { 'Content-Type': 'application/json' },
		})
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Internal error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		})
	}
}
