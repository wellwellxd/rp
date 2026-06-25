/**
 * 核心領域型別 —— 對應 DB schema（supabase/migrations/0001_initial_schema.sql）。
 * 後端（Edge Functions）與前端共用的「名詞層」：世界、角色、生活時間線、記憶、關係。
 * 前端若需端到端型別，建議改用 `supabase gen types typescript` 產生的 Database 型別。
 */

export type SourceType = 'autonomous' | 'interaction' | 'mixed';

export type UserPresenceLevel =
  | 'none'
  | 'remembered'
  | 'referenced'
  | 'interaction'
  | 'forbidden_fabrication';

export type DramaLevel = 'low' | 'medium' | 'high';
export type CanonImpact = 'none' | 'minor' | 'candidate';
export type SummaryPeriod = 'daily' | 'weekly' | 'monthly';

export interface World {
  id: string;
  name: string;
  worldCanon: string;
  geography?: string;
  socialRules?: string;
  technologyLevel?: string;
  magicRules?: string;
  dailyLifeRules?: string;
  forbiddenEvents?: string;
}

export interface WorldState {
  id: string;
  worldId: string;
  worldDate: string; // DB 欄位 world_date（current_date 為保留字）
  season?: string;
  weatherPattern?: string;
  locationState?: string;
  publicEvents?: string;
  minorWorldEvents?: string;
}

export interface Character {
  id: string;
  worldId: string;
  name: string;
  personaCore: string;
  backstory?: string;
  coreValues?: string;
  voiceStyle?: string;
  occupation?: string;
  routine?: string;
  relationshipRules?: string;
}

/** Canon 續寫（append-only）。人格不被改寫，只多一層後來形成的規則。 */
export interface CanonAmendment {
  id: string;
  content: string;
  reason?: string;
  sourceEntryIds: string[];
  validFrom: string;
  priority: number;
}

export interface Session {
  id: string;
  characterId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  sessionStatus: 'active' | 'ended' | 'summarized';
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount?: number;
  emotionalTags?: string[];
  createdAt: string;
}

/** 一篇日記 entry —— 自然語言 + metadata。Life Timeline 的基本單位。 */
export interface LifeEntry {
  id: string;
  characterId: string;
  worldId: string;
  entryDate: string;
  title?: string;
  content: string;
  structuredJson?: Record<string, unknown>;
  sourceType: SourceType;
  userPresenceLevel: UserPresenceLevel;
  userAgencyCreated: boolean;
  relatedUserId?: string;
  relatedSessionId?: string;
  dramaLevel: DramaLevel;
  canonImpact: CanonImpact;
  emotionalState?: string;
  location?: string;
  involvedNpcs?: string[];
  worldStateRefs?: string[];
  importanceScore?: number;
}

/** 從 Life Timeline 抽出的使用者關係索引（非另一套記憶）。 */
export interface RelationshipThread {
  id: string;
  characterId: string;
  userId: string;
  relationshipStage?: string;
  trustLevel?: number;
  sharedMemorySummary?: string;
  unresolvedThreads?: string;
}

/** 長期記憶（append-only）。supersedes / interpretation 都不刪除舊記憶。 */
export interface MemoryEntry {
  id: string;
  characterId: string;
  memoryType: string;
  content: string;
  sourceEntryIds: string[];
  validFrom: string;
  supersedesMemoryId?: string;
  interpretationOfMemoryId?: string;
  confidenceScore: number;
  canonImpact: CanonImpact;
}
