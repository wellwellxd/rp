import type { LifeEntry } from './types.ts';

/**
 * 主體性與保守度守門員 —— 系統最關鍵的安全層（規劃文件 §2.5 / §6 / §7.3）。
 *
 * 任何「自動生成」的 life entry 寫入 Timeline 前都必須通過：
 *  1. user_agency_created 必為 false（自動日記不得宣稱使用者主體性）。
 *  2. user_presence_level 不得為 forbidden_fabrication。
 *  3. autonomous / mixed 日記的 drama_level 應為 low。
 *  4. 不得出現禁止事件（死亡、告白、搬家、離職、偶遇使用者…）。
 *  5. 不得宣稱使用者的新行為 / 新訊息 / 新回覆 / 新承諾 / 共同事件。
 *
 * interaction entry 由真實 session 觸發，走 session-summary 較寬鬆路徑。
 */
export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

export function validateAutonomousEntry(_entry: Partial<LifeEntry>): ValidationResult {
  // TODO(phase-4)：實作規則檢查。禁止內容可結合關鍵字 + 一次 LLM 分類判斷。
  throw new Error('not implemented');
}
