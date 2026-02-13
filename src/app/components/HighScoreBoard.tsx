import type { HighScoreEntry } from './ChemAsciiTetris'

interface HighScoreBoardProps {
	highScores: HighScoreEntry[]
	currentUserId?: string
}

export function HighScoreBoard({ highScores, currentUserId }: HighScoreBoardProps) {
	if (highScores.length === 0) return null

	return (
		<div
			style={{
				width: '100%',
				background: 'linear-gradient(145deg, rgba(17,22,38,0.92), rgba(10,14,26,0.92))',
				padding: 12,
				borderRadius: 10,
				boxShadow: '0 12px 24px rgba(3,5,14,0.4), 0 0 0 1px rgba(70,92,152,0.25) inset',
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
			}}
		>
			<h3
				style={{
					margin: '0 0 8px',
					fontSize: 12,
					textTransform: 'uppercase',
					letterSpacing: 1.4,
					color: '#8bd3ff',
				}}
			>
				High Scores
			</h3>
			<ol
				style={{
					listStyle: 'none',
					padding: 0,
					margin: 0,
					display: 'grid',
					gap: 3,
					fontSize: 12,
					fontVariantNumeric: 'tabular-nums',
				}}
			>
				{highScores.map((entry, idx) => {
					const isCurrentUser = currentUserId && entry.userId === currentUserId
					const avatarUrl =
						entry.avatar && entry.userId
							? `https://cdn.discordapp.com/avatars/${entry.userId}/${entry.avatar}.png?size=32`
							: null

					return (
						<li
							key={`${entry.userId}-${entry.timestamp}-${idx}`}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 6,
								color: isCurrentUser ? '#f5b63b' : '#d4ddff',
								padding: '2px 0',
							}}
						>
							<span style={{ width: 22, textAlign: 'right', flexShrink: 0 }}>
								{String(idx + 1).padStart(2, '0')}.
							</span>
							{avatarUrl ? (
								<img
									src={avatarUrl}
									alt=""
									style={{
										width: 16,
										height: 16,
										borderRadius: '50%',
										flexShrink: 0,
									}}
								/>
							) : (
								<span
									style={{
										width: 16,
										height: 16,
										borderRadius: '50%',
										background: '#2d3b67',
										flexShrink: 0,
									}}
								/>
							)}
							<span
								style={{
									flex: 1,
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
								}}
							>
								{entry.username}
							</span>
							<span style={{ flexShrink: 0, fontWeight: 'bold' }}>{entry.score}</span>
						</li>
					)
				})}
			</ol>
		</div>
	)
}
