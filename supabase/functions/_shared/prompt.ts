import type {
  World,
  WorldState,
  Character,
  CanonAmendment,
  LifeEntry,
  RelationshipThread,
  MemoryEntry,
} from './types.ts';

/**
 * Prompt 上下文組合 —— 把分層記憶拼成模型可讀的脈絡（規劃文件 §9 / §15.1）。
 *
 * 載入順序：World Canon → World State → Character Canon → Canon Amendments
 *          → Recent Life Timeline → Relationship Thread → Retrieved Memories。
 *
 * Append-only 呈現原則（§12.6）：原始記憶與後續解釋都要保留，並提示模型
 * 「角色不是被改寫，而是對自己有了更精確的理解」。
 */
export interface RoleplayContext {
  world: World;
  worldState: WorldState;
  character: Character;
  canonAmendments: CanonAmendment[];
  recentEntries: LifeEntry[];
  relationship?: RelationshipThread;
  retrievedMemories: MemoryEntry[];
}

export function composeRoleplaySystemPrompt(_ctx: RoleplayContext): string {
  // TODO(phase-2)：依載入順序串接，附上 §9 回覆守則。
  throw new Error('not implemented');
}

export function composeDiarySystemPrompt(
  _ctx: Omit<RoleplayContext, 'relationship'> & { relationshipLowSensitivitySummary?: string },
): string {
  // TODO(phase-4)：載入 autonomous_diary.md 規則 + 上下文 + 低敏感關係摘要。
  throw new Error('not implemented');
}
