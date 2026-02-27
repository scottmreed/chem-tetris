import type { Atom, Cell, Coord, MatchCandidate, SmilesGraph, SmilesNode } from './types'

const directions: Coord[] = [
	{ x: 1, y: 0 },
	{ x: -1, y: 0 },
	{ x: 0, y: 1 },
	{ x: 0, y: -1 },
]

export function createCandidate(coords: Coord[]): MatchCandidate {
	const clone = coords.map((c) => ({ ...c }))
	const maxY = clone.reduce((max, c) => Math.max(max, c.y), -Infinity)
	const minX = clone.reduce((min, c) => Math.min(min, c.x), Infinity)
	const signature = clone
		.slice()
		.sort((a, b) => a.y - b.y || a.x - b.x)
		.map((c) => `${c.y}:${c.x}`)
		.join('|')
	return { coords: clone, maxY, minX, signature }
}

export function pickBetter(
	a: MatchCandidate | null,
	b: MatchCandidate | null
): MatchCandidate | null {
	if (!a) return b
	if (!b) return a
	if (b.maxY > a.maxY) return b
	if (b.maxY < a.maxY) return a
	if (b.minX < a.minX) return b
	if (b.minX > a.minX) return a
	return b.signature < a.signature ? b : a
}

export function parseSmilesGraph(pattern: string): SmilesGraph {
	const nodes: SmilesNode[] = []
	const adjacencyMap = new Map<number, Set<number>>()
	const branchStack: number[] = []
	let lastIndex: number | null = null

	const addEdge = (a: number, b: number) => {
		if (!adjacencyMap.has(a)) adjacencyMap.set(a, new Set())
		if (!adjacencyMap.has(b)) adjacencyMap.set(b, new Set())
		adjacencyMap.get(a)!.add(b)
		adjacencyMap.get(b)!.add(a)
	}

	for (const ch of pattern) {
		if (ch === 'C' || ch === 'O') {
			const idx = nodes.length
			nodes.push({ element: ch })
			if (!adjacencyMap.has(idx)) adjacencyMap.set(idx, new Set())
			if (lastIndex !== null) {
				addEdge(lastIndex, idx)
			}
			lastIndex = idx
		} else if (ch === '(') {
			if (lastIndex !== null) branchStack.push(lastIndex)
		} else if (ch === ')') {
			lastIndex = branchStack.length > 0 ? branchStack.pop()! : lastIndex
		} else {
			continue
		}
	}

	const adjacency = nodes.map((_, idx) => Array.from(adjacencyMap.get(idx) ?? []))
	return { nodes, adjacency }
}

export function findBestMatchForGraph(
	graph: SmilesGraph,
	board: Cell[][],
	width: number,
	height: number
): MatchCandidate | null {
	if (graph.nodes.length === 0) return null
	const total = graph.nodes.length
	const adjacency = graph.adjacency
	let best: MatchCandidate | null = null
	const seen = new Set<string>()
	const used = new Set<string>()
	const assignments = new Map<number, Coord>()
	const unassigned = new Set<number>()

	let rootIndex = 0
	for (let i = 0; i < total; i++) {
		unassigned.add(i)
		if ((adjacency[i]?.length ?? 0) > (adjacency[rootIndex]?.length ?? 0)) rootIndex = i
	}

	const getCandidatesForNode = (nodeIndex: number, neighborIndices: number[]): Coord[] => {
		let candidates: Coord[] | null = null
		for (const neighborIndex of neighborIndices) {
			const neighborPos = assignments.get(neighborIndex)
			if (!neighborPos) continue
			const local: Coord[] = []
			for (const dir of directions) {
				const nx = neighborPos.x + dir.x
				const ny = neighborPos.y + dir.y
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
				const cell = board[ny]?.[nx]
				if (cell !== graph.nodes[nodeIndex]?.element) continue
				local.push({ x: nx, y: ny })
			}
			if (local.length === 0) return []
			if (candidates === null) {
				candidates = local
			} else {
				candidates = candidates.filter((cand) =>
					local.some((loc) => loc.x === cand.x && loc.y === cand.y)
				)
				if (candidates.length === 0) return []
			}
		}
		const deduped = (candidates ?? []).filter(
			(cand, idx, arr) => arr.findIndex((c) => c.x === cand.x && c.y === cand.y) === idx
		)
		return deduped
	}

	const search = () => {
		if (assignments.size === total) {
			const coords = graph.nodes.map((_, idx) => ({ ...assignments.get(idx)! }))
			const candidate = createCandidate(coords)
			if (!seen.has(candidate.signature)) {
				seen.add(candidate.signature)
				best = pickBetter(best, candidate)
			}
			return
		}

		let nextNode: number | null = null
		let bestNeighborCount = -1
		for (const node of Array.from(unassigned)) {
			const assignedNeighbors = adjacency[node]?.filter((n) => assignments.has(n)) ?? []
			if (assignedNeighbors.length === 0) continue
			if (assignedNeighbors.length > bestNeighborCount) {
				bestNeighborCount = assignedNeighbors.length
				nextNode = node
			}
		}
		if (nextNode == null) return
		const assignedNeighbors = adjacency[nextNode]?.filter((n) => assignments.has(n)) ?? []
		const candidates = getCandidatesForNode(nextNode, assignedNeighbors)
		for (const cand of candidates) {
			const key = `${cand.x},${cand.y}`
			if (used.has(key)) continue
			let valid = true
			for (const neighbor of assignedNeighbors) {
				const neighborPos = assignments.get(neighbor)
				if (!neighborPos) {
					valid = false
					break
				}
				if (Math.abs(neighborPos.x - cand.x) + Math.abs(neighborPos.y - cand.y) !== 1) {
					valid = false
					break
				}
			}
			if (!valid) continue
			assignments.set(nextNode, cand)
			used.add(key)
			unassigned.delete(nextNode)
			search()
			unassigned.add(nextNode)
			used.delete(key)
			assignments.delete(nextNode)
		}
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (board[y]?.[x] !== graph.nodes[rootIndex]?.element) continue
			const key = `${x},${y}`
			assignments.set(rootIndex, { x, y })
			used.add(key)
			unassigned.delete(rootIndex)
			search()
			unassigned.add(rootIndex)
			used.delete(key)
			assignments.delete(rootIndex)
		}
	}
	return best
}
