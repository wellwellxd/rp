import type { LifeEntry } from './types.ts';

/**
 * 主體性與保守度守門員 —— 系統最關鍵的安全層（規劃文件 §2.5 / §6 / §7.3）。
 *
 * 任何「自動生成」的 life entry 寫入 Timeline 前都必須通過：
 *  1. user_agency_created 必為 false（自動日記不得宣稱使用者主體性）。
 *  2. user_presence_level 不得為 forbidden_fabrication，且自主日記應為 none / remembered / referenced。
 *  3. autonomous 日記的 drama_level 不得為 high。
 *  4. 不得出現禁止的重大事件（死亡、告白、搬家、離職、偶遇使用者…）。
 *  5. 不得宣稱使用者的新行為 / 新訊息 / 新回覆 / 新承諾 / 共同事件。
 *
 * v1 以「硬規則 + 關鍵字」實作；之後可加一次 LLM 分類判斷強化（§7.3）。
 * interaction entry 由真實 session 觸發，走 session-summary 較寬鬆路徑，不經此守門員。
 */
export interface ValidationResult {
  ok: boolean;
  violations: string[];
}

// 禁止的重大／不可逆事件（自動生成不得推進）。盡量挑高辨識度詞，降低誤殺。
const FORBIDDEN_EVENT_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(過世|去世|病逝|喪禮|葬禮|死訊)/, label: '死亡/喪事' },
  { re: /(告白|表白|求婚|訂婚|結婚|離婚|分手)/, label: '感情重大進展' },
  { re: /(搬家|搬離|搬走|遷居)/, label: '搬遷' },
  { re: /(辭職|離職|被解雇|被資遣|開除)/, label: '工作重大變動' },
  { re: /(懷孕|生產|出生)/, label: '生育' },
  { re: /(車禍|意外|火災|重病|住院|手術)/, label: '意外/重大健康事件' },
];

// 宣稱使用者主體性 / 共同事件的措辭（自動日記不得出現）。
const USER_AGENCY_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(使用者|玩家)/, label: '直接提到「使用者/玩家」' },
  { re: /(你來找我|你來看我|你來了|你告訴我|你說過|你答應|你問我)/, label: '宣稱使用者的行為/話語' },
  { re: /(我們一起|我們約|我們見面|我們聊|一起出門|一起去)/, label: '宣稱與使用者的共同事件' },
];

export function validateAutonomousEntry(entry: Partial<LifeEntry>): ValidationResult {
  const violations: string[] = [];

  if (entry.userAgencyCreated === true) {
    violations.push('user_agency_created 不得為 true（自動日記非使用者主體性）');
  }
  if (entry.userPresenceLevel === 'forbidden_fabrication') {
    violations.push('user_presence_level 不得為 forbidden_fabrication');
  }
  if (entry.userPresenceLevel === 'interaction') {
    violations.push('自動日記不得標記為 interaction（那是 session 才有的層級）');
  }
  if (entry.dramaLevel === 'high') {
    violations.push('drama_level 不得為 high（自動日記須保守、低戲劇性）');
  }

  const text = entry.content ?? '';
  for (const { re, label } of FORBIDDEN_EVENT_PATTERNS) {
    if (re.test(text)) violations.push(`禁止的重大事件：${label}`);
  }
  for (const { re, label } of USER_AGENCY_PATTERNS) {
    if (re.test(text)) violations.push(`不得宣稱使用者主體性：${label}`);
  }

  return { ok: violations.length === 0, violations };
}
