import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';

type Cell = '.' | 'C' | 'O';
type Atom = 'C' | 'O';

type Molecule = { name: string; pattern: string };

export type HighScoreEntry = {
  username: string;
  userId: string;
  avatar?: string | null;
  score: number;
  timestamp: number;
};

export interface ChemAsciiTetrisProps {
  width?: number;
  height?: number;
  tickMs?: number;
  molecules?: Molecule[];
  onEnd?: (score: number) => void;
  onGameStateChange?: (state: {
    score: number;
    speed: number;
    target: string;
    targetPattern: string;
    showHint: boolean;
    isMobile: boolean;
  }) => void;
  className?: string;
  showHint?: boolean;
  discordUsername?: string;
  discordUserId?: string;
  discordAvatar?: string | null;
  onHighScoreSubmit?: (entry: HighScoreEntry) => void;
  onGameStart?: () => void;
  totalGamesPlayed?: number;
}

export interface ChemAsciiTetrisRef {
  openHelp: () => void;
}

const ChemAsciiTetris = forwardRef<ChemAsciiTetrisRef, ChemAsciiTetrisProps>(({
  width = 10,
  height = 12,
  tickMs = 280,
  molecules,
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
}, ref) => {
  const TIER_ONE_MOLS = useMemo<Molecule[]>(
    () => [
      { name: 'ethane', pattern: 'CC' },
      { name: 'propane', pattern: 'CCC' },
      { name: 'butane', pattern: 'CCCC' },
      { name: 'pentane', pattern: 'CCCCC' },
      { name: 'hexane', pattern: 'CCCCCC' },
      { name: 'ethanol', pattern: 'CCO' },
      { name: 'dimethyl ether', pattern: 'COC' },
      { name: 'diethyl ether', pattern: 'CCOCC' },
    ],
    []
  );

  const TIER_TWO_MOLS = useMemo<Molecule[]>(
    () => [
      { name: '2-methylpropane', pattern: 'CC(C)C' },
      { name: '2-methylbutane', pattern: 'CC(C)CC' },
      { name: 'propan-1-ol', pattern: 'CCCO' },
      { name: '2-propanol', pattern: 'CC(O)C' },
      { name: 'butan-2-ol', pattern: 'CC(O)CC' },
      { name: '2-methylpropan-1-ol', pattern: 'CC(C)CO' },
      { name: 'methoxyethane', pattern: 'COCC' },
      { name: 'methoxyethanol', pattern: 'COCCO' },
      { name: 'propoxyethane', pattern: 'CCCOCC' },
    ],
    []
  );

  const TIER_THREE_MOLS = useMemo<Molecule[]>(
    () => [
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
    ],
    []
  );

  const customMolecules = useMemo<Molecule[] | null>(
    () => (molecules && molecules.length > 0 ? molecules : null),
    [molecules]
  );

  const fallbackMolecule = useMemo<Molecule>(
    () =>
      customMolecules?.[0] ??
      TIER_ONE_MOLS[0] ??
      TIER_TWO_MOLS[0] ??
      TIER_THREE_MOLS[0] ?? { name: 'ethane', pattern: 'CC' },
    [customMolecules, TIER_ONE_MOLS, TIER_TWO_MOLS, TIER_THREE_MOLS]
  );

  type Active = { x: number; y: number; atom: Atom } | null;
  type GameState = {
    board: Cell[][];
    active: Active;
    score: number;
    target: Molecule;
    running: boolean;
    softDrop: boolean;
  };

  type Coord = { x: number; y: number };
  type MatchCandidate = {
    coords: Coord[];
    maxY: number;
    minX: number;
    signature: string;
  };
  type SmilesNode = { element: Atom };
  type SmilesGraph = { nodes: SmilesNode[]; adjacency: number[][] };

  const gameRef = useRef<GameState | null>(null);
  const [, setVersion] = useState(0);
  const tickId = useRef<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [speedMs, setSpeedMs] = useState(tickMs);
  const tickDurationRef = useRef(tickMs);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [highlightKeys, setHighlightKeys] = useState<string[]>([]);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const preHelpRunningRef = useRef(false);

  useEffect(() => () => clearHighlightTimeout(), []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      setIsMobile(coarse || /Mobi|Android|iPad|iPhone|iPod|Windows Phone/i.test(ua));
    }
  }, []);

  const emptyBoard = (): Cell[][] =>
    Array.from({ length: height }, () => Array.from({ length: width }, () => '.'));

  const randAtom = (): Atom => {
    const g = gameRef.current!;
    const oxygenProb = g.score >= 4 ? 0.25 : 0.15;
    return Math.random() < oxygenProb ? 'O' : 'C';
  };

  const bump = () => setVersion((v) => v + 1);

  const renderBoard = () => {
    const g = gameRef.current!;
    const highlightSet = new Set(highlightKeys);
    const rows: React.ReactElement[] = [];
    const border = '+' + '-'.repeat(width) + '+';
    const cellStyleBase: React.CSSProperties = { display: 'inline-block', width: '1ch', textAlign: 'center' };

    rows.push(<span key="top">{border}</span>);
    rows.push(<br key="top-br" />);

    for (let y = 0; y < height; y++) {
      rows.push(
        <span key={`row-${y}-start`} style={cellStyleBase}>
          |
        </span>
      );
      for (let x = 0; x < width; x++) {
        let ch: Cell | Atom = g.board[y]?.[x] ?? '.';
        if (g.active && g.active.x === x && g.active.y === y) ch = g.active.atom;
        const key = `${x},${y}`;
        let style: React.CSSProperties = cellStyleBase;
        if (highlightSet.has(key)) {
          style = {
            ...style,
            background: '#f5b63b',
            color: '#0b1328',
            borderRadius: 3,
          };
        } else if (ch === 'O') {
          style = {
            ...style,
            color: '#6fb8ff',
          };
        }
        rows.push(
          <span key={`cell-${x}-${y}`} style={style}>
            {ch}
          </span>
        );
      }
      rows.push(
        <span key={`row-${y}-end`} style={cellStyleBase}>
          |
        </span>
      );
      if (y < height - 1) rows.push(<br key={`br-${y}`} />);
    }
    rows.push(<br key="bottom-br" />);
    rows.push(<span key="bottom">{border}</span>);
    return rows;
  };

  const canMove = (dx: number, dy: number): boolean => {
    const g = gameRef.current!;
    if (!g.active) return false;
    const nx = g.active.x + dx;
    const ny = g.active.y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
    if (g.board[ny]?.[nx] !== '.') return false;
    return true;
  };

  const applyGravity = () => {
    const g = gameRef.current!;
    for (let x = 0; x < width; x++) {
      const stack: Cell[] = [];
      for (let y = 0; y < height; y++) {
        const v = g.board[y]?.[x];
        if (v && v !== '.') stack.push(v);
      }
      for (let y = height - 1, i = stack.length - 1; y >= 0; y--) {
        if (g.board[y]) {
          g.board[y]![x] = i >= 0 ? (stack[i--] ?? '.') : '.' as Cell;
        }
      }
    }
  };

  const directions: Coord[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  const createCandidate = (coords: Coord[]): MatchCandidate => {
    const clone = coords.map((c) => ({ ...c }));
    const maxY = clone.reduce((max, c) => Math.max(max, c.y), -Infinity);
    const minX = clone.reduce((min, c) => Math.min(min, c.x), Infinity);
    const signature = clone
      .slice()
      .sort((a, b) => (a.y - b.y) || (a.x - b.x))
      .map((c) => `${c.y}:${c.x}`)
      .join('|');
    return { coords: clone, maxY, minX, signature };
  };

  const pickBetter = (a: MatchCandidate | null, b: MatchCandidate | null): MatchCandidate | null => {
    if (!a) return b;
    if (!b) return a;
    if (b.maxY > a.maxY) return b;
    if (b.maxY < a.maxY) return a;
    if (b.minX < a.minX) return b;
    if (b.minX > a.minX) return a;
    return b.signature < a.signature ? b : a;
  };

  const parseSmilesGraph = (pattern: string): SmilesGraph => {
    const nodes: SmilesNode[] = [];
    const adjacencyMap = new Map<number, Set<number>>();
    const branchStack: number[] = [];
    let lastIndex: number | null = null;

    const addEdge = (a: number, b: number) => {
      if (!adjacencyMap.has(a)) adjacencyMap.set(a, new Set());
      if (!adjacencyMap.has(b)) adjacencyMap.set(b, new Set());
      adjacencyMap.get(a)!.add(b);
      adjacencyMap.get(b)!.add(a);
    };

    for (const ch of pattern) {
      if (ch === 'C' || ch === 'O') {
        const idx = nodes.length;
        nodes.push({ element: ch });
        if (!adjacencyMap.has(idx)) adjacencyMap.set(idx, new Set());
        if (lastIndex !== null) {
          addEdge(lastIndex, idx);
        }
        lastIndex = idx;
      } else if (ch === '(') {
        if (lastIndex !== null) branchStack.push(lastIndex);
      } else if (ch === ')') {
        lastIndex = branchStack.length > 0 ? branchStack.pop()! : lastIndex;
      } else {
        continue;
      }
    }

    const adjacency = nodes.map((_, idx) => Array.from(adjacencyMap.get(idx) ?? []));
    return { nodes, adjacency };
  };

  const findBestMatchForGraph = (graph: SmilesGraph, board: Cell[][]): MatchCandidate | null => {
    if (graph.nodes.length === 0) return null;
    const total = graph.nodes.length;
    const adjacency = graph.adjacency;
    let best: MatchCandidate | null = null;
    const seen = new Set<string>();
    const used = new Set<string>();
    const assignments = new Map<number, Coord>();
    const unassigned = new Set<number>();

    let rootIndex = 0;
    for (let i = 0; i < total; i++) {
      unassigned.add(i);
      if ((adjacency[i]?.length ?? 0) > (adjacency[rootIndex]?.length ?? 0)) rootIndex = i;
    }

    const getCandidatesForNode = (nodeIndex: number, neighborIndices: number[]): Coord[] => {
      let candidates: Coord[] | null = null;
      for (const neighborIndex of neighborIndices) {
        const neighborPos = assignments.get(neighborIndex);
        if (!neighborPos) continue;
        const local: Coord[] = [];
        for (const dir of directions) {
          const nx = neighborPos.x + dir.x;
          const ny = neighborPos.y + dir.y;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (board[ny]?.[nx] !== graph.nodes[nodeIndex]?.element) continue;
          local.push({ x: nx, y: ny });
        }
        if (local.length === 0) return [];
        if (candidates === null) {
          candidates = local;
        } else {
          candidates = candidates.filter((cand) =>
            local.some((loc) => loc.x === cand.x && loc.y === cand.y)
          );
          if (candidates.length === 0) return [];
        }
      }
      const deduped = (candidates ?? []).filter(
        (cand, idx, arr) => arr.findIndex((c) => c.x === cand.x && c.y === cand.y) === idx
      );
      return deduped;
    };

    const search = () => {
      if (assignments.size === total) {
        const coords = graph.nodes.map((_, idx) => ({ ...assignments.get(idx)! }));
        const candidate = createCandidate(coords);
        if (!seen.has(candidate.signature)) {
          seen.add(candidate.signature);
          best = pickBetter(best, candidate);
        }
        return;
      }

      let nextNode: number | null = null;
      let bestNeighborCount = -1;
      for (const node of Array.from(unassigned)) {
        const assignedNeighbors = adjacency[node]?.filter((n) => assignments.has(n)) ?? [];
        if (assignedNeighbors.length === 0) continue;
        if (assignedNeighbors.length > bestNeighborCount) {
          bestNeighborCount = assignedNeighbors.length;
          nextNode = node;
        }
      }
      if (nextNode == null) return;
      const assignedNeighbors = adjacency[nextNode]?.filter((n) => assignments.has(n)) ?? [];
      const candidates = getCandidatesForNode(nextNode, assignedNeighbors);
      for (const cand of candidates) {
        const key = `${cand.x},${cand.y}`;
        if (used.has(key)) continue;
        let valid = true;
        for (const neighbor of assignedNeighbors) {
          const neighborPos = assignments.get(neighbor);
          if (!neighborPos) {
            valid = false;
            break;
          }
          if (Math.abs(neighborPos.x - cand.x) + Math.abs(neighborPos.y - cand.y) !== 1) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;
        assignments.set(nextNode, cand);
        used.add(key);
        unassigned.delete(nextNode);
        search();
        unassigned.add(nextNode);
        used.delete(key);
        assignments.delete(nextNode);
      }
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (board[y]?.[x] !== graph.nodes[rootIndex]?.element) continue;
        const key = `${x},${y}`;
        assignments.set(rootIndex, { x, y });
        used.add(key);
        unassigned.delete(rootIndex);
        search();
        unassigned.add(rootIndex);
        used.delete(key);
        assignments.delete(rootIndex);
      }
    }
    return best;
  };

  const findBestTargetMatch = (): MatchCandidate | null => {
    const g = gameRef.current!;
    const graph = parseSmilesGraph(g.target.pattern);
    return findBestMatchForGraph(graph, g.board);
  };

  const boostSpeed = (clearedCount: number): boolean => {
    if (clearedCount <= 0) return false;
    const factor = Math.pow(0.9, clearedCount);
    const nextDuration = Math.max(80, tickDurationRef.current * factor);
    if (nextDuration === tickDurationRef.current) return false;
    tickDurationRef.current = nextDuration;
    setSpeedMs(nextDuration);
    return true;
  };

  const chooseRandom = (pool: Molecule[], prevName?: string): Molecule | null => {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0] ?? null;
    let candidate = pool[Math.floor(Math.random() * pool.length)] ?? null;
    if (!candidate) return null;
    let attempts = 0;
    while (candidate.name === prevName && attempts < pool.length) {
      candidate = pool[Math.floor(Math.random() * pool.length)] ?? null;
      if (!candidate) return null;
      attempts += 1;
    }
    return candidate;
  };

  const selectTarget = (clearCount: number, prevName?: string): Molecule => {
    if (customMolecules) {
      return (
        chooseRandom(customMolecules, prevName) ??
        customMolecules[0] ??
        fallbackMolecule
      );
    }

    if (clearCount < 2) {
      return (
        chooseRandom(TIER_ONE_MOLS, prevName) ??
        chooseRandom(TIER_TWO_MOLS, prevName) ??
        chooseRandom(TIER_THREE_MOLS, prevName) ??
        fallbackMolecule
      );
    }

    if (clearCount < 6) {
      const tierTwoChance = Math.min(0.85, 0.35 + (clearCount - 2) * 0.15);
      const useTierTwo = Math.random() < tierTwoChance;
      let candidate = chooseRandom(useTierTwo ? TIER_TWO_MOLS : TIER_ONE_MOLS, prevName);
      if (!candidate) {
        candidate = chooseRandom(useTierTwo ? TIER_ONE_MOLS : TIER_TWO_MOLS, prevName);
      }
      if (!candidate) {
        candidate = chooseRandom(TIER_THREE_MOLS, prevName);
      }
      return candidate ?? fallbackMolecule;
    }

    const tierThreeChance = Math.min(0.9, 0.4 + (clearCount - 6) * 0.1);
    const tierTwoChance = Math.min(0.7, 0.3 + (clearCount - 6) * 0.08);
    const roll = Math.random();
    let primaryPool: Molecule[];
    if (roll < tierThreeChance) {
      primaryPool = TIER_THREE_MOLS;
    } else if (roll < tierThreeChance + tierTwoChance) {
      primaryPool = TIER_TWO_MOLS;
    } else {
      primaryPool = TIER_ONE_MOLS;
    }

    let candidate = chooseRandom(primaryPool, prevName);
    if (!candidate) {
      candidate = chooseRandom(TIER_THREE_MOLS, prevName) ??
        chooseRandom(TIER_TWO_MOLS, prevName) ??
        chooseRandom(TIER_ONE_MOLS, prevName);
    }
    return candidate ?? fallbackMolecule;
  };

  const pickNewTarget = (): boolean => {
    const g = gameRef.current!;
    const next = selectTarget(g.score, g.target?.name);
    g.target = next;

    if (highlightTimeoutRef.current !== null || highlightKeys.length > 0) return false;

    const match = findBestTargetMatch();
    if (!match) return false;

    g.score += 1;
    const accelerated = g.score % 2 === 0 ? boostSpeed(1) : false;
    scheduleMatchClear(match);
    if (accelerated) startTickLoop();
    return true;
  };

  const openHelp = () => {
    const g = gameRef.current;
    if (g) {
      preHelpRunningRef.current = g.running || highlightTimeoutRef.current !== null;
      g.running = false;
      g.softDrop = false;
    } else {
      preHelpRunningRef.current = false;
    }
    setShowHelp(true);
  };

  const closeHelp = () => {
    setShowHelp(false);
    const g = gameRef.current;
    if (g && preHelpRunningRef.current) {
      g.running = true;
      focusGame();
    }
    preHelpRunningRef.current = false;
  };

  const clearHighlightTimeout = () => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };

  const completeMatchClear = (match: MatchCandidate) => {
    const g = gameRef.current!;
    for (const coord of match.coords) {
      if (g.board[coord.y]) {
        g.board[coord.y]![coord.x] = '.' as Cell;
      }
    }
    setHighlightKeys([]);
    applyGravity();
    const auto = pickNewTarget();
    if (!auto) {
      if (showHelp) {
        g.running = false;
        spawn();
        bump();
      } else {
        g.running = true;
        spawn();
        bump();
        focusGame();
      }
    }
  };

  const scheduleMatchClear = (match: MatchCandidate) => {
    const g = gameRef.current!;
    g.running = false;
    g.softDrop = false;
    const keys = match.coords.map((c) => `${c.x},${c.y}`);
    setHighlightKeys(keys);
    bump();
    clearHighlightTimeout();
    highlightTimeoutRef.current = window.setTimeout(() => {
      highlightTimeoutRef.current = null;
      completeMatchClear(match);
    }, 500);
  };

  const spawn = () => {
    const g = gameRef.current!;
    const x = Math.floor(width / 2);
    const y = 0;
    if (g.board[y]?.[x] !== '.') {
      gameOver('Game Over!');
      return;
    }
    g.active = { x, y, atom: randAtom() };
  };

  const lockPiece = () => {
    const g = gameRef.current!;
    if (!g.active) return;
    if (g.board[g.active.y]) {
      g.board[g.active.y]![g.active.x] = g.active.atom as Cell;
    }
    g.active = null;
    const match = findBestTargetMatch();
    if (match) {
      g.score += 1;
      const accelerated = g.score % 2 === 0 ? boostSpeed(1) : false;
      scheduleMatchClear(match);
      if (accelerated) startTickLoop();
      return;
    }
    spawn();
  };

  const hardDrop = () => {
    const g = gameRef.current!;
    if (!g.active) return;
    while (canMove(0, 1)) g.active.y++;
    lockPiece();
  };

  const gameOver = (msg: string) => {
    const g = gameRef.current!;
    g.running = false;
    if (tickId.current !== null) window.clearInterval(tickId.current);
    tickId.current = null;
    clearHighlightTimeout();
    setHighlightKeys([]);
    onEnd?.(g.score);

    if (g.score > 0 && discordUsername && discordUserId) {
      onHighScoreSubmit?.({
        username: discordUsername,
        userId: discordUserId,
        avatar: discordAvatar ?? null,
        score: g.score,
        timestamp: Date.now(),
      });
    }

    setOverlay(`${msg}  Score: ${g.score}. Click Restart or press 'R'.`);
    bump();
  };

  const moveHoriz = (dx: number) => {
    const g = gameRef.current;
    if (!g || !g.running || !g.active) return;
    if (canMove(dx, 0)) {
      g.active.x += dx;
      bump();
    }
  };

  const tapLeft = () => moveHoriz(-1);
  const tapRight = () => moveHoriz(1);

  const spawnInitialState = (running = true) => {
    gameRef.current = {
      board: emptyBoard(),
      active: null,
      score: 0,
      target: selectTarget(0),
      running,
      softDrop: false,
    };
  };

  function runTick() {
    const g = gameRef.current!;
    if (!g.running) return;
    const steps = g.softDrop ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      if (g.active && canMove(0, 1)) {
        g.active.y++;
      } else if (g.active) {
        lockPiece();
        break;
      }
    }
    bump();
  }

  function startTickLoop() {
    if (tickId.current !== null) window.clearInterval(tickId.current);
    tickId.current = window.setInterval(runTick, tickDurationRef.current);
  }

  const focusGame = () => {
    const node = containerRef.current;
    if (!node) return;
    requestAnimationFrame(() => node.focus());
  };

  const prepareForStart = () => {
    clearHighlightTimeout();
    setHighlightKeys([]);
    if (tickId.current !== null) {
      window.clearInterval(tickId.current);
      tickId.current = null;
    }
    spawnInitialState(false);
    const auto = pickNewTarget();
    if (!auto) {
      spawn();
    }
    tickDurationRef.current = tickMs;
    setSpeedMs(tickMs);
    setOverlay('Click Start to begin dropping atoms.');
    setHasStarted(false);
    bump();
  };

  const start = () => {
    setOverlay(null);
    clearHighlightTimeout();
    setHighlightKeys([]);
    spawnInitialState();
    const auto = pickNewTarget();
    if (!auto) {
      spawn();
    }
    tickDurationRef.current = tickMs;
    setSpeedMs(tickMs);
    startTickLoop();
    bump();
    setHasStarted(true);
    focusGame();
    onGameStart?.();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;

      if (showHelp) {
        if (e.key === 'h' || e.key === 'H' || e.key === 'Escape') {
          closeHelp();
        }
        return;
      }

      if (!g.running) {
        if (e.key === 'h' || e.key === 'H') {
          openHelp();
          return;
        }
        if (e.key === 'r' || e.key === 'R') {
          start();
        }
        return;
      }
      if (!g.active) return;

      if (e.key === 'h' || e.key === 'H') {
        openHelp();
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (canMove(-1, 0)) g.active.x--;
        bump();
      } else if (e.key === 'ArrowRight') {
        if (canMove(1, 0)) g.active.x++;
        bump();
      } else if (e.key === 'ArrowDown') {
        g.softDrop = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        hardDrop();
        bump();
      } else if (e.key === 'r' || e.key === 'R') {
        start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.key === 'ArrowDown') g.softDrop = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [showHelp]);

  useEffect(() => {
    prepareForStart();
    return () => {
      if (tickId.current !== null) window.clearInterval(tickId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasStarted) focusGame();
  }, [hasStarted]);

  useEffect(() => {
    if (onGameStateChange) {
      const g = gameRef.current;
      const speedRatio = speedMs > 0 ? tickMs / speedMs : 1;
      onGameStateChange({
        score: g?.score ?? 0,
        speed: speedRatio,
        target: g?.target?.name ?? '',
        targetPattern: g?.target?.pattern ?? '',
        showHint: propShowHint,
        isMobile,
      });
    }
  }, [onGameStateChange, gameRef.current?.score, speedMs, tickMs, gameRef.current?.target?.name, gameRef.current?.target?.pattern, propShowHint, isMobile]);

  useImperativeHandle(ref, () => ({
    openHelp,
  }));

  const g = gameRef.current;
  const speedRatio = speedMs > 0 ? tickMs / speedMs : 1;
  const primaryButtonLabel = hasStarted ? 'Restart' : 'Start';

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
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
      {/* Game Info Bar */}
      {isMobile && (
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            textAlign: 'center',
            background: 'linear-gradient(160deg, rgba(19,28,48,0.92), rgba(13,18,33,0.92))',
            padding: '10px 14px',
            borderRadius: 12,
            boxShadow: '0 12px 24px rgba(4,6,16,0.45), 0 0 0 1px rgba(90,120,190,0.25) inset',
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
              <code style={{ color: '#8bd3ff' }}>{g?.target?.pattern ?? '—'}</code>
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
              Speed: <b style={{ color: '#9bd5ff' }}>{speedRatio.toFixed(1)}x</b>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => {
                const newValue = !propShowHint;
                if (onGameStateChange) {
                  onGameStateChange({
                    score: g?.score ?? 0,
                    speed: speedRatio,
                    target: g?.target?.name ?? '',
                    targetPattern: g?.target?.pattern ?? '',
                    showHint: newValue,
                    isMobile,
                  });
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

      <div style={{ position: 'relative' }}>
        <pre
          aria-label="chem-ascii-board"
          style={{
            fontSize: 16,
            lineHeight: 1.0,
            background: '#12121a',
            padding: 6,
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

        {overlay && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(0,0,0,0.55)',
              borderRadius: 8,
              textAlign: 'center',
              padding: 12,
            }}
          >
            <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
              <div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{overlay}</div>
              <button
                type="button"
                onClick={() => start()}
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
              background: 'linear-gradient(160deg, rgba(18,24,40,0.95), rgba(10,14,26,0.95))',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 25px 45px rgba(0,0,0,0.55), 0 0 0 1px rgba(90,120,190,0.35) inset',
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
                <strong>Total Games Played:</strong> {totalGamesPlayed.toLocaleString()}
              </div>
            )}
            <section style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12, color: '#9fb7ff', textTransform: 'uppercase' }}>
                SMILES Basics (C &amp; O only)
              </h4>
              <p style={{ margin: '3px 0' }}>• <strong>C</strong> = carbon atom; repeating letters = single bonds in sequence.</p>
              <p style={{ margin: '3px 0' }}>• <strong>O</strong> = oxygen atom.</p>
              <p style={{ margin: '3px 0' }}>• Adjacent characters are connected by single bonds.</p>
              <p style={{ margin: '3px 0' }}>• Parentheses create branches from the previous atom.</p>
            </section>
            <section style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12, color: '#9fb7ff', textTransform: 'uppercase' }}>
                IUPAC Naming Snapshot
              </h4>
              <p style={{ margin: '3px 0' }}>• Alkanes: longest carbon chain + <em>-ane</em>.</p>
              <p style={{ margin: '3px 0' }}>• Alcohols: replace <em>-e</em> with <em>-ol</em>.</p>
              <p style={{ margin: '3px 0' }}>• Ethers: smaller side = alkoxy substituent.</p>
            </section>
            <section style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 12, color: '#9fb7ff', textTransform: 'uppercase' }}>
                Controls
              </h4>
              <p style={{ margin: '3px 0' }}>
                Arrows move, Space hard-drops, H opens/closes help, R restarts. Touch: tap left/right to move.
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
  );
});

ChemAsciiTetris.displayName = 'ChemAsciiTetris';

export default ChemAsciiTetris;
