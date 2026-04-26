import type { Card, ComboType } from "./ruleEngine";

export const suitLabels: Record<Card["suit"], string> = {
  DIAMONDS: "♦",
  CLUBS: "♣",
  HEARTS: "♥",
  SPADES: "♠",
};

export const suitNames: Record<Card["suit"], string> = {
  DIAMONDS: "方块",
  CLUBS: "梅花",
  HEARTS: "红桃",
  SPADES: "黑桃",
};

export const comboNames: Record<ComboType, string> = {
  SINGLE: "单张",
  PAIR: "对子",
  TRIPLE: "三张",
  STRAIGHT: "顺子",
  FLUSH: "同花",
  THREE_WITH_TWO: "三带二",
  FOUR_WITH_ONE: "四带一",
  STRAIGHT_FLUSH: "同花顺",
};

export function isRedCard(card: Card) {
  return card.suit === "DIAMONDS" || card.suit === "HEARTS";
}

export function formatCard(card: Card) {
  return `${card.rank}${suitLabels[card.suit]}`;
}
