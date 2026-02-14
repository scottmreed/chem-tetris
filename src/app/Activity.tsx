import { useCallback, useState } from 'react'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { useSyncState } from '@robojs/sync/client'
import ChemAsciiTetris from './components/ChemAsciiTetris'
import { HighScoreBoard } from './components/HighScoreBoard'
import type { HighScoreEntry } from './components/ChemAsciiTetris'

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

	const displayName = session?.user?.global_name || session?.user?.username || 'Player'
	const userId = session?.user?.id || 'unknown'
	const avatar = session?.user?.avatar ?? null

	const handleHighScoreSubmit = useCallback(
		async (entry: HighScoreEntry): Promise<boolean> => {
			return new Promise((resolve) => {
				setHighScores((prev: HighScoreEntry[]) => {
					// Check what the current top score is BEFORE adding the new entry
					const previousTopScore = prev.length > 0 ? prev[0]?.score ?? 0 : 0

					const updated = [...prev, entry]
						.sort((a, b) => {
							if (b.score !== a.score) return b.score - a.score
							return (a.timestamp ?? 0) - (b.timestamp ?? 0)
						})
						.slice(0, 10)

					// Check if this entry is now #1 AND it beat the previous top score
					const isNewTopScore = updated.length > 0 && 
						updated[0]?.userId === entry.userId && 
						updated[0]?.timestamp === entry.timestamp &&
						entry.score > previousTopScore

					// Resolve after the state update
					setTimeout(() => resolve(isNewTopScore), 0)

					return updated
				})
			})
		},
		[setHighScores]
	)

	const handleGameStart = useCallback(() => {
		setTotalGamesPlayed((prev: number) => prev + 1)
	}, [setTotalGamesPlayed])

	const handleGameStateChange = useCallback(
		(state: typeof gameState) => {
			setGameState(state)
			if (state.showHint !== showHint) {
				setShowHint(state.showHint)
			}
		},
		[showHint]
	)

	if (!authenticated && status !== 'ready') {
		return (
			<div className="flex h-screen w-screen items-center justify-center bg-[#05080d] text-[#8bd3ff]">
				<div className="text-center">
					<div className="mb-2 text-lg font-bold">ChemIllusion: IUPAC Rain</div>
					<div className="text-sm text-[#90a2c9]">
						{status === 'error' ? 'Failed to connect to Discord' : 'Connecting to Discord...'}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-screen w-screen flex-col items-center overflow-hidden bg-[#05080d] p-3">
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
						{lastScore !== null && <span className="text-[#8bd3ff]">· Last: {lastScore}</span>}
					</div>
				)}
			</div>

			{/* Game Info Bar - Desktop */}
			{!gameState.isMobile && (
				<div className="mb-2 flex items-center gap-4 text-xs text-[#dce5ff]">
					<span>
						Target:{' '}
						<strong className="text-[#9fb7ff]">
							{gameState.target || '—'}
							{showHint && gameState.targetPattern && (
								<span className="ml-1 text-[#8bd3ff]">({gameState.targetPattern})</span>
							)}
						</strong>
					</span>
					<span>
						Score: <strong className="text-[#9bd5ff]">{gameState.score}</strong>
					</span>
					<span>
						Speed: <strong className="text-[#9bd5ff]">{gameState.speed.toFixed(1)}x</strong>
					</span>
					<button
						onClick={() => setShowHint(!showHint)}
						className="rounded border border-[#3a3a55] bg-[#191926] px-2 py-0.5 text-[11px] text-[#8bd3ff] hover:bg-[#1b273f]"
					>
						{showHint ? 'Hide SMILES' : 'Show SMILES'}
					</button>
				</div>
			)}

			{/* Game Board */}
			<div className="flex-shrink-0">
				<ChemAsciiTetris
					width={10}
					height={12}
					onEnd={setLastScore}
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
			</div>

			{/* High Scores */}
			<div className="mt-2 w-full max-w-xs">
				<HighScoreBoard highScores={highScores} currentUserId={userId} />
			</div>
		</div>
	)
}
