import { parseSmilesGraph } from './smiles'

export function calculateGarbageRows(moleculePattern: string): number {
	const graph = parseSmilesGraph(moleculePattern)
	const atomCount = graph.nodes.length
	return Math.max(1, Math.floor(atomCount / 3))
}

export const MAX_PENDING_GARBAGE = 6
