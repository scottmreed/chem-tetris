import type { Molecule } from './types'

export const TIER_ONE_MOLS: Molecule[] = [
	{ name: 'ethane', pattern: 'CC' },
	{ name: 'propane', pattern: 'CCC' },
	{ name: 'butane', pattern: 'CCCC' },
	{ name: 'pentane', pattern: 'CCCCC' },
	{ name: 'hexane', pattern: 'CCCCCC' },
	{ name: 'ethanol', pattern: 'CCO' },
	{ name: 'dimethyl ether', pattern: 'COC' },
	{ name: 'diethyl ether', pattern: 'CCOCC' },
]

export const TIER_TWO_MOLS: Molecule[] = [
	{ name: '2-methylpropane', pattern: 'CC(C)C' },
	{ name: '2-methylbutane', pattern: 'CC(C)CC' },
	{ name: 'propan-1-ol', pattern: 'CCCO' },
	{ name: '2-propanol', pattern: 'CC(O)C' },
	{ name: 'butan-2-ol', pattern: 'CC(O)CC' },
	{ name: '2-methylpropan-1-ol', pattern: 'CC(C)CO' },
	{ name: 'methoxyethane', pattern: 'COCC' },
	{ name: 'methoxyethanol', pattern: 'COCCO' },
	{ name: 'propoxyethane', pattern: 'CCCOCC' },
]

export const TIER_THREE_MOLS: Molecule[] = [
	{ name: '3-methylpentane', pattern: 'CCC(C)CC' },
	{ name: '2-methylpentane', pattern: 'CC(C)CCC' },
	{ name: '2,2-dimethylbutane', pattern: 'CC(C)(C)CC' },
	{ name: '2,3-dimethylbutane', pattern: 'CC(C)C(C)C' },
	{ name: '3-ethylpentane', pattern: 'CCC(CC)CC' },
	{ name: '2-methoxy-2-methylpropane', pattern: 'COC(C)(C)C' },
	{ name: '1-methoxy-2-methylpropane', pattern: 'COCC(C)C' },
	{ name: '2-ethoxy-2-methylpropane', pattern: 'CCOC(C)(C)C' },
	{ name: '2-methoxypropan-1-ol', pattern: 'COC(C)O' },
	{ name: '2-(methoxymethyl)propan-1-ol', pattern: 'COC(C)CO' },
	{ name: '2-methoxy-2-methylpropan-1-ol', pattern: 'COC(C)(C)CO' },
	{ name: '2-ethoxyethan-1-ol', pattern: 'CCOCCO' },
	{ name: '3-methoxy-2-methylbutan-1-ol', pattern: 'COC(C)CCO' },
	{ name: '2-methoxy-3-methylbutane', pattern: 'COC(C)CC' },
	{ name: '2-(ethoxymethyl)propan-1-ol', pattern: 'CCOC(C)CO' },
	{ name: '2-ethoxy-3-methylbutane', pattern: 'CCOC(C)CC' },
	{ name: '2-ethoxy-2-methylpropan-1-ol', pattern: 'CCOC(C)(C)CO' },
]

export const FALLBACK_MOLECULE: Molecule = { name: 'ethane', pattern: 'CC' }

function chooseRandom(pool: Molecule[], prevName?: string): Molecule | null {
	if (pool.length === 0) return null
	if (pool.length === 1) return pool[0] ?? null
	let candidate = pool[Math.floor(Math.random() * pool.length)] ?? null
	if (!candidate) return null
	let attempts = 0
	while (candidate.name === prevName && attempts < pool.length) {
		candidate = pool[Math.floor(Math.random() * pool.length)] ?? null
		if (!candidate) return null
		attempts += 1
	}
	return candidate
}

export function selectTarget(
	clearCount: number,
	prevName?: string,
	customMolecules?: Molecule[] | null
): Molecule {
	if (customMolecules && customMolecules.length > 0) {
		return chooseRandom(customMolecules, prevName) ?? customMolecules[0] ?? FALLBACK_MOLECULE
	}

	if (clearCount < 2) {
		return (
			chooseRandom(TIER_ONE_MOLS, prevName) ??
			chooseRandom(TIER_TWO_MOLS, prevName) ??
			chooseRandom(TIER_THREE_MOLS, prevName) ??
			FALLBACK_MOLECULE
		)
	}

	if (clearCount < 6) {
		const tierTwoChance = Math.min(0.85, 0.35 + (clearCount - 2) * 0.15)
		const useTierTwo = Math.random() < tierTwoChance
		let candidate = chooseRandom(useTierTwo ? TIER_TWO_MOLS : TIER_ONE_MOLS, prevName)
		if (!candidate) {
			candidate = chooseRandom(useTierTwo ? TIER_ONE_MOLS : TIER_TWO_MOLS, prevName)
		}
		if (!candidate) {
			candidate = chooseRandom(TIER_THREE_MOLS, prevName)
		}
		return candidate ?? FALLBACK_MOLECULE
	}

	const tierThreeChance = Math.min(0.9, 0.4 + (clearCount - 6) * 0.1)
	const tierTwoChance = Math.min(0.7, 0.3 + (clearCount - 6) * 0.08)
	const roll = Math.random()
	let primaryPool: Molecule[]
	if (roll < tierThreeChance) {
		primaryPool = TIER_THREE_MOLS
	} else if (roll < tierThreeChance + tierTwoChance) {
		primaryPool = TIER_TWO_MOLS
	} else {
		primaryPool = TIER_ONE_MOLS
	}

	let candidate = chooseRandom(primaryPool, prevName)
	if (!candidate) {
		candidate =
			chooseRandom(TIER_THREE_MOLS, prevName) ??
			chooseRandom(TIER_TWO_MOLS, prevName) ??
			chooseRandom(TIER_ONE_MOLS, prevName)
	}
	return candidate ?? FALLBACK_MOLECULE
}
