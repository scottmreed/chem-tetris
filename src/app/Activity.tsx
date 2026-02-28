import { useCallback, useEffect, useRef, useState } from 'react'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { useSyncState } from '../hooks/useSharedSync'
import { useMultiplayerSync } from '../hooks/useMultiplayerSync'
import { useChiptuneMusic } from '../hooks/useChiptuneMusic'
import { calculateGarbageRows } from './game/garbage'
import type { HighScoreEntry, PlayerState } from './game/types'
import ChemAsciiTetris from './components/ChemAsciiTetris'
import { HighScoreBoard } from './components/HighScoreBoard'
import { Lobby } from './components/Lobby'
import { MultiplayerBoard } from './components/MultiplayerBoard'

export const Activity = () => {
	const { authenticated, session, status } = useDiscordSdk()

	const [highScores, setHighScores] = useSyncState<HighScoreEntry[]>([], ['highScores'])
	const [totalGamesPlayed, setTotalGamesPlayed] = useSyncState<number>(0, ['totalGamesPlayed'])

	const [lastScore, setLastScore] = useState<number | null>(null)
	const [showHint, setShowHint] = useState(false)
	const [gameState, setGameState] = useState({
		score: 0,
		speed: 1,
		target: '',
		targetPattern: '',
		showHint: false,
		isMobile: false,
	})
	const [countdown, setCountdown] = useState<number | null>(null)
	const [gameStarted, setGameStarted] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [pendingGarbage, setPendingGarbage] = useState(0)

	// Background music
	const { play: playMusic, stop: stopMusic, toggle: toggleMusic, isPlaying: isMusicPlaying } = useChiptuneMusic(0.15)

	const displayName = session?.user?.global_name || session?.user?.username || 'Player'
	const userId = session?.user?.id || 'unknown'
	const avatar = session?.user?.avatar ?? null

	const {
		lobby,
		playerStates,
		playerCount,
		joinLobby,
		toggleReady,
		startGame,
		setPlaying,
		broadcastState,
		sendGarbage,
		consumeGarbage,
		reportDeath,
		resetLobby,
	} = useMultiplayerSync(userId)

	// Auto-join lobby when authenticated
	useEffect(() => {
		if (authenticated && userId !== 'unknown') {
			joinLobby(displayName, avatar)
		}
	}, [authenticated, userId])

	// Handle countdown phase
	useEffect(() => {
		if (lobby.phase === 'countdown' && lobby.countdownStart) {
			const startTime = lobby.countdownStart
			const interval = setInterval(() => {
				const elapsed = Date.now() - startTime
				const remaining = Math.ceil((3000 - elapsed) / 1000)
				if (remaining <= 0) {
					clearInterval(interval)
					setCountdown(null)
					setGameStarted(true)
					setPlaying()
				} else {
					setCountdown(remaining)
				}
			}, 100)
			return () => clearInterval(interval)
		}
	}, [lobby.phase, lobby.countdownStart, setPlaying])

	// Track pending garbage for indicator
	const pendingGarbageRef = useRef(0)
	const wrappedConsumeGarbage = useCallback(() => {
		const events = consumeGarbage()
		if (events.length > 0) {
			let total = 0
			for (const e of events) total += e.rows
			pendingGarbageRef.current = Math.max(0, pendingGarbageRef.current - total)
			setPendingGarbage(pendingGarbageRef.current)
		}
		return events
	}, [consumeGarbage])

	const handleHighScoreSubmit = useCallback(
		async (entry: HighScoreEntry): Promise<boolean> => {
			return new Promise((resolve) => {
				setHighScores((prev: HighScoreEntry[]) => {
					const previousTopScore = prev.length > 0 ? prev[0]?.score ?? 0 : 0
					const updated = [...prev, entry]
						.sort((a, b) => {
							if (b.score !== a.score) return b.score - a.score
							return (a.timestamp ?? 0) - (b.timestamp ?? 0)
						})
						.slice(0, 10)

					const isNewTopScore =
						updated.length > 0 &&
						updated[0]?.userId === entry.userId &&
						updated[0]?.timestamp === entry.timestamp &&
						entry.score > previousTopScore

					setTimeout(() => resolve(isNewTopScore), 0)
					return updated
				})
			})
		},
		[setHighScores]
	)

	const handleGameStart = useCallback(() => {
		setIsPlaying(true)
		setTotalGamesPlayed((prev: number) => prev + 1)
		// Start background music when game begins
		setTimeout(() => playMusic(), 500)
	}, [setTotalGamesPlayed, playMusic])

	const handleGameStateChange = useCallback(
		(state: typeof gameState) => {
			setGameState(state)
			if (state.showHint !== showHint) {
				setShowHint(state.showHint)
			}
		},
		[showHint]
	)

	const handleMatchMolecule = useCallback(
		(moleculePattern: string, _score: number) => {
			if (playerCount <= 1) return // no opponents in solo
			const rows = calculateGarbageRows(moleculePattern)
			const players = Object.values(lobby.players)
			const opponents = players.filter((p) => p.playerId !== userId)
			for (const opp of opponents) {
				const oppState = playerStates[opp.slot]
				if (oppState?.status === 'playing') {
					sendGarbage(opp.playerId, rows)
				}
			}
		},
		[playerCount, lobby.players, userId, playerStates, sendGarbage]
	)

	const handlePlayerDeath = useCallback(
		(score: number) => {
			setLastScore(score)
			if (playerCount > 1) {
				reportDeath()
			}
			// Stop background music when player dies
			stopMusic()
		},
		[playerCount, reportDeath, stopMusic]
	)

	const handlePlayerStateChange = useCallback(
		(state: PlayerState) => {
			broadcastState(state)
		},
		[broadcastState]
	)

	const handleBackToLobby = useCallback(() => {
		setGameStarted(false)
		setCountdown(null)
		resetLobby()
		// Stop background music when going back to lobby
		stopMusic()
	}, [resetLobby, stopMusic])

	// Loading screen
	if (!authenticated && status !== 'ready') {
		return (
			<div className="flex h-screen w-screen items-center justify-center bg-[#05080d] text-[#8bd3ff]">
				<div className="text-center">
					<div className="mb-2 text-lg font-bold">ChemIllusion: IUPAC Rain</div>
					<div className="text-sm text-[#90a2c9]">
						{status === 'error'
							? 'Failed to connect to Discord'
							: 'Connecting to Discord...'}
					</div>
				</div>
			</div>
		)
	}

	const isMultiplayer = playerCount > 1
	const isLobbyPhase = lobby.phase === 'lobby' && isMultiplayer
	const isCountdownPhase = lobby.phase === 'countdown'
	const isFinished = lobby.phase === 'finished'

	// Finished screen
	if (isFinished) {
		const winner = lobby.winnerId
		const winnerInfo = winner ? lobby.players[winner] : null
		const winnerState = winnerInfo ? playerStates[winnerInfo.slot] : null

		return (
			<div className="flex h-screen w-screen flex-col items-center justify-center bg-[#05080d] p-3">
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 16,
						padding: 24,
						fontFamily:
							"ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
						color: '#e6e6ea',
					}}
				>
					<h2
						style={{
							fontSize: 18,
							color: '#f5b63b',
							textTransform: 'uppercase',
							letterSpacing: 2,
						}}
					>
						Game Over!
					</h2>
					{winnerInfo && (
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							{winnerInfo.avatar && (
								<img
									src={`https://cdn.discordapp.com/avatars/${winnerInfo.playerId}/${winnerInfo.avatar}.png?size=48`}
									alt=""
									style={{ width: 32, height: 32, borderRadius: '50%' }}
								/>
							)}
							<span style={{ fontSize: 16, color: '#8bd3ff' }}>
								{winnerInfo.username} wins!
							</span>
							{winnerState && (
								<span style={{ fontSize: 14, color: '#9bd5ff' }}>
									Score: {winnerState.score}
								</span>
							)}
						</div>
					)}

					{/* Final standings */}
					<div style={{ width: '100%', maxWidth: 300, marginTop: 8 }}>
						<h3
							style={{
								fontSize: 12,
								color: '#8bd3ff',
								textTransform: 'uppercase',
								letterSpacing: 1.4,
								marginBottom: 8,
							}}
						>
							Final Standings
						</h3>
						{Object.values(lobby.players)
							.map((p) => ({
								...p,
								score: playerStates[p.slot]?.score ?? 0,
								status: playerStates[p.slot]?.status ?? 'dead',
							}))
							.sort((a, b) => {
								if (a.playerId === winner) return -1
								if (b.playerId === winner) return 1
								return b.score - a.score
							})
							.map((p, i) => (
								<div
									key={p.playerId}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 8,
										padding: '4px 0',
										color:
											p.playerId === winner
												? '#f5b63b'
												: p.playerId === userId
													? '#8bd3ff'
													: '#d4ddff',
										fontSize: 13,
									}}
								>
									<span style={{ width: 20 }}>{i + 1}.</span>
									<span style={{ flex: 1 }}>{p.username}</span>
									<span style={{ fontWeight: 'bold' }}>{p.score}</span>
								</div>
							))}
					</div>

					<button
						onClick={handleBackToLobby}
						style={{
							marginTop: 12,
							padding: '8px 20px',
							borderRadius: 8,
							border: '1px solid #3a3a55',
							background: '#191926',
							color: '#8bd3ff',
							cursor: 'pointer',
							fontSize: 13,
							fontFamily: 'inherit',
						}}
					>
						Back to Lobby
					</button>
				</div>

				<div className="mt-4 w-full max-w-xs">
					<HighScoreBoard highScores={highScores} currentUserId={userId} />
				</div>
			</div>
		)
	}

	// Lobby phase (multiplayer)
	if (isLobbyPhase) {
		return (
			<div className="flex h-screen w-screen flex-col items-center bg-[#05080d] p-3">
				<div className="mb-4 text-center">
					<a
						href="https://ChemIllusion.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-base font-bold text-[#f3f6ff] transition-colors hover:text-[#8bd3ff]"
					>
						ChemIllusion: IUPAC Rain
					</a>
				</div>
				<Lobby
					lobby={lobby}
					localPlayerId={userId}
					onToggleReady={toggleReady}
					onStartGame={startGame}
				/>
				<div className="mt-4 w-full max-w-xs">
					<HighScoreBoard highScores={highScores} currentUserId={userId} />
				</div>
			</div>
		)
	}

	// Countdown phase
	if (isCountdownPhase && countdown !== null) {
		return (
			<div className="flex h-screen w-screen items-center justify-center bg-[#05080d]">
				<div
					style={{
						fontSize: 64,
						fontWeight: 'bold',
						color: '#f5b63b',
						fontFamily:
							"ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
						animation: 'pulse 0.5s ease-in-out',
					}}
				>
					{countdown}
				</div>
			</div>
		)
	}

	// Playing phase — either single-player or multiplayer
	return (
		<div className="flex min-h-screen w-screen flex-col items-center overflow-y-auto bg-[#05080d] p-3">
			{/* Header */}
			<div className="mb-2 text-center">
				<a
					href="https://ChemIllusion.com"
					target="_blank"
					rel="noopener noreferrer"
					className="text-base font-bold text-[#f3f6ff] transition-colors hover:text-[#8bd3ff]"
				>
					ChemIllusion: IUPAC Rain
				</a>
				{authenticated && (
					<div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#90a2c9]">
						{avatar && userId !== 'unknown' && (
							<img
								src={`https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=32`}
								alt=""
								className="h-4 w-4 rounded-full"
							/>
						)}
						<span>{displayName}</span>
						{lastScore !== null && (
							<span className="text-[#8bd3ff]">&middot; Last: {lastScore}</span>
						)}
						{isMultiplayer && (
							<span className="text-[#f5b63b]">
								&middot; {playerCount} players
							</span>
						)}
					</div>
				)}
			</div>

			{/* Game Info Bar - Desktop (single player or multiplayer) */}
			{!gameState.isMobile && (
				<div className="mb-2 flex items-center gap-4 text-xs text-[#dce5ff]">
					<span>
						Target:{' '}
						<strong className="text-[#9fb7ff]">
							{gameState.target || '—'}
							{showHint && gameState.targetPattern && (
								<span className="ml-1 text-[#8bd3ff]">
									({gameState.targetPattern})
								</span>
							)}
						</strong>
					</span>
					<span>
						Score: <strong className="text-[#9bd5ff]">{gameState.score}</strong>
					</span>
					<span>
						Speed:{' '}
						<strong className="text-[#9bd5ff]">
							{gameState.speed.toFixed(1)}x
						</strong>
					</span>
					<button
						onClick={() => setShowHint(!showHint)}
						className="rounded border border-[#3a3a55] bg-[#191926] px-2 py-0.5 text-[11px] text-[#8bd3ff] hover:bg-[#1b273f]"
					>
						{showHint ? 'Hide SMILES' : 'Show SMILES'}
					</button>
					<button
						onClick={toggleMusic}
						className={`rounded border border-[#3a3a55] px-2 py-0.5 text-[11px] hover:bg-[#1b273f] ${
							isMusicPlaying ? 'bg-[#1b273f] text-[#f5b63b]' : 'bg-[#191926] text-[#f5b63b]'
						}`}
					>
						{isMusicPlaying ? '🔊 Music' : '🔇 Music'}
					</button>
				</div>
			)}

			{/* Game Board(s) */}
			<div className="flex-shrink-0">
				{isMultiplayer ? (
					<MultiplayerBoard
						localPlayerId={userId}
						lobby={lobby}
						playerStates={playerStates}
						discordUsername={displayName}
						discordUserId={userId}
						discordAvatar={avatar}
						showHint={showHint}
						gameStarted={gameStarted}
						pendingGarbage={pendingGarbage}
						onMatchMolecule={handleMatchMolecule}
						onPlayerDeath={handlePlayerDeath}
						onPlayerStateChange={handlePlayerStateChange}
						consumeGarbage={wrappedConsumeGarbage}
						onEnd={setLastScore}
						onGameStateChange={handleGameStateChange}
						onHighScoreSubmit={handleHighScoreSubmit}
						onGameStart={handleGameStart}
						totalGamesPlayed={totalGamesPlayed}
						highScores={highScores}
					/>
				) : (
					<ChemAsciiTetris
						width={10}
						height={12}
						onEnd={(score) => { setLastScore(score); setIsPlaying(false); stopMusic() }}
						onGameStateChange={handleGameStateChange}
						showHint={showHint}
						discordUsername={displayName}
						discordUserId={userId}
						discordAvatar={avatar}
						onHighScoreSubmit={handleHighScoreSubmit}
						onGameStart={handleGameStart}
						totalGamesPlayed={totalGamesPlayed}
						currentHighScores={highScores}
					/>
				)}
			</div>

			{/* High Scores — hidden while actively playing */}
			{!isPlaying && !gameStarted && (
				<div className="mt-2 w-full max-w-xs">
					<HighScoreBoard highScores={highScores} currentUserId={userId} />
				</div>
			)}
		</div>
	)
}
