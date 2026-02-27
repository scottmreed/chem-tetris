import type { Cell, Atom, Active, Molecule, MatchCandidate, PlayerState } from './types'
import { selectTarget } from './molecules'
import { parseSmilesGraph, findBestMatchForGraph } from './smiles'

export type TickResult = {
	match: MatchCandidate | null
	gameOver: boolean
	targetChanged: boolean
}

export class GameEngine {
	width: number
	height: number
	board: Cell[][]
	active: Active
	score: number
	target: Molecule
	running: boolean
	softDrop: boolean
	tickMs: number
	currentTickMs: number
	pendingGarbage: number
	customMolecules: Molecule[] | null

	constructor(width: number, height: number, tickMs: number, customMolecules?: Molecule[] | null) {
		this.width = width
		this.height = height
		this.tickMs = tickMs
		this.currentTickMs = tickMs
		this.customMolecules = customMolecules ?? null
		this.board = this.emptyBoard()
		this.active = null
		this.score = 0
		this.target = selectTarget(0, undefined, this.customMolecules)
		this.running = false
		this.softDrop = false
		this.pendingGarbage = 0
	}

	emptyBoard(): Cell[][] {
		return Array.from({ length: this.height }, () =>
			Array.from({ length: this.width }, () => '.' as Cell)
		)
	}

	reset() {
		this.board = this.emptyBoard()
		this.active = null
		this.score = 0
		this.target = selectTarget(0, undefined, this.customMolecules)
		this.running = false
		this.softDrop = false
		this.currentTickMs = this.tickMs
		this.pendingGarbage = 0
	}

	randAtom(): Atom {
		const oxygenProb = this.score >= 4 ? 0.25 : 0.15
		return Math.random() < oxygenProb ? 'O' : 'C'
	}

	canMove(dx: number, dy: number): boolean {
		if (!this.active) return false
		const nx = this.active.x + dx
		const ny = this.active.y + dy
		if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return false
		if (this.board[ny]?.[nx] !== '.') return false
		return true
	}

	applyGravity() {
		for (let x = 0; x < this.width; x++) {
			const stack: Cell[] = []
			for (let y = 0; y < this.height; y++) {
				const v = this.board[y]?.[x]
				if (v && v !== '.') stack.push(v)
			}
			for (let y = this.height - 1, i = stack.length - 1; y >= 0; y--) {
				if (this.board[y]) {
					this.board[y]![x] = i >= 0 ? (stack[i--] ?? '.') : ('.' as Cell)
				}
			}
		}
	}

	spawn(): boolean {
		const x = Math.floor(this.width / 2)
		const y = 0
		if (this.board[y]?.[x] !== '.') {
			return false // game over
		}
		this.active = { x, y, atom: this.randAtom() }
		return true
	}

	lockPiece(): MatchCandidate | null {
		if (!this.active) return null
		if (this.board[this.active.y]) {
			this.board[this.active.y]![this.active.x] = this.active.atom as Cell
		}
		this.active = null
		return this.findBestTargetMatch()
	}

	hardDrop(): MatchCandidate | null {
		if (!this.active) return null
		while (this.canMove(0, 1)) this.active.y++
		return this.lockPiece()
	}

	moveHorizontal(dx: number): boolean {
		if (!this.active || !this.running) return false
		if (this.canMove(dx, 0)) {
			this.active.x += dx
			return true
		}
		return false
	}

	findBestTargetMatch(): MatchCandidate | null {
		const graph = parseSmilesGraph(this.target.pattern)
		return findBestMatchForGraph(graph, this.board, this.width, this.height)
	}

	pickNewTarget(): MatchCandidate | null {
		const next = selectTarget(this.score, this.target?.name, this.customMolecules)
		this.target = next
		const match = this.findBestTargetMatch()
		if (!match) return null
		this.score += 1
		this.boostSpeed(1)
		return match
	}

	clearMatch(match: MatchCandidate) {
		for (const coord of match.coords) {
			if (this.board[coord.y]) {
				this.board[coord.y]![coord.x] = '.' as Cell
			}
		}
		this.applyGravity()
	}

	boostSpeed(clearedCount: number): boolean {
		if (clearedCount <= 0) return false
		const factor = Math.pow(0.9, clearedCount)
		const nextDuration = Math.max(80, this.currentTickMs * factor)
		if (nextDuration === this.currentTickMs) return false
		this.currentTickMs = nextDuration
		return true
	}

	addGarbageRows(count: number): boolean {
		const capped = Math.min(count, 6)
		// Check if any non-empty cells in top rows would be pushed off
		for (let y = 0; y < capped; y++) {
			if (this.board[y]?.some((c) => c !== '.')) {
				return false // topped out
			}
		}
		// Shift rows up
		for (let y = 0; y < this.height - capped; y++) {
			this.board[y] = [...(this.board[y + capped] ?? [])]
		}
		// Fill bottom rows with garbage
		for (let y = this.height - capped; y < this.height; y++) {
			const gapX = Math.floor(Math.random() * this.width)
			this.board[y] = Array.from({ length: this.width }, (_, x) =>
				x === gapX ? ('.' as Cell) : ('G' as Cell)
			)
		}
		// Shift active piece up
		if (this.active) {
			this.active.y -= capped
			if (this.active.y < 0) this.active.y = 0
		}
		return true
	}

	tick(): TickResult {
		if (!this.running) return { match: null, gameOver: false, targetChanged: false }
		const steps = this.softDrop ? 2 : 1
		for (let i = 0; i < steps; i++) {
			if (this.active && this.canMove(0, 1)) {
				this.active.y++
			} else if (this.active) {
				const match = this.lockPiece()
				if (match) {
					this.score += 1
					this.boostSpeed(1)
					return { match, gameOver: false, targetChanged: false }
				}
				if (!this.spawn()) {
					this.running = false
					return { match: null, gameOver: true, targetChanged: false }
				}
				break
			}
		}
		return { match: null, gameOver: false, targetChanged: false }
	}

	getSpeedRatio(): number {
		return this.currentTickMs > 0 ? this.tickMs / this.currentTickMs : 1
	}

	getSnapshot(playerId: string, username: string, avatar: string | null, status: 'playing' | 'dead'): PlayerState {
		return {
			playerId,
			username,
			avatar,
			board: this.board.map((row) => [...row]),
			score: this.score,
			status,
			target: { name: this.target.name, pattern: this.target.pattern },
			speedRatio: this.getSpeedRatio(),
			lastUpdate: Date.now(),
		}
	}
}
