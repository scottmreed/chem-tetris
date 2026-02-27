import type { LobbyState } from '../game/types'

interface LobbyProps {
	lobby: LobbyState
	localPlayerId: string
	onToggleReady: () => void
	onStartGame: () => void
}

export function Lobby({ lobby, localPlayerId, onToggleReady, onStartGame }: LobbyProps) {
	const players = Object.values(lobby.players)
	const isHost = lobby.hostId === localPlayerId
	const localPlayer = lobby.players[localPlayerId]
	const readyCount = players.filter((p) => p.ready).length
	const canStart = isHost && readyCount >= 1 && players.length >= 2

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 16,
				padding: 24,
				maxWidth: 400,
				margin: '0 auto',
				fontFamily:
					"ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
				color: '#e6e6ea',
			}}
		>
			<h2
				style={{
					fontSize: 16,
					textTransform: 'uppercase',
					letterSpacing: 2,
					color: '#8bd3ff',
					margin: 0,
				}}
			>
				Multiplayer Lobby
			</h2>
			<div
				style={{
					fontSize: 12,
					color: '#90a2c9',
				}}
			>
				{players.length}/4 players
			</div>

			<div
				style={{
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
					gap: 6,
				}}
			>
				{players
					.sort((a, b) => a.slot - b.slot)
					.map((player) => {
						const isLocal = player.playerId === localPlayerId
						const isPlayerHost = player.playerId === lobby.hostId
						const avatarUrl =
							player.avatar && player.playerId
								? `https://cdn.discordapp.com/avatars/${player.playerId}/${player.avatar}.png?size=32`
								: null

						return (
							<div
								key={player.playerId}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 10,
									padding: '8px 12px',
									background: isLocal
										? 'rgba(139, 211, 255, 0.1)'
										: 'rgba(17, 22, 38, 0.6)',
									borderRadius: 8,
									border: `1px solid ${isLocal ? 'rgba(139, 211, 255, 0.3)' : '#2d3b67'}`,
								}}
							>
								{avatarUrl ? (
									<img
										src={avatarUrl}
										alt=""
										style={{
											width: 24,
											height: 24,
											borderRadius: '50%',
											flexShrink: 0,
										}}
									/>
								) : (
									<div
										style={{
											width: 24,
											height: 24,
											borderRadius: '50%',
											background: '#2d3b67',
											flexShrink: 0,
										}}
									/>
								)}
								<span
									style={{
										flex: 1,
										fontSize: 13,
										color: isLocal ? '#8bd3ff' : '#d4ddff',
									}}
								>
									{player.username}
									{isPlayerHost && (
										<span
											style={{
												marginLeft: 6,
												fontSize: 10,
												color: '#f5b63b',
												textTransform: 'uppercase',
											}}
										>
											HOST
										</span>
									)}
								</span>
								<span
									style={{
										fontSize: 11,
										padding: '2px 8px',
										borderRadius: 999,
										background: player.ready ? '#1a3a2a' : '#2a1a1a',
										color: player.ready ? '#4ade80' : '#f87171',
										border: `1px solid ${player.ready ? '#166534' : '#991b1b'}`,
									}}
								>
									{player.ready ? 'READY' : 'NOT READY'}
								</span>
							</div>
						)
					})}

				{/* Empty slots */}
				{Array.from({ length: 4 - players.length }).map((_, i) => (
					<div
						key={`empty-${i}`}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '8px 12px',
							background: 'rgba(17, 22, 38, 0.3)',
							borderRadius: 8,
							border: '1px dashed #2d3b67',
							color: '#4a5578',
							fontSize: 12,
						}}
					>
						Waiting for player...
					</div>
				))}
			</div>

			<div style={{ display: 'flex', gap: 10 }}>
				<button
					onClick={onToggleReady}
					style={{
						padding: '8px 20px',
						borderRadius: 8,
						border: `1px solid ${localPlayer?.ready ? '#991b1b' : '#166534'}`,
						background: localPlayer?.ready ? '#2a1a1a' : '#1a3a2a',
						color: localPlayer?.ready ? '#f87171' : '#4ade80',
						cursor: 'pointer',
						fontSize: 13,
						fontFamily: 'inherit',
					}}
				>
					{localPlayer?.ready ? 'Unready' : 'Ready Up'}
				</button>

				{isHost && (
					<button
						onClick={onStartGame}
						disabled={!canStart}
						style={{
							padding: '8px 20px',
							borderRadius: 8,
							border: '1px solid #3a3a55',
							background: canStart ? '#1b273f' : '#191926',
							color: canStart ? '#8bd3ff' : '#4a5578',
							cursor: canStart ? 'pointer' : 'not-allowed',
							fontSize: 13,
							fontFamily: 'inherit',
							opacity: canStart ? 1 : 0.6,
						}}
					>
						Start Game
					</button>
				)}
			</div>

			{isHost && !canStart && players.length < 2 && (
				<div style={{ fontSize: 11, color: '#90a2c9', textAlign: 'center' }}>
					Need at least 2 players to start
				</div>
			)}
		</div>
	)
}
