import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import type { Cell, Atom, HighScoreEntry } from '../game/types'
import { useGameEngine } from '../../hooks/useGameEngine'

export type { HighScoreEntry } from '../game/types'

export interface ChemAsciiTetrisProps {
	width?: number
	height?: number
	tickMs?: number
	onEnd?: (score: number) => void
	onGameStateChange?: (state: {
		score: number
		speed: number
		target: string
		targetPattern: string
		showHint: boolean
		isMobile: boolean
	}) => void
	className?: string
	showHint?: boolean
	discordUsername?: string
	discordUserId?: string
	discordAvatar?: string | null
	onHighScoreSubmit?: (entry: HighScoreEntry) => Promise<boolean> | void
	onGameStart?: () => void
	totalGamesPlayed?: number
	currentHighScores?: HighScoreEntry[]
	// Multiplayer props
	compact?: boolean
	fontSize?: number
	onMatchMolecule?: (moleculePattern: string, score: number) => void
	onPlayerDeath?: (score: number) => void
	onPlayerStateChange?: (state: import('../game/types').PlayerState) => void
	consumeGarbage?: () => import('../game/types').GarbageEvent[]
	externalStart?: boolean
}

export interface ChemAsciiTetrisRef {
	openHelp: () => void
	startGame: () => void
}

const ChemAsciiTetris = forwardRef<ChemAsciiTetrisRef, ChemAsciiTetrisProps>(
	(
		{
			width = 10,
			height = 12,
			tickMs = 280,
			onEnd,
			onGameStateChange,
			className,
			showHint: propShowHint = false,
			discordUsername,
			discordUserId,
			discordAvatar,
			onHighScoreSubmit,
			onGameStart,
			totalGamesPlayed = 0,
			currentHighScores = [],
			compact = false,
			fontSize = 16,
			onMatchMolecule,
			onPlayerDeath,
			onPlayerStateChange,
			consumeGarbage,
			externalStart = false,
		},
		ref
	) => {
		const [isMobile, setIsMobile] = useState(false)
		const containerRef = useRef<HTMLDivElement | null>(null)

		useEffect(() => {
			if (typeof window !== 'undefined') {
				const coarse = window.matchMedia('(pointer: coarse)').matches
				const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
				setIsMobile(coarse || /Mobi|Android|iPad|iPhone|iPod|Windows Phone/i.test(ua))
			}
		}, [])

		const handleDeath = async (score: number) => {
			onEnd?.(score)
			onPlayerDeath?.(score)

			let isNewTopScore = false
			if (score > 0 && onHighScoreSubmit) {
				try {
					const result = await onHighScoreSubmit({
						username: discordUsername || 'anon',
						userId: discordUserId || 'unknown',
						avatar: discordAvatar ?? null,
						score,
						timestamp: Date.now(),
					})
					isNewTopScore = result === true
				} catch (error) {
					console.error('Failed to submit high score', error)
				}
			}

			if (isNewTopScore) {
				gameHook.setOverlay(
					`Game Over!  Score: ${score}\n\n🎉 You're the new #1!\n\nUse code chemillusion-tetris-winner at https://chemillusion.com/subscribe for a free month of ChemIllusion Basic.\n\nPlease don't share this code publicly.\n\nClick Restart or press 'R'.`
				)
			}
		}

		const gameHook = useGameEngine({
			playerId: discordUserId || 'unknown',
			username: discordUsername || 'Player',
			avatar: discordAvatar ?? null,
			width,
			height,
			tickMs,
			onMatch: onMatchMolecule,
			onDeath: handleDeath,
			onStateChange: onPlayerStateChange,
			consumeGarbage,
			onScoreChange: (score) => {
				onGameStateChange?.({
					score,
					speed: gameHook.engineRef.current?.getSpeedRatio() ?? 1,
					target: gameHook.engineRef.current?.target?.name ?? '',
					targetPattern: gameHook.engineRef.current?.target?.pattern ?? '',
					showHint: propShowHint,
					isMobile,
				})
			},
		})

		const {
			engine,
			engineRef,
			version,
			highlightKeys,
			overlay,
			hasStarted,
			showHelp,
			start,
			openHelp,
			closeHelp,
			bump,
		} = gameHook

		// Broadcast game state changes
		useEffect(() => {
			if (onGameStateChange) {
				const g = engineRef.current
				const speedRatio = g?.getSpeedRatio() ?? 1
				onGameStateChange({
					score: g?.score ?? 0,
					speed: speedRatio,
					target: g?.target?.name ?? '',
					targetPattern: g?.target?.pattern ?? '',
					showHint: propShowHint,
					isMobile,
				})
			}
		}, [
			onGameStateChange,
			engineRef.current?.score,
			engineRef.current?.target?.name,
			engineRef.current?.target?.pattern,
			propShowHint,
			isMobile,
			version,
		])

		// External start trigger (for multiplayer countdown)
		useEffect(() => {
			if (externalStart && !hasStarted) {
				start()
				onGameStart?.()
			}
		}, [externalStart])

		// Focus game container when started
		useEffect(() => {
			if (hasStarted) {
				const node = containerRef.current
				if (node) requestAnimationFrame(() => node.focus())
			}
		}, [hasStarted])

		useImperativeHandle(ref, () => ({
			openHelp,
			startGame: () => {
				start()
				onGameStart?.()
			},
		}))

		const g = engineRef.current
		const speedRatio = g?.getSpeedRatio() ?? 1
		const primaryButtonLabel = hasStarted ? 'Restart' : 'Start'

		const renderBoard = () => {
			if (!g) return null
			const highlightSet = new Set(highlightKeys)
			const rows: React.ReactElement[] = []
			const border = '+' + '-'.repeat(width) + '+'
			const cellStyleBase: React.CSSProperties = {
				display: 'inline-block',
				width: '1ch',
				textAlign: 'center',
			}

			rows.push(<span key="top">{border}</span>)
			rows.push(<br key="top-br" />)

			for (let y = 0; y < height; y++) {
				rows.push(
					<span key={`row-${y}-start`} style={cellStyleBase}>
						|
					</span>
				)
				for (let x = 0; x < width; x++) {
					let ch: Cell | Atom = g.board[y]?.[x] ?? '.'
					if (g.active && g.active.x === x && g.active.y === y) ch = g.active.atom
					const key = `${x},${y}`
					let style: React.CSSProperties = cellStyleBase
					if (highlightSet.has(key)) {
						style = {
							...style,
							background: '#f5b63b',
							color: '#0b1328',
							borderRadius: 3,
						}
					} else if (ch === 'O') {
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

		const tapLeft = () => {
			if (g && g.running && g.active) {
				g.moveHorizontal(-1)
				bump()
			}
		}
		const tapRight = () => {
			if (g && g.running && g.active) {
				g.moveHorizontal(1)
				bump()
			}
		}

		return (
			<div
				ref={containerRef}
				className={className}
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: compact ? 4 : 8,
					alignItems: 'center',
					fontFamily:
						"ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
					color: '#e6e6ea',
					background: 'transparent',
					width: '100%',
					outline: 'none',
				}}
				tabIndex={-1}
			>
				{/* Game Info Bar - Mobile */}
				{isMobile && !compact && (
					<div
						style={{
							width: '100%',
							maxWidth: 420,
							textAlign: 'center',
							background:
								'linear-gradient(160deg, rgba(19,28,48,0.92), rgba(13,18,33,0.92))',
							padding: '10px 14px',
							borderRadius: 12,
							boxShadow:
								'0 12px 24px rgba(4,6,16,0.45), 0 0 0 1px rgba(90,120,190,0.25) inset',
						}}
					>
						<h2
							style={{
								fontSize: 13,
								margin: '0 0 6px',
								textTransform: 'uppercase',
								letterSpacing: 1.4,
								color: '#9fb7ff',
							}}
						>
							Target:&nbsp;
							<span
								style={{
									display: 'inline-block',
									padding: '2px 8px',
									border: '1px solid #2d3b67',
									borderRadius: 999,
									background: '#121a32',
									minHeight: '2.2em',
									lineHeight: 1.3,
									maxWidth: '100%',
									whiteSpace: 'normal',
								}}
							>
								<span>{g?.target?.name ?? '—'}</span>
							</span>
						</h2>
						{propShowHint && (
							<div style={{ marginTop: 4, fontSize: 11, color: '#9fb7ff' }}>
								SMILES:&nbsp;
								<code style={{ color: '#8bd3ff' }}>
									{g?.target?.pattern ?? '—'}
								</code>
							</div>
						)}
						<div
							style={{
								fontSize: 13,
								display: 'flex',
								justifyContent: 'center',
								gap: 16,
								marginBottom: 8,
								color: '#dce5ff',
							}}
						>
							<span>
								Score: <b style={{ color: '#9bd5ff' }}>{g?.score ?? 0}</b>
							</span>
							<span>
								Speed:{' '}
								<b style={{ color: '#9bd5ff' }}>{speedRatio.toFixed(1)}x</b>
							</span>
						</div>
						<div
							style={{
								display: 'flex',
								justifyContent: 'center',
								gap: 6,
								marginBottom: 8,
							}}
						>
							<button
								onClick={() => {
									if (onGameStateChange) {
										onGameStateChange({
											score: g?.score ?? 0,
											speed: speedRatio,
											target: g?.target?.name ?? '',
											targetPattern: g?.target?.pattern ?? '',
											showHint: !propShowHint,
											isMobile,
										})
									}
								}}
								style={{
									padding: '3px 8px',
									borderRadius: 6,
									border: '1px solid #3a3a55',
									background: propShowHint ? '#1b273f' : '#191926',
									color: '#8bd3ff',
									cursor: 'pointer',
									fontSize: 11,
								}}
							>
								{propShowHint ? 'Hide SMILES' : 'Show SMILES'}
							</button>
							<button
								onClick={() => openHelp()}
								style={{
									padding: '3px 8px',
									borderRadius: 6,
									border: '1px solid #3a3a55',
									background: '#191926',
									color: '#8bd3ff',
									cursor: 'pointer',
									fontSize: 11,
								}}
							>
								Help
							</button>
						</div>
						<p style={{ color: '#90a2c9', fontSize: 11, margin: 0 }}>
							Arrows (or taps) move, Space drops, R restarts.
						</p>
					</div>
				)}

				<div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: 'flex-start', justifyContent: 'center' }}>
					<div style={{ position: 'relative' }}>
						<pre
							aria-label="chem-ascii-board"
							style={{
								fontSize,
								lineHeight: 1.0,
								background: '#12121a',
								padding: compact ? 4 : 6,
								borderRadius: 8,
								boxShadow: '0 0 0 1px #24243a inset',
								margin: 0,
								userSelect: 'none',
							}}
						>
							{g ? renderBoard() : null}
						</pre>

						{isMobile && g?.running && (
							<>
								<div
									aria-hidden="true"
									onPointerDown={tapLeft}
									style={{
										position: 'absolute',
										top: 0,
										bottom: 0,
										left: 0,
										width: '50%',
									}}
								/>
								<div
									aria-hidden="true"
									onPointerDown={tapRight}
									style={{
										position: 'absolute',
										top: 0,
										bottom: 0,
										right: 0,
										width: '50%',
									}}
								/>
							</>
						)}
					</div>

					{overlay && !externalStart && (
						<div
							style={{
								minWidth: compact ? 140 : 170,
								maxWidth: compact ? 160 : 210,
								background: 'rgba(18, 18, 26, 0.97)',
								border: '1px solid #3a3a55',
								borderRadius: 10,
								padding: '14px 16px',
								display: 'flex',
								flexDirection: 'column',
								gap: 10,
								alignItems: 'center',
								textAlign: 'center',
								alignSelf: 'flex-start',
							}}
						>
							<div style={{
								whiteSpace: 'pre-line',
								fontSize: compact ? 11 : 13,
								maxWidth: '100%',
								wordWrap: 'break-word',
								overflowWrap: 'break-word',
							}}>
								{overlay}
							</div>
							<button
								type="button"
								onClick={() => {
									start()
									onGameStart?.()
								}}
								style={{
									padding: '6px 10px',
									borderRadius: 8,
									border: '1px solid #3a3a55',
									background: '#191926',
									color: '#e6e6ea',
									cursor: 'pointer',
								}}
							>
								{primaryButtonLabel}
							</button>
						</div>
					)}
				</div>

				{showHelp && (
					<div
						style={{
							position: 'fixed',
							inset: 0,
							background: 'rgba(5,8,15,0.78)',
							zIndex: 20,
							display: 'grid',
							placeItems: 'center',
							padding: 16,
						}}
					>
						<div
							style={{
								width: 'min(420px, 85vw)',
								maxHeight: '80vh',
								overflowY: 'auto',
								background:
									'linear-gradient(160deg, rgba(18,24,40,0.95), rgba(10,14,26,0.95))',
								borderRadius: 14,
								padding: 20,
								boxShadow:
									'0 25px 45px rgba(0,0,0,0.55), 0 0 0 1px rgba(90,120,190,0.35) inset',
								color: '#d8e3ff',
							}}
						>
							<h3
								style={{
									margin: '0 0 10px',
									textTransform: 'uppercase',
									letterSpacing: 1.6,
									fontSize: 13,
									color: '#8bd3ff',
								}}
							>
								Quick Help
							</h3>
							{totalGamesPlayed > 0 && (
								<div
									style={{
										marginBottom: 14,
										padding: '6px 10px',
										background: 'rgba(139, 211, 255, 0.1)',
										borderRadius: 8,
										border: '1px solid rgba(139, 211, 255, 0.2)',
										fontSize: 12,
										color: '#8bd3ff',
										textAlign: 'center',
									}}
								>
									<strong>Total Games Played:</strong>{' '}
									{totalGamesPlayed.toLocaleString()}
								</div>
							)}
							<section
								style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}
							>
								<h4
									style={{
										margin: '0 0 4px',
										fontSize: 12,
										color: '#9fb7ff',
										textTransform: 'uppercase',
									}}
								>
									SMILES Basics (C &amp; O only)
								</h4>
								<p style={{ margin: '3px 0' }}>
									• <strong>C</strong> = carbon atom; repeating letters = single
									bonds in sequence.
								</p>
								<p style={{ margin: '3px 0' }}>
									• <strong>O</strong> = oxygen atom.
								</p>
								<p style={{ margin: '3px 0' }}>
									• Adjacent characters are connected by single bonds.
								</p>
								<p style={{ margin: '3px 0' }}>
									• Parentheses create branches from the previous atom.
								</p>
							</section>
							<section
								style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}
							>
								<h4
									style={{
										margin: '0 0 4px',
										fontSize: 12,
										color: '#9fb7ff',
										textTransform: 'uppercase',
									}}
								>
									IUPAC Naming Snapshot
								</h4>
								<p style={{ margin: '3px 0' }}>
									• Alkanes: longest carbon chain + <em>-ane</em>.
								</p>
								<p style={{ margin: '3px 0' }}>
									• Alcohols: replace <em>-e</em> with <em>-ol</em>.
								</p>
								<p style={{ margin: '3px 0' }}>
									• Ethers: smaller side = alkoxy substituent.
								</p>
							</section>
							<section
								style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}
							>
								<h4
									style={{
										margin: '0 0 4px',
										fontSize: 12,
										color: '#9fb7ff',
										textTransform: 'uppercase',
									}}
								>
									Controls
								</h4>
								<p style={{ margin: '3px 0' }}>
									Arrows move, Space hard-drops, H opens/closes help, R restarts.
									Touch: tap left/right to move.
								</p>
							</section>
							<section
								style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}
							>
								<h4
									style={{
										margin: '0 0 4px',
										fontSize: 12,
										color: '#f5b63b',
										textTransform: 'uppercase',
									}}
								>
									ChemIllusion Reward
								</h4>
								<p style={{ margin: '3px 0' }}>
									Take the top spot on the leaderboard to unlock a preview code
									for one free month of <strong>ChemIllusion Basic</strong>{' '}
									membership at{' '}
									<a
										href="https://chemillusion.com/subscribe"
										style={{ color: '#8bd3ff' }}
									>
										chemillusion.com/subscribe
									</a>
									. Please keep it private!
								</p>
							</section>
							<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
								<button
									onClick={closeHelp}
									style={{
										padding: '5px 10px',
										borderRadius: 6,
										border: '1px solid #3a3a55',
										background: '#191926',
										color: '#8bd3ff',
										cursor: 'pointer',
										fontSize: 11,
									}}
								>
									Close
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		)
	}
)

ChemAsciiTetris.displayName = 'ChemAsciiTetris'

export default ChemAsciiTetris
