interface GarbageIndicatorProps {
	pendingRows: number
	maxRows?: number
	height?: number
}

export function GarbageIndicator({
	pendingRows,
	maxRows = 6,
	height = 12,
}: GarbageIndicatorProps) {
	if (pendingRows <= 0) return null

	const segments = Math.min(pendingRows, maxRows)

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column-reverse',
				gap: 1,
				width: 6,
				height: `${height * 16}px`,
				justifyContent: 'flex-start',
			}}
		>
			{Array.from({ length: segments }).map((_, i) => (
				<div
					key={i}
					style={{
						width: '100%',
						height: `${100 / maxRows}%`,
						background: i < 3 ? '#f87171' : '#ef4444',
						borderRadius: 1,
						opacity: 0.8 + (i / maxRows) * 0.2,
					}}
				/>
			))}
		</div>
	)
}
