import type { PlayerState, LobbyState, HighScoreEntry, GarbageEvent } from '../game/types'
import ChemAsciiTetris from './ChemAsciiTetris'
import { OpponentBoard } from './OpponentBoard'
import { GarbageIndicator } from './GarbageIndicator'

interface MultiplayerBoardProps {
	localPlayerId: string
	lobby: LobbyState
	playerStates: (PlayerState | null)[]
	// Props forwarded to local player's ChemAsciiTetris
	discordUsername: string
	discordUserId: string
	discordAvatar: string | null
	showHint: boolean
	gameStarted: boolean
	pendingGarbage: number
	onMatchMolecule: (moleculePattern: string, score: number) => void
	onPlayerDeath: (score: number) => void
	onPlayerStateChange: (state: PlayerState) => void
	consumeGarbage: () => GarbageEvent[]
	onEnd: (score: number) => void
	onGameStateChange: (state: {
		score: number
		speed: number
		target: string
		targetPattern: string
		showHint: boolean
		isMobile: boolean
	}) => void
	onHighScoreSubmit?: (entry: HighScoreEntry) => Promise<boolean> | void
	onGameStart?: () => void
	totalGamesPlayed: number
	highScores: HighScoreEntry[]
}

export function MultiplayerBoard({
	localPlayerId,
	lobby,
	playerStates,
	discordUsername,
	discordUserId,
	discordAvatar,
	showHint,
	gameStarted,
	pendingGarbage,
	onMatchMolecule,
	onPlayerDeath,
	onPlayerStateChange,
	consumeGarbage,
	onEnd,
	onGameStateChange,
	onHighScoreSubmit,
	onGameStart,
	totalGamesPlayed,
	highScores,
}: MultiplayerBoardProps) {
	const players = Object.values(lobby.players).sort((a, b) => a.slot - b.slot)
	const totalPlayers = players.length
	const opponents = players.filter((p) => p.playerId !== localPlayerId)

	// Determine sizing based on player count
	const getLocalFontSize = () => {
		if (totalPlayers <= 1) return 16
		if (totalPlayers === 2) return 14
		return 13
	}

	const getOpponentCompact = () => totalPlayers >= 3

	// Layout: local board on left with garbage indicator, opponents stacked on right
	return (
		<div
			style={{
				display: 'flex',
				gap: totalPlayers <= 2 ? 16 : 10,
				alignItems: 'flex-start',
				justifyContent: 'center',
				width: '100%',
				maxWidth: totalPlayers <= 2 ? 600 : 800,
			}}
		>
			{/* Local player board with garbage indicator */}
			<div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
				<GarbageIndicator pendingRows={pendingGarbage} />
				<div
					style={{
						border: '2px solid #8bd3ff',
						borderRadius: 10,
						padding: 4,
					}}
				>
					<ChemAsciiTetris
						width={10}
						height={12}
						fontSize={getLocalFontSize()}
						compact={totalPlayers >= 3}
						showHint={showHint}
						discordUsername={discordUsername}
						discordUserId={discordUserId}
						discordAvatar={discordAvatar}
						onMatchMolecule={onMatchMolecule}
						onPlayerDeath={onPlayerDeath}
						onPlayerStateChange={onPlayerStateChange}
						consumeGarbage={consumeGarbage}
						onEnd={onEnd}
						onGameStateChange={onGameStateChange}
						onHighScoreSubmit={onHighScoreSubmit}
						onGameStart={onGameStart}
						totalGamesPlayed={totalGamesPlayed}
						currentHighScores={highScores}
						externalStart={gameStarted}
					/>
				</div>
			</div>

			{/* Opponent boards */}
			{opponents.length > 0 && (
				<div
					style={{
						display: 'flex',
						flexDirection: opponents.length >= 3 ? 'column' : 'column',
						gap: opponents.length >= 3 ? 6 : 10,
						flexWrap: opponents.length >= 3 ? 'wrap' : 'nowrap',
						maxHeight: opponents.length >= 3 ? 400 : undefined,
					}}
				>
					{opponents.map((opponent) => {
						const pState = playerStates[opponent.slot]
						if (!pState) {
							return (
								<div
									key={opponent.playerId}
									style={{
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: 4,
										opacity: 0.5,
										fontFamily:
											"ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
										fontSize: 11,
										color: '#90a2c9',
									}}
								>
									<span>{opponent.username}</span>
									<span>Waiting...</span>
								</div>
							)
						}
						return (
							<OpponentBoard
								key={opponent.playerId}
								state={pState}
								compact={getOpponentCompact()}
							/>
						)
					})}
				</div>
			)}
		</div>
	)
}
