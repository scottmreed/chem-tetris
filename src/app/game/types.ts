export type Cell = '.' | 'C' | 'O' | 'G'
export type Atom = 'C' | 'O'

export type Molecule = { name: string; pattern: string }

export type Coord = { x: number; y: number }
export type Active = { x: number; y: number; atom: Atom } | null

export type SmilesNode = { element: Atom }
export type SmilesGraph = { nodes: SmilesNode[]; adjacency: number[][] }

export type MatchCandidate = {
	coords: Coord[]
	maxY: number
	minX: number
	signature: string
}

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'dead' | 'spectating'

export type PlayerState = {
	playerId: string
	username: string
	avatar: string | null
	board: Cell[][]
	score: number
	status: PlayerStatus
	target: { name: string; pattern: string }
	speedRatio: number
	lastUpdate: number
}

export type PlayerLobbyInfo = {
	playerId: string
	username: string
	avatar: string | null
	ready: boolean
	joinedAt: number
	slot: number
}

export type LobbyState = {
	phase: 'lobby' | 'countdown' | 'playing' | 'finished'
	hostId: string
	players: Record<string, PlayerLobbyInfo>
	countdownStart?: number
	winnerId?: string
	gameStartTime?: number
}

export type GarbageEvent = {
	id: string
	fromPlayerId: string
	toPlayerId: string
	rows: number
	timestamp: number
}

export type HighScoreEntry = {
	username: string
	userId: string
	avatar?: string | null
	score: number
	timestamp: number
}
