import { useCallback, useRef } from 'react'
import { useSyncState } from '@robojs/sync/client'
import type { LobbyState, PlayerState, GarbageEvent, PlayerLobbyInfo } from '../app/game/types'

const EMPTY_LOBBY: LobbyState = {
	phase: 'lobby',
	hostId: '',
	players: {},
}

export function useMultiplayerSync(localPlayerId: string) {
	const [lobby, setLobby] = useSyncState<LobbyState>(EMPTY_LOBBY, ['lobby'])

	// Per-player state slots (up to 4 players)
	const [player0, setPlayer0] = useSyncState<PlayerState | null>(null, ['player', '0'])
	const [player1, setPlayer1] = useSyncState<PlayerState | null>(null, ['player', '1'])
	const [player2, setPlayer2] = useSyncState<PlayerState | null>(null, ['player', '2'])
	const [player3, setPlayer3] = useSyncState<PlayerState | null>(null, ['player', '3'])

	const playerStates = [player0, player1, player2, player3] as (PlayerState | null)[]
	const playerSetters = [setPlayer0, setPlayer1, setPlayer2, setPlayer3]

	// Garbage event queue
	const [garbageQueue, setGarbageQueue] = useSyncState<GarbageEvent[]>([], ['garbage'])
	const processedGarbageIds = useRef(new Set<string>())

	const getLocalSlot = useCallback((): number => {
		const playerInfo = lobby.players[localPlayerId]
		return playerInfo?.slot ?? -1
	}, [lobby.players, localPlayerId])

	const joinLobby = useCallback(
		(username: string, avatar: string | null) => {
			setLobby((prev: LobbyState) => {
				if (prev.players[localPlayerId]) return prev // already joined
				const usedSlots = new Set(Object.values(prev.players).map((p) => p.slot))
				let slot = -1
				for (let i = 0; i < 4; i++) {
					if (!usedSlots.has(i)) {
						slot = i
						break
					}
				}
				if (slot === -1) return prev // full

				const newPlayers = {
					...prev.players,
					[localPlayerId]: {
						playerId: localPlayerId,
						username,
						avatar,
						ready: false,
						joinedAt: Date.now(),
						slot,
					} as PlayerLobbyInfo,
				}
				return {
					...prev,
					hostId: prev.hostId || localPlayerId,
					players: newPlayers,
				}
			})
		},
		[localPlayerId, setLobby]
	)

	const leaveLobby = useCallback(() => {
		const slot = getLocalSlot()
		if (slot >= 0 && playerSetters[slot]) {
			playerSetters[slot]!(null as unknown as PlayerState)
		}
		setLobby((prev: LobbyState) => {
			const newPlayers = { ...prev.players }
			delete newPlayers[localPlayerId]
			const remainingIds = Object.keys(newPlayers)
			return {
				...prev,
				hostId: prev.hostId === localPlayerId ? (remainingIds[0] ?? '') : prev.hostId,
				players: newPlayers,
			}
		})
	}, [localPlayerId, setLobby, getLocalSlot, playerSetters])

	const toggleReady = useCallback(() => {
		setLobby((prev: LobbyState) => {
			const player = prev.players[localPlayerId]
			if (!player) return prev
			return {
				...prev,
				players: {
					...prev.players,
					[localPlayerId]: { ...player, ready: !player.ready },
				},
			}
		})
	}, [localPlayerId, setLobby])

	const startGame = useCallback(() => {
		setLobby((prev: LobbyState) => {
			if (prev.hostId !== localPlayerId) return prev
			return {
				...prev,
				phase: 'countdown',
				countdownStart: Date.now(),
				gameStartTime: Date.now() + 3000,
			}
		})
		// Clear garbage queue on game start
		setGarbageQueue([] as unknown as GarbageEvent[])
		processedGarbageIds.current.clear()
	}, [localPlayerId, setLobby, setGarbageQueue])

	const setPlaying = useCallback(() => {
		setLobby((prev: LobbyState) => ({
			...prev,
			phase: 'playing',
		}))
	}, [setLobby])

	const broadcastState = useCallback(
		(state: PlayerState) => {
			const slot = getLocalSlot()
			if (slot >= 0 && slot < 4 && playerSetters[slot]) {
				playerSetters[slot]!(state as unknown as PlayerState)
			}
		},
		[getLocalSlot, playerSetters]
	)

	const sendGarbage = useCallback(
		(toPlayerId: string, rows: number) => {
			const event: GarbageEvent = {
				id: `${localPlayerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				fromPlayerId: localPlayerId,
				toPlayerId,
				rows,
				timestamp: Date.now(),
			}
			setGarbageQueue((prev: GarbageEvent[]) => [...prev, event])
		},
		[localPlayerId, setGarbageQueue]
	)

	const consumeGarbage = useCallback((): GarbageEvent[] => {
		const myEvents = garbageQueue.filter(
			(e) => e.toPlayerId === localPlayerId && !processedGarbageIds.current.has(e.id)
		)
		if (myEvents.length > 0) {
			for (const e of myEvents) {
				processedGarbageIds.current.add(e.id)
			}
			// Clean up processed events from queue
			setGarbageQueue((prev: GarbageEvent[]) =>
				prev.filter((e) => !processedGarbageIds.current.has(e.id))
			)
		}
		return myEvents
	}, [localPlayerId, garbageQueue, setGarbageQueue])

	const reportDeath = useCallback(() => {
		setLobby((prev: LobbyState) => {
			// Check if only one player alive
			const alivePlayers = Object.keys(prev.players).filter((pid) => {
				if (pid === localPlayerId) return false // this player just died
				const info = prev.players[pid]
				if (!info) return false
				const pState = playerStates[info.slot]
				return pState?.status === 'playing'
			})

			if (alivePlayers.length <= 1) {
				return {
					...prev,
					phase: 'finished',
					winnerId: alivePlayers[0] ?? localPlayerId,
				}
			}
			return prev
		})
	}, [localPlayerId, setLobby, playerStates])

	const resetLobby = useCallback(() => {
		setLobby((prev: LobbyState) => ({
			...prev,
			phase: 'lobby',
			winnerId: undefined,
			gameStartTime: undefined,
			countdownStart: undefined,
			players: Object.fromEntries(
				Object.entries(prev.players).map(([id, info]) => [id, { ...info, ready: false }])
			),
		}))
		setGarbageQueue([] as unknown as GarbageEvent[])
		processedGarbageIds.current.clear()
		for (const setter of playerSetters) {
			setter(null as unknown as PlayerState)
		}
	}, [setLobby, setGarbageQueue, playerSetters])

	const playerCount = Object.keys(lobby.players).length

	return {
		lobby,
		playerStates,
		playerCount,
		garbageQueue,
		getLocalSlot,
		joinLobby,
		leaveLobby,
		toggleReady,
		startGame,
		setPlaying,
		broadcastState,
		sendGarbage,
		consumeGarbage,
		reportDeath,
		resetLobby,
	}
}
