import {
  nextState,
  isEngineError,
} from './STANDARD_RULE_ENGINE.ts';

const suits = ['DIAMONDS', 'CLUBS', 'HEARTS', 'SPADES'];

function c(suit, rank) {
  return { id: `${suit}-${rank}`, suit, rank };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function player(id, hand, extra = {}) {
  return {
    id,
    name: id,
    hand: clone(hand),
    status: 'active',
    score: 0,
    cardsPlayed: 0,
    multiplier: 1,
    ...extra,
  };
}

function state(overrides = {}) {
  const players = overrides.players ?? [
    player('A', [c('DIAMONDS', '4'), c('DIAMONDS', '5')]),
    player('B', [c('DIAMONDS', '6'), c('CLUBS', '6')]),
    player('C', [c('HEARTS', '7')]),
  ];
  const currentTurn = overrides.currentTurn ?? players[0].id;
  const revision = overrides.revision ?? 0;
  return {
    version: 1,
    revision,
    turnLock: {
      revision,
      currentTurn,
      lastActionId: null,
      ...(overrides.turnLock ?? {}),
    },
    gameStatus: overrides.gameStatus ?? 'playing',
    players,
    playerOrder: overrides.playerOrder ?? players.map((p) => p.id),
    currentTurn,
    deck: overrides.deck ?? [],
    discardPile: overrides.discardPile ?? [],
    lastMove: overrides.lastMove ?? null,
    winner: overrides.winner ?? null,
    round: overrides.round ?? 1,
    sequence: overrides.sequence ?? 0,
    passCount: overrides.passCount ?? 0,
    roundLeaderId: overrides.roundLeaderId ?? currentTurn,
    isFirstHand: overrides.isFirstHand ?? false,
    firstPlayRequirement: overrides.firstPlayRequirement ?? {
      kind: 'NONE',
      ownerId: null,
      cardId: null,
    },
    autoPlay: overrides.autoPlay ?? { enabledPlayerIds: [] },
    settings: overrides.settings ?? {
      minPlayers: 2,
      maxPlayers: 4,
      cardsPerPlayer: 13,
    },
    lastScoreDelta: overrides.lastScoreDelta ?? null,
  };
}

function move(playerId, cards, round = 1, sequence = 0) {
  return {
    type: 'PLAY_CARD',
    playerId,
    cards: clone(cards),
    combo: null,
    round,
    sequence,
  };
}

function pick(result, spec) {
  if (spec.error) {
    return {
      error: isEngineError(result),
      code: isEngineError(result) ? result.code : null,
      stateUnchanged: isEngineError(result) ? deepEqual(result.state, spec.originalState) : false,
    };
  }

  if (isEngineError(result)) {
    return { error: true, code: result.code };
  }

  const out = {};
  for (const key of Object.keys(spec)) {
    if (key === 'playerHands') {
      out.playerHands = Object.fromEntries(
        result.players.map((p) => [p.id, p.hand.map((card) => card.id)])
      );
    } else if (key === 'lastMoveCards') {
      out.lastMoveCards = result.lastMove ? result.lastMove.cards.map((card) => card.id) : null;
    } else if (key === 'lastMovePlayer') {
      out.lastMovePlayer = result.lastMove?.playerId ?? null;
    } else if (key === 'discardTypes') {
      out.discardTypes = result.discardPile.map((item) => item.type);
    } else if (key === 'scoreDeltaKeys') {
      out.scoreDeltaKeys = result.lastScoreDelta ? Object.keys(result.lastScoreDelta).sort() : null;
    } else if (key === 'autoPlayEnabled') {
      out.autoPlayEnabled = [...result.autoPlay.enabledPlayerIds].sort();
    } else {
      out[key] = result[key];
    }
  }
  return out;
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function errorExpected(code, originalState) {
  return { error: true, code, stateUnchanged: true, originalState };
}

const tests = [];

function add(name, initialState, action, expected) {
  tests.push({ name, initialState, action, expected });
}

// 1. Legal first hand with required diamond four.
{
  const s = state({
    isFirstHand: true,
    firstPlayRequirement: { kind: 'DIAMOND_FOUR', ownerId: 'A', cardId: 'DIAMONDS-4' },
    players: [
      player('A', [c('DIAMONDS', '4'), c('CLUBS', '9')]),
      player('B', [c('DIAMONDS', '5')]),
    ],
    currentTurn: 'A',
  });
  add('合法第一手：包含方块4', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('DIAMONDS', '4')],
    expectedRevision: s.revision,
  }, {
    currentTurn: 'B',
    isFirstHand: false,
    lastMovePlayer: 'A',
    lastMoveCards: ['DIAMONDS-4'],
    playerHands: { A: ['CLUBS-9'], B: ['DIAMONDS-5'] },
  });
}

// 2. Illegal first hand missing diamond four.
{
  const s = state({
    isFirstHand: true,
    firstPlayRequirement: { kind: 'DIAMOND_FOUR', ownerId: 'A', cardId: 'DIAMONDS-4' },
    players: [
      player('A', [c('DIAMONDS', '4'), c('CLUBS', '9')]),
      player('B', [c('DIAMONDS', '5')]),
    ],
    currentTurn: 'A',
  });
  add('非法第一手：未包含方块4', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('CLUBS', '9')],
    expectedRevision: s.revision,
  }, errorExpected('FIRST_HAND_REQUIREMENT', s));
}

// 3. Non-current player.
{
  const s = state({ currentTurn: 'A' });
  add('非法：非当前玩家出牌', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards: [c('DIAMONDS', '6')],
    expectedRevision: s.revision,
  }, errorExpected('NOT_YOUR_TURN', s));
}

// 4. Legal same-suit single follow.
{
  const last = move('A', [c('DIAMONDS', '4')]);
  last.combo = { type: 'SINGLE', mainRank: '4', mainSuit: 'DIAMONDS', weight: 0 };
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    roundLeaderId: 'A',
    players: [
      player('A', [c('CLUBS', '9')]),
      player('B', [c('DIAMONDS', '5'), c('SPADES', '8')]),
    ],
  });
  add('合法单牌：同花色点数更大', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards: [c('DIAMONDS', '5')],
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    lastMovePlayer: 'B',
    lastMoveCards: ['DIAMONDS-5'],
    passCount: 0,
  });
}

// 5. Legal same-rank higher suit single.
{
  const last = move('A', [c('CLUBS', '8')]);
  last.combo = { type: 'SINGLE', mainRank: '8', mainSuit: 'CLUBS', weight: 0 };
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [c('HEARTS', '8'), c('SPADES', '3')]),
    ],
  });
  add('合法单牌：同点数更大花色转花', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards: [c('HEARTS', '8')],
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    lastMovePlayer: 'B',
    lastMoveCards: ['HEARTS-8'],
  });
}

// 6. Illegal single different rank and suit.
{
  const last = move('A', [c('HEARTS', '5')]);
  last.combo = { type: 'SINGLE', mainRank: '5', mainSuit: 'HEARTS', weight: 0 };
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [c('CLUBS', '6')]),
    ],
  });
  add('非法单牌：不同花色且不同点数', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards: [c('CLUBS', '6')],
    expectedRevision: s.revision,
  }, errorExpected('INVALID_MOVE', s));
}

// 7. Legal pair follow with higher rank and common suit.
{
  const last = move('A', [c('DIAMONDS', '5'), c('CLUBS', '5')]);
  last.combo = { type: 'PAIR', mainRank: '5', mainSuit: 'CLUBS', weight: 1 };
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [c('CLUBS', '6'), c('HEARTS', '6'), c('SPADES', '3')]),
    ],
  });
  add('合法对子：更大点数且包含上家花色', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards: [c('CLUBS', '6'), c('HEARTS', '6')],
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    lastMovePlayer: 'B',
    lastMoveCards: ['CLUBS-6', 'HEARTS-6'],
  });
}

// 8. Illegal pair follow with higher rank but no common suit.
{
  const last = move('A', [c('DIAMONDS', '5'), c('CLUBS', '5')]);
  last.combo = { type: 'PAIR', mainRank: '5', mainSuit: 'CLUBS', weight: 1 };
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [c('HEARTS', '6'), c('SPADES', '6')]),
    ],
  });
  add('非法对子：更大点数但无共同花色', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards: [c('HEARTS', '6'), c('SPADES', '6')],
    expectedRevision: s.revision,
  }, errorExpected('INVALID_MOVE', s));
}

// 9. Legal straight beats lower straight.
{
  const lastCards = [c('DIAMONDS', 'A'), c('CLUBS', '2'), c('HEARTS', '3'), c('SPADES', '4'), c('DIAMONDS', '5')];
  const last = move('A', lastCards);
  last.combo = { type: 'STRAIGHT', mainRank: '5', mainSuit: 'DIAMONDS', weight: 3, straightValue: 0 };
  const cards = [c('DIAMONDS', '2'), c('CLUBS', '3'), c('HEARTS', '4'), c('SPADES', '5'), c('DIAMONDS', '6')];
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('CLUBS', '9')]),
      player('B', [...cards, c('SPADES', '3')]),
    ],
  });
  add('合法顺子：23456 压 A2345', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards,
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    lastMovePlayer: 'B',
    lastMoveCards: cards.map((card) => card.id),
  });
}

// 10. Legal higher five-card type flush beats straight.
{
  const lastCards = [c('DIAMONDS', '2'), c('CLUBS', '3'), c('HEARTS', '4'), c('SPADES', '5'), c('DIAMONDS', '6')];
  const last = move('A', lastCards);
  last.combo = { type: 'STRAIGHT', mainRank: '6', mainSuit: 'DIAMONDS', weight: 3, straightValue: 2 };
  const cards = [c('CLUBS', '4'), c('CLUBS', '7'), c('CLUBS', '9'), c('CLUBS', 'J'), c('CLUBS', 'A')];
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [...cards, c('SPADES', '3')]),
    ],
  });
  add('合法五张牌型压制：同花压顺子', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards,
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    lastMovePlayer: 'B',
    lastMoveCards: cards.map((card) => card.id),
  });
}

// 11. Illegal lower five-card type straight cannot beat flush.
{
  const lastCards = [c('CLUBS', '4'), c('CLUBS', '7'), c('CLUBS', '9'), c('CLUBS', 'J'), c('CLUBS', 'A')];
  const last = move('A', lastCards);
  last.combo = { type: 'FLUSH', mainRank: 'A', mainSuit: 'CLUBS', weight: 4 };
  const cards = [c('DIAMONDS', '2'), c('CLUBS', '3'), c('HEARTS', '4'), c('SPADES', '5'), c('DIAMONDS', '6')];
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', cards),
    ],
  });
  add('非法五张牌型压制：顺子不能压同花', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards,
    expectedRevision: s.revision,
  }, errorExpected('INVALID_MOVE', s));
}

// 12. Maximum straight flush beats four with one.
{
  const lastCards = [c('DIAMONDS', '9'), c('CLUBS', '9'), c('HEARTS', '9'), c('SPADES', '9'), c('DIAMONDS', '4')];
  const last = move('A', lastCards);
  last.combo = { type: 'FOUR_WITH_ONE', mainRank: '9', mainSuit: 'SPADES', weight: 6 };
  const cards = [c('SPADES', '10'), c('SPADES', 'J'), c('SPADES', 'Q'), c('SPADES', 'K'), c('SPADES', 'A')];
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    players: [
      player('A', [c('DIAMONDS', '5')]),
      player('B', [...cards, c('DIAMONDS', '3')]),
    ],
  });
  add('合法最大牌型：黑桃10JQKA同花顺压四带一', s, {
    type: 'PLAY_CARD',
    playerId: 'B',
    cards,
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    lastMovePlayer: 'B',
    lastMoveCards: cards.map((card) => card.id),
  });
}

// 13. Illegal invalid combo.
{
  const s = state({
    currentTurn: 'A',
    players: [
      player('A', [c('DIAMONDS', '4'), c('CLUBS', '5')]),
      player('B', [c('DIAMONDS', '6')]),
    ],
  });
  add('非法牌型：两张不同点数', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('DIAMONDS', '4'), c('CLUBS', '5')],
    expectedRevision: s.revision,
  }, errorExpected('INVALID_COMBO', s));
}

// 14. PASS after previous move.
{
  const last = move('A', [c('DIAMONDS', '4')]);
  last.combo = { type: 'SINGLE', mainRank: '4', mainSuit: 'DIAMONDS', weight: 0 };
  const s = state({
    currentTurn: 'B',
    lastMove: last,
    roundLeaderId: 'A',
    players: [
      player('A', [c('CLUBS', '9')]),
      player('B', [c('CLUBS', '6')]),
      player('C', [c('HEARTS', '7')]),
    ],
  });
  add('合法PASS：已有上一手', s, {
    type: 'PASS',
    playerId: 'B',
    expectedRevision: s.revision,
  }, {
    currentTurn: 'C',
    passCount: 1,
    lastMovePlayer: 'A',
    discardTypes: ['PASS'],
  });
}

// 15. Illegal PASS with no previous move.
{
  const s = state({ currentTurn: 'A', lastMove: null });
  add('非法PASS：无上一手不能过', s, {
    type: 'PASS',
    playerId: 'A',
    expectedRevision: s.revision,
  }, errorExpected('CANNOT_PASS', s));
}

// 16. Continuous PASS starts new round.
{
  const last = move('A', [c('DIAMONDS', '4')]);
  last.combo = { type: 'SINGLE', mainRank: '4', mainSuit: 'DIAMONDS', weight: 0 };
  const firstPass = move('B', [], 1, 1);
  firstPass.type = 'PASS';
  const s = state({
    currentTurn: 'C',
    lastMove: last,
    roundLeaderId: 'A',
    passCount: 1,
    discardPile: [firstPass],
    players: [
      player('A', [c('CLUBS', '9')]),
      player('B', [c('CLUBS', '6')]),
      player('C', [c('HEARTS', '7')]),
    ],
  });
  add('连续PASS：其他玩家都过后新一轮开始', s, {
    type: 'PASS',
    playerId: 'C',
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    passCount: 0,
    lastMoveCards: null,
    round: 2,
    discardTypes: ['PASS', 'PASS'],
  });
}

// 17. Win when hand becomes empty.
{
  const s = state({
    currentTurn: 'A',
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [c('DIAMONDS', '5'), c('CLUBS', '8')]),
    ],
    lastMove: null,
  });
  add('胜利判断：出完最后一张', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('DIAMONDS', '4')],
    expectedRevision: s.revision,
  }, {
    gameStatus: 'finished',
    currentTurn: null,
    winner: 'A',
    scoreDeltaKeys: ['A', 'B'],
    playerHands: { A: [], B: ['DIAMONDS-5', 'CLUBS-8'] },
  });
}

// 18. Empty hand active player cannot play selected card.
{
  const s = state({
    currentTurn: 'A',
    players: [
      player('A', []),
      player('B', [c('DIAMONDS', '5')]),
    ],
  });
  add('边界：空手牌玩家不能出不存在的牌', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('DIAMONDS', '4')],
    expectedRevision: s.revision,
  }, errorExpected('CARD_NOT_IN_HAND', s));
}

// 19. Duplicate card ids in action.
{
  const s = state({
    currentTurn: 'A',
    players: [
      player('A', [c('DIAMONDS', '4'), c('CLUBS', '4')]),
      player('B', [c('DIAMONDS', '5')]),
    ],
  });
  add('边界：action 内重复牌ID', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('DIAMONDS', '4'), c('DIAMONDS', '4')],
    expectedRevision: s.revision,
  }, errorExpected('DUPLICATE_CARD', s));
}

// 20. Turn lock conflict.
{
  const s = state({ revision: 5, currentTurn: 'A' });
  add('回合锁：expectedRevision 过期', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('DIAMONDS', '4')],
    expectedRevision: 4,
  }, errorExpected('TURN_LOCK_CONFLICT', s));
}

// 21. Missing turn lock.
{
  const s = state({ currentTurn: 'A' });
  add('回合锁：缺少 expectedRevision', s, {
    type: 'PLAY_CARD',
    playerId: 'A',
    cards: [c('DIAMONDS', '4')],
  }, errorExpected('MISSING_TURN_LOCK', s));
}

// 22. Swap transfers smallest-card turn owner.
{
  const s = state({
    gameStatus: 'waiting',
    isFirstHand: true,
    currentTurn: 'A',
    lastMove: null,
    discardPile: [],
    players: [
      player('A', [c('DIAMONDS', '4'), c('SPADES', 'K')]),
      player('B', [c('CLUBS', '7'), c('HEARTS', '9')]),
      player('C', [c('SPADES', 'A'), c('DIAMONDS', '10')]),
    ],
    firstPlayRequirement: { kind: 'DIAMOND_FOUR', ownerId: 'A', cardId: 'DIAMONDS-4' },
  });
  add('换牌：全场最小牌换走后出牌权跟随', s, {
    type: 'SWAP_CARDS',
    expectedRevision: s.revision,
    selectedCardIdsByPlayer: {
      A: 'DIAMONDS-4',
      B: 'CLUBS-7',
      C: 'SPADES-A',
    },
    targetPlayerIdByCardId: {
      'DIAMONDS-4': 'B',
      'CLUBS-7': 'C',
      'SPADES-A': 'A',
    },
  }, {
    currentTurn: 'B',
    roundLeaderId: 'B',
    firstPlayRequirement: { kind: 'MIN_CARD', ownerId: 'B', cardId: 'DIAMONDS-4' },
    playerHands: {
      A: ['SPADES-K', 'SPADES-A'],
      B: ['DIAMONDS-4', 'HEARTS-9'],
      C: ['CLUBS-7', 'DIAMONDS-10'],
    },
  });
}

// 23. Auto play can be enabled with one card.
{
  const s = state({
    currentTurn: 'A',
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [c('DIAMONDS', '5')]),
    ],
  });
  add('托管：只剩一张可开启最后一张托管', s, {
    type: 'SET_AUTO_PLAY_LAST_CARD',
    playerId: 'A',
    enabled: true,
    expectedRevision: s.revision,
  }, {
    currentTurn: 'A',
    autoPlayEnabled: ['A'],
  });
}

// 24. Auto play rejects when player has more than one card.
{
  const s = state({
    currentTurn: 'A',
    players: [
      player('A', [c('DIAMONDS', '4'), c('CLUBS', '4')]),
      player('B', [c('DIAMONDS', '5')]),
    ],
  });
  add('托管：多于一张不能开启最后一张托管', s, {
    type: 'SET_AUTO_PLAY_LAST_CARD',
    playerId: 'A',
    enabled: true,
    expectedRevision: s.revision,
  }, errorExpected('INVALID_MOVE', s));
}

// 25. Auto play last card plays and wins if legal.
{
  const s = state({
    currentTurn: 'A',
    autoPlay: { enabledPlayerIds: ['A'] },
    players: [
      player('A', [c('DIAMONDS', '4')]),
      player('B', [c('DIAMONDS', '5')]),
    ],
    lastMove: null,
  });
  add('托管：轮到最后一张自动出牌并获胜', s, {
    type: 'AUTO_PLAY_LAST_CARD',
    playerId: 'A',
    expectedRevision: s.revision,
  }, {
    gameStatus: 'finished',
    winner: 'A',
    currentTurn: null,
    lastMovePlayer: 'A',
    playerHands: { A: [], B: ['DIAMONDS-5'] },
  });
}

const results = tests.map((test) => {
  const result = nextState(clone(test.initialState), clone(test.action));
  const expectedForPick = test.expected.error
    ? { ...test.expected, originalState: test.initialState }
    : test.expected;
  const actual = pick(result, expectedForPick);
  const expected = test.expected.error
    ? { error: true, code: test.expected.code, stateUnchanged: true }
    : test.expected;
  const pass = deepEqual(actual, expected);
  return {
    name: test.name,
    initialState: test.initialState,
    action: test.action,
    expected,
    result: actual,
    pass,
    diff: pass ? '' : `expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
  };
});

console.log(JSON.stringify({
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length,
  results: results.map(({ name, action, expected, result, pass, diff }) => ({
    name,
    action,
    expected,
    result,
    pass,
    diff,
  })),
}, null, 2));
