/**
 * Standard pure rules engine for the "Da Peng You" web card game.
 *
 * Scope:
 * - Pure TypeScript module.
 * - No UI, network, database, framework, timers, or external libraries.
 * - State is a single JSON-serializable object.
 * - All transitions go through nextState(state, action).
 */

export const SUITS = ['DIAMONDS', 'CLUBS', 'HEARTS', 'SPADES'] as const;
export const RANKS = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type ComboType =
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLE'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'THREE_WITH_TWO'
  | 'FOUR_WITH_ONE'
  | 'STRAIGHT_FLUSH';

export type Combo = {
  type: ComboType;
  mainRank: Rank;
  mainSuit: Suit;
  weight: number;
  straightValue?: number;
};

export type Move = {
  type: 'PLAY_CARD' | 'PASS';
  playerId: string;
  cards: Card[];
  combo: Combo | null;
  round: number;
  sequence: number;
  actionId?: string;
};

export type PlayerStatus = 'active' | 'finished';

export type Player = {
  id: string;
  name?: string;
  hand: Card[];
  status: PlayerStatus;
  score: number;
  cardsPlayed: number;
  multiplier: number;
};

export type GameStatus = 'waiting' | 'playing' | 'finished';

export type FirstPlayRequirement = {
  kind: 'DIAMOND_FOUR' | 'MIN_CARD' | 'NONE';
  ownerId: string | null;
  cardId: string | null;
};

export type GameSettings = {
  minPlayers: number;
  maxPlayers: number;
  cardsPerPlayer: number;
};

export type TurnLock = {
  revision: number;
  currentTurn: string | null;
  lastActionId: string | null;
};

export type GameState = {
  version: 1;
  revision: number;
  turnLock: TurnLock;
  gameStatus: GameStatus;
  players: Player[];
  playerOrder: string[];
  currentTurn: string | null;
  deck: Card[];
  discardPile: Move[];
  lastMove: Move | null;
  winner: string | null;
  round: number;
  sequence: number;
  passCount: number;
  roundLeaderId: string | null;
  isFirstHand: boolean;
  firstPlayRequirement: FirstPlayRequirement;
  autoPlay: {
    enabledPlayerIds: string[];
  };
  settings: GameSettings;
  lastScoreDelta: Record<string, number> | null;
};

export type ActionMeta = {
  expectedRevision?: number;
  actionId?: string;
};

export type PlayerInput = {
  id: string;
  name?: string;
};

export type InitGameAction = ActionMeta & {
  type: 'INIT_GAME';
  players: PlayerInput[];
  deck?: Card[];
  shuffle?: boolean;
};

export type StartGameAction = ActionMeta & {
  type: 'START_GAME';
  playerId?: string;
};

export type PlayCardAction = ActionMeta & {
  type: 'PLAY_CARD';
  playerId: string;
  cards: Card[];
};

export type PassAction = ActionMeta & {
  type: 'PASS';
  playerId: string;
};

export type SwapCardsAction = ActionMeta & {
  type: 'SWAP_CARDS';
  playerId?: string;
  selectedCardIdsByPlayer: Record<string, string>;
  targetPlayerIdByCardId: Record<string, string>;
  turnOwnerId?: string;
};

export type SetAutoPlayLastCardAction = ActionMeta & {
  type: 'SET_AUTO_PLAY_LAST_CARD';
  playerId: string;
  enabled: boolean;
};

export type AutoPlayLastCardAction = ActionMeta & {
  type: 'AUTO_PLAY_LAST_CARD';
  playerId: string;
};

export type EndGameAction = ActionMeta & {
  type: 'END_GAME';
  playerId?: string;
  winner?: string | null;
  reason?: string;
};

export type GameAction =
  | InitGameAction
  | StartGameAction
  | PlayCardAction
  | PassAction
  | SwapCardsAction
  | SetAutoPlayLastCardAction
  | AutoPlayLastCardAction
  | EndGameAction;

export type EngineErrorCode =
  | 'INVALID_ACTION'
  | 'INVALID_STATE'
  | 'INVALID_PLAYER_COUNT'
  | 'DUPLICATE_PLAYER'
  | 'MISSING_TURN_LOCK'
  | 'TURN_LOCK_CONFLICT'
  | 'GAME_NOT_WAITING'
  | 'GAME_NOT_PLAYING'
  | 'GAME_ALREADY_FINISHED'
  | 'NOT_YOUR_TURN'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ACTIVE'
  | 'CARD_NOT_IN_HAND'
  | 'DUPLICATE_CARD'
  | 'INVALID_MOVE'
  | 'INVALID_COMBO'
  | 'INVALID_SWAP'
  | 'FIRST_HAND_REQUIREMENT'
  | 'CANNOT_PASS'
  | 'AUTO_PLAY_NOT_ENABLED'
  | 'NO_WINNER';

export type EngineError = {
  error: true;
  code: EngineErrorCode;
  message: string;
  state: GameState | null;
};

export type EngineResult = GameState | EngineError;

const SUIT_ORDER: Record<Suit, number> = {
  DIAMONDS: 0,
  CLUBS: 1,
  HEARTS: 2,
  SPADES: 3,
};

const RANK_ORDER: Record<Rank, number> = {
  '4': 0,
  '5': 1,
  '6': 2,
  '7': 3,
  '8': 4,
  '9': 5,
  '10': 6,
  J: 7,
  Q: 8,
  K: 9,
  A: 10,
  '2': 11,
  '3': 12,
};

const STRAIGHT_ORDER: Record<Rank, number> = {
  A: 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  '10': 9,
  J: 10,
  Q: 11,
  K: 12,
};

const COMBO_WEIGHT: Record<ComboType, number> = {
  SINGLE: 0,
  PAIR: 1,
  TRIPLE: 2,
  STRAIGHT: 3,
  FLUSH: 4,
  THREE_WITH_TWO: 5,
  FOUR_WITH_ONE: 6,
  STRAIGHT_FLUSH: 7,
};

function fail(code: EngineErrorCode, message: string, state: GameState | null): EngineError {
  return { error: true, code, message, state };
}

export function isEngineError(result: EngineResult): result is EngineError {
  return Boolean((result as EngineError).error);
}

function cloneCard(card: Card): Card {
  return { id: card.id, suit: card.suit, rank: card.rank };
}

function cloneMove(move: Move): Move {
  return {
    type: move.type,
    playerId: move.playerId,
    cards: move.cards.map(cloneCard),
    combo: move.combo ? { ...move.combo } : null,
    round: move.round,
    sequence: move.sequence,
    actionId: move.actionId,
  };
}

function cloneState(state: GameState): GameState {
  return {
    version: 1,
    revision: state.revision,
    turnLock: { ...state.turnLock },
    gameStatus: state.gameStatus,
    players: state.players.map((player) => ({
      ...player,
      hand: player.hand.map(cloneCard),
    })),
    playerOrder: [...state.playerOrder],
    currentTurn: state.currentTurn,
    deck: state.deck.map(cloneCard),
    discardPile: state.discardPile.map(cloneMove),
    lastMove: state.lastMove ? cloneMove(state.lastMove) : null,
    winner: state.winner,
    round: state.round,
    sequence: state.sequence,
    passCount: state.passCount,
    roundLeaderId: state.roundLeaderId,
    isFirstHand: state.isFirstHand,
    firstPlayRequirement: { ...state.firstPlayRequirement },
    autoPlay: { enabledPlayerIds: [...state.autoPlay.enabledPlayerIds] },
    settings: { ...state.settings },
    lastScoreDelta: state.lastScoreDelta ? { ...state.lastScoreDelta } : null,
  };
}

function commitState(state: GameState, actionId?: string): GameState {
  const next = cloneState(state);
  next.revision += 1;
  next.turnLock = {
    revision: next.revision,
    currentTurn: next.currentTurn,
    lastActionId: actionId ?? null,
  };
  return next;
}

function validateTurnLock(state: GameState, action: ActionMeta): EngineError | null {
  if (typeof action.expectedRevision !== 'number') {
    return fail('MISSING_TURN_LOCK', 'Mutating actions must include expectedRevision for optimistic turn locking.', state);
  }

  if (action.expectedRevision !== state.revision) {
    return fail(
      'TURN_LOCK_CONFLICT',
      `State revision conflict. Expected ${action.expectedRevision}, current ${state.revision}.`,
      state
    );
  }

  return null;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = deck.map(cloneCard);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

export function sortCards(cards: Card[]): Card[] {
  return cards.map(cloneCard).sort((a, b) => {
    const rankDiff = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}

function sortCardsForStraight(cards: Card[]): Card[] {
  const sorted = cards.map(cloneCard).sort((a, b) => {
    const rankDiff = STRAIGHT_ORDER[a.rank] - STRAIGHT_ORDER[b.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });

  const ranks = sorted.map((card) => card.rank);
  const isTenToAce =
    ranks.includes('10') &&
    ranks.includes('J') &&
    ranks.includes('Q') &&
    ranks.includes('K') &&
    ranks.includes('A') &&
    !ranks.includes('2');

  if (isTenToAce) {
    const aceIndex = sorted.findIndex((card) => card.rank === 'A');
    const ace = sorted.splice(aceIndex, 1)[0];
    sorted.push(ace);
  }

  return sorted;
}

function sameSuit(cards: Card[]): boolean {
  return cards.length > 0 && cards.every((card) => card.suit === cards[0].suit);
}

function countRanks(cards: Card[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) counts[card.rank] = (counts[card.rank] || 0) + 1;
  return counts;
}

function maxSuit(cards: Card[]): Suit {
  return cards.reduce((max, card) => (SUIT_ORDER[card.suit] > SUIT_ORDER[max] ? card.suit : max), cards[0].suit);
}

function maxRankCard(cards: Card[]): Card {
  return cards.reduce((max, card) => {
    const rankDiff = RANK_ORDER[card.rank] - RANK_ORDER[max.rank];
    if (rankDiff > 0) return card;
    if (rankDiff === 0 && SUIT_ORDER[card.suit] > SUIT_ORDER[max.suit]) return card;
    return max;
  }, cards[0]);
}

function uniqueRanks(cards: Card[]): Rank[] {
  return Array.from(new Set(cards.map((card) => card.rank))) as Rank[];
}

function straightInfo(cards: Card[]): { valid: boolean; value: number; highCard: Card | null } {
  if (cards.length !== 5) return { valid: false, value: -1, highCard: null };
  if (uniqueRanks(cards).length !== 5) return { valid: false, value: -1, highCard: null };

  const sorted = sortCardsForStraight(cards);
  const ranks = sorted.map((card) => card.rank);
  const joined = ranks.join(',');

  if (joined === 'A,2,3,4,5') {
    return { valid: true, value: 0, highCard: sorted[4] };
  }

  if (joined === '10,J,Q,K,A') {
    return { valid: true, value: RANK_ORDER.A, highCard: sorted[4] };
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (STRAIGHT_ORDER[sorted[i + 1].rank] - STRAIGHT_ORDER[sorted[i].rank] !== 1) {
      return { valid: false, value: -1, highCard: null };
    }
  }

  const highCard = sorted[4];
  return { valid: true, value: RANK_ORDER[highCard.rank], highCard };
}

export function classifyCards(cards: Card[]): Combo | null {
  const sorted = sortCards(cards);
  const len = sorted.length;

  if (len === 1) {
    return {
      type: 'SINGLE',
      mainRank: sorted[0].rank,
      mainSuit: sorted[0].suit,
      weight: COMBO_WEIGHT.SINGLE,
    };
  }

  if (len === 2) {
    if (sorted[0].rank !== sorted[1].rank) return null;
    return {
      type: 'PAIR',
      mainRank: sorted[0].rank,
      mainSuit: maxSuit(sorted),
      weight: COMBO_WEIGHT.PAIR,
    };
  }

  if (len === 3) {
    if (!sorted.every((card) => card.rank === sorted[0].rank)) return null;
    return {
      type: 'TRIPLE',
      mainRank: sorted[0].rank,
      mainSuit: maxSuit(sorted),
      weight: COMBO_WEIGHT.TRIPLE,
    };
  }

  if (len !== 5) return null;

  const rankCounts = countRanks(sorted);
  const countValues = Object.values(rankCounts).sort((a, b) => b - a);
  const straight = straightInfo(sorted);
  const flush = sameSuit(sorted);

  if (countValues[0] === 4 && countValues[1] === 1) {
    const quadRank = Object.keys(rankCounts).find((rank) => rankCounts[rank] === 4) as Rank;
    const quadCards = sorted.filter((card) => card.rank === quadRank);
    return {
      type: 'FOUR_WITH_ONE',
      mainRank: quadRank,
      mainSuit: maxSuit(quadCards),
      weight: COMBO_WEIGHT.FOUR_WITH_ONE,
    };
  }

  if (countValues[0] === 3 && countValues[1] === 2) {
    const tripleRank = Object.keys(rankCounts).find((rank) => rankCounts[rank] === 3) as Rank;
    const tripleCards = sorted.filter((card) => card.rank === tripleRank);
    return {
      type: 'THREE_WITH_TWO',
      mainRank: tripleRank,
      mainSuit: maxSuit(tripleCards),
      weight: COMBO_WEIGHT.THREE_WITH_TWO,
    };
  }

  if (flush && straight.valid && straight.highCard) {
    return {
      type: 'STRAIGHT_FLUSH',
      mainRank: straight.highCard.rank,
      mainSuit: straight.highCard.suit,
      weight: COMBO_WEIGHT.STRAIGHT_FLUSH,
      straightValue: straight.value,
    };
  }

  if (flush) {
    const highCard = maxRankCard(sorted);
    return {
      type: 'FLUSH',
      mainRank: highCard.rank,
      mainSuit: sorted[0].suit,
      weight: COMBO_WEIGHT.FLUSH,
    };
  }

  if (straight.valid && straight.highCard) {
    return {
      type: 'STRAIGHT',
      mainRank: straight.highCard.rank,
      mainSuit: straight.highCard.suit,
      weight: COMBO_WEIGHT.STRAIGHT,
      straightValue: straight.value,
    };
  }

  return null;
}

function isFiveCardCombo(type: ComboType): boolean {
  return type === 'STRAIGHT' || type === 'FLUSH' || type === 'THREE_WITH_TWO' || type === 'FOUR_WITH_ONE' || type === 'STRAIGHT_FLUSH';
}

function shareAtLeastOneSuit(cardsA: Card[], cardsB: Card[]): boolean {
  const suits = new Set(cardsB.map((card) => card.suit));
  return cardsA.some((card) => suits.has(card.suit));
}

export function compareMoves(moveA: Move, moveB: Move | null): number {
  if (moveA.type !== 'PLAY_CARD') return -1;
  if (!moveA.combo) return -1;
  if (!moveB || moveB.type !== 'PLAY_CARD' || !moveB.combo) return 1;

  const comboA = moveA.combo;
  const comboB = moveB.combo;

  if (isFiveCardCombo(comboA.type) && isFiveCardCombo(comboB.type)) {
    if (comboA.weight !== comboB.weight) return comboA.weight - comboB.weight;
  } else if (comboA.type !== comboB.type) {
    return -1;
  }

  if (comboA.type === 'SINGLE') {
    const cardA = moveA.cards[0];
    const cardB = moveB.cards[0];
    if (cardA.suit === cardB.suit) return RANK_ORDER[cardA.rank] - RANK_ORDER[cardB.rank];
    if (cardA.rank === cardB.rank) return SUIT_ORDER[cardA.suit] - SUIT_ORDER[cardB.suit];
    return -1;
  }

  if (comboA.type === 'PAIR' || comboA.type === 'TRIPLE') {
    if (comboA.mainRank === comboB.mainRank) {
      return SUIT_ORDER[comboA.mainSuit] - SUIT_ORDER[comboB.mainSuit];
    }
    if (RANK_ORDER[comboA.mainRank] > RANK_ORDER[comboB.mainRank] && shareAtLeastOneSuit(moveA.cards, moveB.cards)) {
      return 1;
    }
    return -1;
  }

  if (comboA.type === 'STRAIGHT' || comboA.type === 'STRAIGHT_FLUSH') {
    const valueA = comboA.straightValue ?? straightInfo(moveA.cards).value;
    const valueB = comboB.straightValue ?? straightInfo(moveB.cards).value;
    if (valueA !== valueB) return valueA - valueB;
    return SUIT_ORDER[comboA.mainSuit] - SUIT_ORDER[comboB.mainSuit];
  }

  if (comboA.type === 'FLUSH') {
    if (comboA.mainSuit !== comboB.mainSuit) return SUIT_ORDER[comboA.mainSuit] - SUIT_ORDER[comboB.mainSuit];
    return RANK_ORDER[comboA.mainRank] - RANK_ORDER[comboB.mainRank];
  }

  if (comboA.type === 'THREE_WITH_TWO' || comboA.type === 'FOUR_WITH_ONE') {
    if (comboA.mainRank !== comboB.mainRank) return RANK_ORDER[comboA.mainRank] - RANK_ORDER[comboB.mainRank];
    return SUIT_ORDER[comboA.mainSuit] - SUIT_ORDER[comboB.mainSuit];
  }

  return -1;
}

function getPlayer(state: GameState, playerId: string): Player | null {
  return state.players.find((player) => player.id === playerId) ?? null;
}

function hasDuplicateIds(cards: Card[]): boolean {
  return new Set(cards.map((card) => card.id)).size !== cards.length;
}

function resolveCardsFromHand(hand: Card[], requestedCards: Card[]): { ok: true; cards: Card[] } | { ok: false; code: EngineErrorCode; message: string } {
  if (requestedCards.length === 0) {
    return { ok: false, code: 'INVALID_MOVE', message: 'No cards selected.' };
  }

  if (hasDuplicateIds(requestedCards)) {
    return { ok: false, code: 'DUPLICATE_CARD', message: 'Duplicate card ids are not allowed.' };
  }

  const resolved: Card[] = [];
  for (const requested of requestedCards) {
    const card = hand.find((candidate) => candidate.id === requested.id);
    if (!card) {
      return { ok: false, code: 'CARD_NOT_IN_HAND', message: `Card ${requested.id} is not in the player's hand.` };
    }
    resolved.push(cloneCard(card));
  }

  return { ok: true, cards: resolved };
}

function createMove(state: GameState, type: Move['type'], playerId: string, cards: Card[] = [], actionId?: string): Move {
  const combo = type === 'PLAY_CARD' ? classifyCards(cards) : null;
  return {
    type,
    playerId,
    cards: cards.map(cloneCard),
    combo,
    round: state.round,
    sequence: state.sequence + 1,
    actionId,
  };
}

function validateBasicTurn(state: GameState, playerId: string): EngineError | null {
  if (state.gameStatus === 'finished') return fail('GAME_ALREADY_FINISHED', 'Game is already finished.', state);
  if (state.gameStatus !== 'playing') return fail('GAME_NOT_PLAYING', 'Game is not in playing status.', state);
  if (state.currentTurn !== playerId) return fail('NOT_YOUR_TURN', 'It is not this player turn.', state);

  const player = getPlayer(state, playerId);
  if (!player) return fail('PLAYER_NOT_FOUND', 'Player does not exist in this game.', state);
  if (player.status !== 'active') return fail('PLAYER_NOT_ACTIVE', 'Player is not active.', state);

  return null;
}

function validateTripleRule(state: GameState, player: Player, move: Move): EngineError | null {
  if (!move.combo || move.combo.type !== 'TRIPLE') return null;

  const isFirstLead = state.isFirstHand && !state.lastMove;
  const isFollowingTriple = Boolean(state.lastMove?.combo?.type === 'TRIPLE');
  const isFinalThreeCards = player.hand.length === 3 && move.cards.length === 3;

  if (isFirstLead || isFollowingTriple || isFinalThreeCards) return null;

  return fail('INVALID_MOVE', 'Triple can only be played as the first hand, to follow a triple, or as the player final three cards.', state);
}

function validateFirstHandRequirement(state: GameState, move: Move): EngineError | null {
  if (!state.isFirstHand || state.lastMove) return null;
  const requiredCardId = state.firstPlayRequirement.cardId;
  if (!requiredCardId) return null;
  if (move.cards.some((card) => card.id === requiredCardId)) return null;

  const label = state.firstPlayRequirement.kind === 'DIAMOND_FOUR' ? 'diamond four' : 'minimum card';
  return fail('FIRST_HAND_REQUIREMENT', `The first move must contain the ${label}.`, state);
}

function validatePlayMove(state: GameState, move: Move): EngineError | null {
  const basicError = validateBasicTurn(state, move.playerId);
  if (basicError) return basicError;

  const player = getPlayer(state, move.playerId)!;
  if (!move.combo) return fail('INVALID_COMBO', 'Selected cards do not form a valid combo.', state);

  const tripleError = validateTripleRule(state, player, move);
  if (tripleError) return tripleError;

  if (!state.lastMove) {
    return validateFirstHandRequirement(state, move);
  }

  if (compareMoves(move, state.lastMove) <= 0) {
    return fail('INVALID_MOVE', 'Move cannot beat the previous move.', state);
  }

  return null;
}

function validatePassMove(state: GameState, move: Move): EngineError | null {
  const basicError = validateBasicTurn(state, move.playerId);
  if (basicError) return basicError;

  if (!state.lastMove) {
    return fail('CANNOT_PASS', 'Cannot pass when there is no active previous move.', state);
  }

  return null;
}

export function isValidMove(state: GameState, move: Move): boolean {
  if (move.type === 'PASS') return validatePassMove(state, move) === null;
  return validatePlayMove(state, move) === null;
}

export function getNextPlayer(state: GameState, fromPlayerId: string | null = state.currentTurn): string | null {
  if (!fromPlayerId) return null;
  const activeOrder = state.playerOrder.filter((playerId) => getPlayer(state, playerId)?.status === 'active');
  if (activeOrder.length === 0) return null;

  const currentIndex = activeOrder.indexOf(fromPlayerId);
  if (currentIndex === -1) return activeOrder[0];
  return activeOrder[(currentIndex + 1) % activeOrder.length];
}

export function checkWin(state: GameState): string | null {
  const winner = state.players.find((player) => player.hand.length === 0);
  return winner?.id ?? null;
}

function calculateScoreDelta(state: GameState, winnerId: string): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const player of state.players) delta[player.id] = 0;

  for (const player of state.players) {
    if (player.id === winnerId) continue;
    const rawRemaining = player.hand.length;
    const remaining = rawRemaining === state.settings.cardsPerPlayer ? 15 : rawRemaining;
    const lost = remaining * Math.max(1, player.multiplier || 1);
    delta[player.id] -= lost;
    delta[winnerId] += lost;
  }

  return delta;
}

function removeCardsFromHand(hand: Card[], cardsToRemove: Card[]): Card[] {
  const ids = new Set(cardsToRemove.map((card) => card.id));
  return hand.filter((card) => !ids.has(card.id)).map(cloneCard);
}

export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  next.sequence = move.sequence;
  next.discardPile = [...next.discardPile, cloneMove(move)];

  if (move.type === 'PASS') {
    next.passCount += 1;

    const activeCount = next.players.filter((player) => player.status === 'active').length;
    const everyoneElsePassed = next.passCount >= activeCount - 1;

    if (everyoneElsePassed) {
      const leaderId = next.roundLeaderId ?? next.lastMove?.playerId ?? move.playerId;
      next.currentTurn = leaderId;
      next.lastMove = null;
      next.passCount = 0;
      next.round += 1;
      next.roundLeaderId = leaderId;
    } else {
      next.currentTurn = getNextPlayer(next, move.playerId);
    }

    return next;
  }

  next.players = next.players.map((player) => {
    if (player.id !== move.playerId) return player;
    const newHand = sortCards(removeCardsFromHand(player.hand, move.cards));
    return {
      ...player,
      hand: newHand,
      cardsPlayed: player.cardsPlayed + move.cards.length,
    };
  });

  next.lastMove = cloneMove(move);
  next.roundLeaderId = move.playerId;
  next.passCount = 0;
  next.isFirstHand = false;

  const winnerId = checkWin(next);
  if (winnerId) {
    next.winner = winnerId;
    next.gameStatus = 'finished';
    next.currentTurn = null;
    next.lastScoreDelta = calculateScoreDelta(next, winnerId);
    next.players = next.players.map((player) => {
      const scoreDelta = next.lastScoreDelta?.[player.id] ?? 0;
      return {
        ...player,
        status: player.id === winnerId ? 'finished' : player.status,
        score: player.score + scoreDelta,
      };
    });
    return next;
  }

  next.currentTurn = getNextPlayer(next, move.playerId);
  return next;
}

function validatePlayers(players: PlayerInput[]): EngineError | null {
  if (players.length < 2 || players.length > 4) {
    return fail('INVALID_PLAYER_COUNT', 'Game requires 2 to 4 players.', null);
  }

  const uniqueIds = new Set(players.map((player) => player.id));
  if (uniqueIds.size !== players.length) {
    return fail('DUPLICATE_PLAYER', 'Player ids must be unique.', null);
  }

  return null;
}

function findDiamondFourOwner(players: Player[]): { ownerId: string; cardId: string } | null {
  for (const player of players) {
    const card = player.hand.find((candidate) => candidate.suit === 'DIAMONDS' && candidate.rank === '4');
    if (card) return { ownerId: player.id, cardId: card.id };
  }
  return null;
}

function minCard(cards: Card[]): Card | null {
  if (cards.length === 0) return null;
  return cards.reduce((min, card) => {
    const rankDiff = RANK_ORDER[card.rank] - RANK_ORDER[min.rank];
    if (rankDiff < 0) return card;
    if (rankDiff === 0 && SUIT_ORDER[card.suit] < SUIT_ORDER[min.suit]) return card;
    return min;
  }, cards[0]);
}

function findMinCardOwner(players: Player[]): { ownerId: string; cardId: string } | null {
  let best: { ownerId: string; card: Card } | null = null;

  for (const player of players) {
    const candidate = minCard(player.hand);
    if (!candidate) continue;

    if (!best) {
      best = { ownerId: player.id, card: candidate };
      continue;
    }

    const rankDiff = RANK_ORDER[candidate.rank] - RANK_ORDER[best.card.rank];
    const suitDiff = SUIT_ORDER[candidate.suit] - SUIT_ORDER[best.card.suit];
    if (rankDiff < 0 || (rankDiff === 0 && suitDiff < 0)) {
      best = { ownerId: player.id, card: candidate };
    }
  }

  return best ? { ownerId: best.ownerId, cardId: best.card.id } : null;
}

function applyFirstTurnOwnerAfterSwap(state: GameState, turnOwnerId?: string): GameState {
  const next = cloneState(state);

  if (turnOwnerId) {
    const owner = getPlayer(next, turnOwnerId);
    if (owner) {
      next.currentTurn = owner.id;
      next.roundLeaderId = owner.id;
      next.firstPlayRequirement = {
        kind: 'NONE',
        ownerId: owner.id,
        cardId: null,
      };
      return next;
    }
  }

  const minOwner = findMinCardOwner(next.players);
  next.currentTurn = minOwner?.ownerId ?? next.currentTurn;
  next.roundLeaderId = minOwner?.ownerId ?? next.roundLeaderId;
  next.firstPlayRequirement = {
    kind: minOwner ? 'MIN_CARD' : 'NONE',
    ownerId: minOwner?.ownerId ?? null,
    cardId: minOwner?.cardId ?? null,
  };
  return next;
}

function applySwapCards(state: GameState, action: SwapCardsAction): EngineResult {
  if (state.gameStatus === 'finished') {
    return fail('GAME_ALREADY_FINISHED', 'Cannot swap cards after the game is finished.', state);
  }

  if (!state.isFirstHand || state.lastMove || state.discardPile.length > 0) {
    return fail('INVALID_SWAP', 'Card swapping is only allowed before the first move.', state);
  }

  const activePlayers = state.players.filter((player) => player.status === 'active');
  const activeIds = activePlayers.map((player) => player.id);
  const selectedEntries = Object.entries(action.selectedCardIdsByPlayer);

  if (action.turnOwnerId && !activeIds.includes(action.turnOwnerId)) {
    return fail('INVALID_SWAP', 'turnOwnerId must be an active player when provided.', state);
  }

  if (selectedEntries.length !== activePlayers.length) {
    return fail('INVALID_SWAP', 'Each active player must select exactly one card to swap.', state);
  }

  for (const playerId of activeIds) {
    if (!action.selectedCardIdsByPlayer[playerId]) {
      return fail('INVALID_SWAP', `Player ${playerId} has not selected a swap card.`, state);
    }
  }

  const selectedCardIds = selectedEntries.map(([, cardId]) => cardId);
  if (new Set(selectedCardIds).size !== selectedCardIds.length) {
    return fail('INVALID_SWAP', 'Selected swap cards must be unique.', state);
  }

  const targetCounts: Record<string, number> = {};
  for (const cardId of selectedCardIds) {
    const targetPlayerId = action.targetPlayerIdByCardId[cardId];
    if (!targetPlayerId || !activeIds.includes(targetPlayerId)) {
      return fail('INVALID_SWAP', `Swap card ${cardId} has an invalid target player.`, state);
    }
    targetCounts[targetPlayerId] = (targetCounts[targetPlayerId] || 0) + 1;
  }

  for (const playerId of activeIds) {
    if (targetCounts[playerId] !== 1) {
      return fail('INVALID_SWAP', 'Each active player must receive exactly one swapped card.', state);
    }
  }

  const cardsById: Record<string, Card> = {};
  for (const [playerId, cardId] of selectedEntries) {
    const player = getPlayer(state, playerId);
    if (!player) return fail('PLAYER_NOT_FOUND', `Player ${playerId} does not exist.`, state);
    const card = player.hand.find((candidate) => candidate.id === cardId);
    if (!card) return fail('CARD_NOT_IN_HAND', `Card ${cardId} is not in player ${playerId}'s hand.`, state);
    cardsById[cardId] = cloneCard(card);
  }

  const next = cloneState(state);
  const selectedSet = new Set(selectedCardIds);

  next.players = next.players.map((player) => {
    if (player.status !== 'active') return player;
    const keptHand = player.hand.filter((card) => !selectedSet.has(card.id)).map(cloneCard);
    const received = selectedCardIds
      .filter((cardId) => action.targetPlayerIdByCardId[cardId] === player.id)
      .map((cardId) => cloneCard(cardsById[cardId]));

    return {
      ...player,
      hand: sortCards([...keptHand, ...received]),
    };
  });

  return applyFirstTurnOwnerAfterSwap(next, action.turnOwnerId);
}

function setAutoPlayLastCard(state: GameState, action: SetAutoPlayLastCardAction): EngineResult {
  if (state.gameStatus === 'finished') {
    return fail('GAME_ALREADY_FINISHED', 'Cannot change auto play after the game is finished.', state);
  }

  const player = getPlayer(state, action.playerId);
  if (!player) return fail('PLAYER_NOT_FOUND', 'Player does not exist in this game.', state);

  if (action.enabled && player.hand.length !== 1) {
    return fail('INVALID_MOVE', 'Auto play can only be enabled when the player has exactly one card left.', state);
  }

  const enabled = new Set(state.autoPlay.enabledPlayerIds);
  if (action.enabled) enabled.add(action.playerId);
  else enabled.delete(action.playerId);

  const next = cloneState(state);
  next.autoPlay = { enabledPlayerIds: Array.from(enabled) };
  return next;
}

export function getAutoPlayAction(state: GameState): AutoPlayLastCardAction | null {
  const playerId = state.currentTurn;
  if (!playerId) return null;
  const player = getPlayer(state, playerId);
  if (!player) return null;
  if (player.hand.length !== 1) return null;
  if (!state.autoPlay.enabledPlayerIds.includes(playerId)) return null;
  return {
    type: 'AUTO_PLAY_LAST_CARD',
    playerId,
    expectedRevision: state.revision,
  };
}

function applyAutoPlayLastCard(state: GameState, action: AutoPlayLastCardAction): EngineResult {
  const player = getPlayer(state, action.playerId);
  if (!player) return fail('PLAYER_NOT_FOUND', 'Player does not exist in this game.', state);
  if (!state.autoPlay.enabledPlayerIds.includes(action.playerId)) {
    return fail('AUTO_PLAY_NOT_ENABLED', 'This player has not enabled last-card auto play.', state);
  }
  if (player.hand.length !== 1) {
    return fail('INVALID_MOVE', 'Last-card auto play requires exactly one card in hand.', state);
  }

  const playMove = createMove(state, 'PLAY_CARD', action.playerId, [player.hand[0]], action.actionId);
  const playError = validatePlayMove(state, playMove);
  if (!playError) return applyMove(state, playMove);

  const passMove = createMove(state, 'PASS', action.playerId, [], action.actionId);
  const passError = validatePassMove(state, passMove);
  if (!passError) return applyMove(state, passMove);

  return playError;
}

export function createInitialState(players: PlayerInput[], options: { deck?: Card[]; shuffle?: boolean } = {}): GameState {
  const settings: GameSettings = {
    minPlayers: 2,
    maxPlayers: 4,
    cardsPerPlayer: 13,
  };

  const sourceDeck = options.deck ? options.deck.map(cloneCard) : createDeck();
  const shuffledDeck = options.shuffle === false ? sourceDeck : shuffleDeck(sourceDeck);

  const normalizedPlayers: Player[] = players.map((player) => ({
    id: player.id,
    name: player.name,
    hand: [],
    status: 'active',
    score: 0,
    cardsPlayed: 0,
    multiplier: 1,
  }));

  let deckIndex = 0;
  for (let cardIndex = 0; cardIndex < settings.cardsPerPlayer; cardIndex += 1) {
    for (let playerIndex = 0; playerIndex < normalizedPlayers.length; playerIndex += 1) {
      if (deckIndex < shuffledDeck.length) {
        normalizedPlayers[playerIndex].hand.push(cloneCard(shuffledDeck[deckIndex]));
        deckIndex += 1;
      }
    }
  }

  const dealtPlayers = normalizedPlayers.map((player) => ({
    ...player,
    hand: sortCards(player.hand),
  }));

  const diamondFour = findDiamondFourOwner(dealtPlayers);
  const minOwner = diamondFour ? null : findMinCardOwner(dealtPlayers);
  const firstOwner = diamondFour ?? minOwner;

  return {
    version: 1,
    revision: 0,
    turnLock: {
      revision: 0,
      currentTurn: firstOwner?.ownerId ?? dealtPlayers[0]?.id ?? null,
      lastActionId: null,
    },
    gameStatus: 'waiting',
    players: dealtPlayers,
    playerOrder: dealtPlayers.map((player) => player.id),
    currentTurn: firstOwner?.ownerId ?? dealtPlayers[0]?.id ?? null,
    deck: shuffledDeck.slice(deckIndex).map(cloneCard),
    discardPile: [],
    lastMove: null,
    winner: null,
    round: 1,
    sequence: 0,
    passCount: 0,
    roundLeaderId: firstOwner?.ownerId ?? dealtPlayers[0]?.id ?? null,
    isFirstHand: true,
    firstPlayRequirement: {
      kind: diamondFour ? 'DIAMOND_FOUR' : minOwner ? 'MIN_CARD' : 'NONE',
      ownerId: firstOwner?.ownerId ?? null,
      cardId: firstOwner?.cardId ?? null,
    },
    autoPlay: {
      enabledPlayerIds: [],
    },
    settings,
    lastScoreDelta: null,
  };
}

function startGame(state: GameState): EngineResult {
  if (state.gameStatus !== 'waiting') {
    return fail('GAME_NOT_WAITING', 'Only a waiting game can be started.', state);
  }

  if (state.players.length < state.settings.minPlayers || state.players.length > state.settings.maxPlayers) {
    return fail('INVALID_PLAYER_COUNT', 'Game requires 2 to 4 players.', state);
  }

  if (!state.currentTurn) {
    return fail('INVALID_STATE', 'Cannot start without a current turn.', state);
  }

  const next = cloneState(state);
  next.gameStatus = 'playing';
  return next;
}

function endGame(state: GameState, winner: string | null = state.winner): EngineResult {
  if (!winner) return fail('NO_WINNER', 'Cannot end game without a winner.', state);
  if (!getPlayer(state, winner)) return fail('PLAYER_NOT_FOUND', 'Winner does not exist in this game.', state);

  const next = cloneState(state);
  next.gameStatus = 'finished';
  next.winner = winner;
  next.currentTurn = null;
  if (!next.lastScoreDelta) {
    next.lastScoreDelta = calculateScoreDelta(next, winner);
  }
  return next;
}

export function nextState(state: GameState | null, action: GameAction): EngineResult {
  if (!action || typeof action.type !== 'string') {
    return fail('INVALID_ACTION', 'Action type is required.', state);
  }

  if (action.type === 'INIT_GAME') {
    const validationError = validatePlayers(action.players);
    if (validationError) return { ...validationError, state };
    return createInitialState(action.players, { deck: action.deck, shuffle: action.shuffle });
  }

  if (!state) {
    return fail('INVALID_STATE', 'State is required for this action.', null);
  }

  const lockError = validateTurnLock(state, action);
  if (lockError) return lockError;

  if (action.type === 'START_GAME') {
    const result = startGame(state);
    return isEngineError(result) ? result : commitState(result, action.actionId);
  }

  if (action.type === 'END_GAME') {
    const result = endGame(state, action.winner ?? state.winner);
    return isEngineError(result) ? result : commitState(result, action.actionId);
  }

  if (action.type === 'SWAP_CARDS') {
    const result = applySwapCards(state, action);
    return isEngineError(result) ? result : commitState(result, action.actionId);
  }

  if (action.type === 'SET_AUTO_PLAY_LAST_CARD') {
    const result = setAutoPlayLastCard(state, action);
    return isEngineError(result) ? result : commitState(result, action.actionId);
  }

  if (action.type === 'AUTO_PLAY_LAST_CARD') {
    const result = applyAutoPlayLastCard(state, action);
    return isEngineError(result) ? result : commitState(result, action.actionId);
  }

  if (action.type === 'PASS') {
    const move = createMove(state, 'PASS', action.playerId, [], action.actionId);
    const validationError = validatePassMove(state, move);
    if (validationError) return validationError;
    return commitState(applyMove(state, move), action.actionId);
  }

  if (action.type === 'PLAY_CARD') {
    const player = getPlayer(state, action.playerId);
    if (!player) return fail('PLAYER_NOT_FOUND', 'Player does not exist in this game.', state);

    const resolved = resolveCardsFromHand(player.hand, action.cards);
    if (!resolved.ok) return fail(resolved.code, resolved.message, state);

    const move = createMove(state, 'PLAY_CARD', action.playerId, resolved.cards, action.actionId);
    const validationError = validatePlayMove(state, move);
    if (validationError) return validationError;
    return commitState(applyMove(state, move), action.actionId);
  }

  return fail('INVALID_ACTION', `Unsupported action type: ${(action as { type: string }).type}`, state);
}

export const __engineInternals = {
  SUIT_ORDER,
  RANK_ORDER,
  STRAIGHT_ORDER,
  COMBO_WEIGHT,
};
