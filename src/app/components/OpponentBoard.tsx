import React from 'react'
import type { PlayerState, Cell } from '../game/types'

interface OpponentBoardProps {
	state: PlayerState
	compact?: boolean
}

export function OpponentBoard({ state, compact = false }: OpponentBoardProps) {
	const fontSize = compact ? 9 : 11
	const width = state.board[0]?.length ?? 10
	const height = state.board.length

	const cellStyleBase: React.CSSProperties = {
		display: 'inline-block',
		width: '1ch',
		textAlign: 'center',
	}

	const renderBoard = () => {
		const rows: React.ReactElement[] = []
		const border = '+' + '-'.repeat(width) + '+'

		rows.push(<span key="top">{border}</span>)
		rows.push(<br key="top-br" />)

		for (let y = 0; y < height; y++) {
			rows.push(
				<span key={`row-${y}-start`} style={cellStyleBase}>
					|
				</span>
			)
			for (let x = 0; x < width; x++) {
				const ch: Cell = state.board[y]?.[x] ?? '.'
				let style: React.CSSProperties = cellStyleBase
				if (ch === 'O') {
					style = { ...style, color: '#6fb8ff' }
				} else if (ch === 'G') {
					style = { ...style, color: '#666' }
				}
				rows.push(
					<span key={`cell-${x}-${y}`} style={style}>
						{ch === 'G' ? '#' : ch}
					</span>
				)
			}
			rows.push(
				<span key={`row-${y}-end`} style={cellStyleBase}>
					|
				</span>
			)
			if (y < height - 1) rows.push(<br key={`br-${y}`} />)
		}
		rows.push(<br key="bottom-br" />)
		rows.push(<span key="bottom">{border}</span>)
		return rows
	}

	const avatarUrl =
		state.avatar && state.playerId
			? `https://cdn.discordapp.com/avatars/${state.playerId}/${state.avatar}.png?size=32`
			: null

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 4,
				fontFamily:
					"ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
				color: '#e6e6ea',
			}}
		>
			{/* Player header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 4,
					fontSize: compact ? 10 : 11,
				}}
			>
				{avatarUrl && (
					<img
						src={avatarUrl}
						alt=""
						style={{
							width: compact ? 12 : 14,
							height: compact ? 12 : 14,
							borderRadius: '50%',
						}}
					/>
				)}
				<span
					style={{
						maxWidth: 80,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						color: '#90a2c9',
					}}
				>
					{state.username}
				</span>
				<span style={{ color: '#9bd5ff', fontWeight: 'bold' }}>{state.score}</span>
			</div>

			{/* Board */}
			<div style={{ position: 'relative' }}>
				<pre
					style={{
						fontSize,
						lineHeight: 1.0,
						background: '#12121a',
						padding: compact ? 2 : 4,
						borderRadius: 6,
						boxShadow: '0 0 0 1px #24243a inset',
						margin: 0,
						userSelect: 'none',
						opacity: state.status === 'dead' ? 0.4 : 1,
					}}
				>
					{renderBoard()}
				</pre>

				{state.status === 'dead' && (
					<div
						style={{
							position: 'absolute',
							inset: 0,
							display: 'grid',
							placeItems: 'center',
							background: 'rgba(0,0,0,0.6)',
							borderRadius: 6,
						}}
					>
						<span
							style={{
								fontSize: compact ? 10 : 12,
								color: '#f87171',
								fontWeight: 'bold',
								textTransform: 'uppercase',
								letterSpacing: 1,
							}}
						>
							ELIMINATED
						</span>
					</div>
				)}
			</div>

			{/* Target info */}
			{!compact && state.status === 'playing' && (
				<div style={{ fontSize: 10, color: '#90a2c9' }}>
					Target: {state.target.name}
				</div>
			)}
		</div>
	)
}
