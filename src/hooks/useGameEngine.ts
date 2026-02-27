import { useCallback, useEffect, useRef, useState } from 'react'
import { GameEngine } from '../app/game/engine'
import type { MatchCandidate, Molecule, PlayerState, GarbageEvent } from '../app/game/types'

export interface UseGameEngineOptions {
	playerId: string
	username: string
	avatar: string | null
	width?: number
	height?: number
	tickMs?: number
	customMolecules?: Molecule[] | null
	onMatch?: (moleculePattern: string, score: number) => void
	onDeath?: (score: number) => void
	onStateChange?: (state: PlayerState) => void
	consumeGarbage?: () => GarbageEvent[]
	onScoreChange?: (score: number) => void
}

export function useGameEngine(opts: UseGameEngineOptions) {
	const {
		playerId,
		username,
		avatar,
		width = 10,
		height = 12,
		tickMs = 280,
		customMolecules,
		onMatch,
		onDeath,
		onStateChange,
		consumeGarbage,
		onScoreChange,
	} = opts

	const engineRef = useRef<GameEngine | null>(null)
	const [version, setVersion] = useState(0)
	const tickId = useRef<number | null>(null)
	const [highlightKeys, setHighlightKeys] = useState<string[]>([])
	const highlightTimeoutRef = useRef<number | null>(null)
	const [overlay, setOverlay] = useState<string | null>(null)
	const [hasStarted, setHasStarted] = useState(false)
	const [showHelp, setShowHelp] = useState(false)
	const preHelpRunningRef = useRef(false)
	const isDead = useRef(false)

	// Stable refs for callbacks
	const onMatchRef = useRef(onMatch)
	onMatchRef.current = onMatch
	const onDeathRef = useRef(onDeath)
	onDeathRef.current = onDeath
	const onStateChangeRef = useRef(onStateChange)
	onStateChangeRef.current = onStateChange
	const consumeGarbageRef = useRef(consumeGarbage)
	consumeGarbageRef.current = consumeGarbage
	const onScoreChangeRef = useRef(onScoreChange)
	onScoreChangeRef.current = onScoreChange

	const bump = useCallback(() => setVersion((v) => v + 1), [])

	const clearHighlightTimeout = useCallback(() => {
		if (highlightTimeoutRef.current !== null) {
			window.clearTimeout(highlightTimeoutRef.current)
			highlightTimeoutRef.current = null
		}
	}, [])

	const broadcastState = useCallback(
		(status: 'playing' | 'dead' = 'playing') => {
			const engine = engineRef.current
			if (!engine) return
			const snapshot = engine.getSnapshot(playerId, username, avatar, status)
			onStateChangeRef.current?.(snapshot)
		},
		[playerId, username, avatar]
	)

	const getEngine = useCallback((): GameEngine => {
		if (!engineRef.current) {
			engineRef.current = new GameEngine(width, height, tickMs, customMolecules)
		}
		return engineRef.current
	}, [width, height, tickMs, customMolecules])

	const stopTickLoop = useCallback(() => {
		if (tickId.current !== null) {
			window.clearInterval(tickId.current)
			tickId.current = null
		}
	}, [])

	const scheduleMatchClear = useCallback(
		(match: MatchCandidate, afterClear: () => void) => {
			const engine = getEngine()
			engine.running = false
			engine.softDrop = false
			const keys = match.coords.map((c) => `${c.x},${c.y}`)
			setHighlightKeys(keys)
			bump()
			clearHighlightTimeout()
			highlightTimeoutRef.current = window.setTimeout(() => {
				highlightTimeoutRef.current = null
				engine.clearMatch(match)

				// After clearing, check if new target also matches immediately
				const autoMatch = engine.pickNewTarget()
				if (autoMatch) {
					onMatchRef.current?.(engine.target.pattern, engine.score)
					onScoreChangeRef.current?.(engine.score)
					scheduleMatchClear(autoMatch, afterClear)
				} else {
					afterClear()
				}
			}, 500)
		},
		[getEngine, bump, clearHighlightTimeout]
	)

	const gameOver = useCallback(
		(msg: string) => {
			const engine = getEngine()
			engine.running = false
			isDead.current = true
			stopTickLoop()
			clearHighlightTimeout()
			setHighlightKeys([])
			onDeathRef.current?.(engine.score)
			broadcastState('dead')
			setOverlay(`${msg}  Score: ${engine.score}. Click Restart or press 'R'.`)
			bump()
		},
		[getEngine, stopTickLoop, clearHighlightTimeout, broadcastState, bump]
	)

	const startTickLoop = useCallback(() => {
		stopTickLoop()
		const engine = getEngine()
		tickId.current = window.setInterval(() => {
			if (!engine.running) return

			// Process incoming garbage
			const garbageEvents = consumeGarbageRef.current?.() ?? []
			for (const evt of garbageEvents) {
				if (!engine.addGarbageRows(evt.rows)) {
					gameOver('Garbage overflow!')
					return
				}
			}

			const result = engine.tick()
			if (result.gameOver) {
				gameOver('Game Over!')
				return
			}
			if (result.match) {
				onMatchRef.current?.(engine.target.pattern, engine.score)
				onScoreChangeRef.current?.(engine.score)
				scheduleMatchClear(result.match, () => {
					if (showHelp) {
						engine.running = false
						engine.spawn()
						bump()
					} else {
						engine.running = true
						engine.spawn()
						bump()
						broadcastState()
					}
				})
				return
			}
			bump()
			// Broadcast state periodically (every ~5 ticks or on lock)
			if (!engine.active || Math.random() < 0.2) {
				broadcastState()
			}
		}, engine.currentTickMs)
	}, [getEngine, stopTickLoop, gameOver, scheduleMatchClear, bump, broadcastState, showHelp])

	const start = useCallback(() => {
		const engine = getEngine()
		setOverlay(null)
		clearHighlightTimeout()
		setHighlightKeys([])
		engine.reset()
		engine.running = true
		isDead.current = false

		// Check if new target matches immediately
		const autoMatch = engine.pickNewTarget()
		if (autoMatch) {
			onMatchRef.current?.(engine.target.pattern, engine.score)
			onScoreChangeRef.current?.(engine.score)
			scheduleMatchClear(autoMatch, () => {
				engine.running = true
				engine.spawn()
				bump()
				startTickLoop()
			})
		} else {
			engine.spawn()
			startTickLoop()
		}
		bump()
		setHasStarted(true)
		broadcastState()
	}, [getEngine, clearHighlightTimeout, scheduleMatchClear, bump, startTickLoop, broadcastState])

	const prepareForStart = useCallback(() => {
		clearHighlightTimeout()
		setHighlightKeys([])
		stopTickLoop()
		const engine = getEngine()
		engine.reset()
		isDead.current = false

		const autoMatch = engine.pickNewTarget()
		if (!autoMatch) {
			engine.spawn()
		}
		setOverlay('Click Start to begin dropping atoms.')
		setHasStarted(false)
		bump()
	}, [getEngine, clearHighlightTimeout, stopTickLoop, bump])

	const openHelp = useCallback(() => {
		const engine = engineRef.current
		if (engine) {
			preHelpRunningRef.current = engine.running || highlightTimeoutRef.current !== null
			engine.running = false
			engine.softDrop = false
		} else {
			preHelpRunningRef.current = false
		}
		setShowHelp(true)
	}, [])

	const closeHelp = useCallback(() => {
		setShowHelp(false)
		const engine = engineRef.current
		if (engine && preHelpRunningRef.current) {
			engine.running = true
		}
		preHelpRunningRef.current = false
	}, [])

	// Initialize on mount
	useEffect(() => {
		prepareForStart()
		return () => {
			stopTickLoop()
			clearHighlightTimeout()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Keyboard controls
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const engine = engineRef.current
			if (!engine) return

			if (showHelp) {
				if (e.key === 'h' || e.key === 'H' || e.key === 'Escape') {
					closeHelp()
				}
				return
			}

			if (!engine.running) {
				if (e.key === 'h' || e.key === 'H') {
					openHelp()
					return
				}
				if (e.key === 'r' || e.key === 'R') {
					start()
				}
				return
			}
			if (!engine.active) return

			if (e.key === 'h' || e.key === 'H') {
				openHelp()
				return
			}

			if (e.key === 'ArrowLeft') {
				engine.moveHorizontal(-1)
				bump()
			} else if (e.key === 'ArrowRight') {
				engine.moveHorizontal(1)
				bump()
			} else if (e.key === 'ArrowDown') {
				engine.softDrop = true
			} else if (e.code === 'Space') {
				e.preventDefault()
				const match = engine.hardDrop()
				if (match) {
					engine.score += 1
					engine.boostSpeed(1)
					onMatchRef.current?.(engine.target.pattern, engine.score)
					onScoreChangeRef.current?.(engine.score)
					scheduleMatchClear(match, () => {
						engine.running = true
						if (!engine.spawn()) {
							gameOver('Game Over!')
							return
						}
						bump()
						broadcastState()
						startTickLoop()
					})
					return
				}
				if (!engine.spawn()) {
					gameOver('Game Over!')
					return
				}
				bump()
				broadcastState()
			} else if (e.key === 'r' || e.key === 'R') {
				start()
			}
		}
		const onKeyUp = (e: KeyboardEvent) => {
			const engine = engineRef.current
			if (!engine) return
			if (e.key === 'ArrowDown') engine.softDrop = false
		}
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('keyup', onKeyUp)
		return () => {
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('keyup', onKeyUp)
		}
	}, [showHelp, start, openHelp, closeHelp, bump, gameOver, scheduleMatchClear, broadcastState, startTickLoop])

	return {
		engine: engineRef.current,
		engineRef,
		version,
		highlightKeys,
		overlay,
		hasStarted,
		showHelp,
		isDead: isDead.current,
		start,
		prepareForStart,
		openHelp,
		closeHelp,
		setOverlay,
		bump,
		getEngine,
	}
}
