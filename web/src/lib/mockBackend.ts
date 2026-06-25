// 本機 mock 後端（v0.1）—— 在還沒接 OpenRouter 前，讓整條對話流程能跑、能看。
// 刻意遵守核心原則：角色會帶到自己的近期生活與世界狀態，但「不替使用者創造行為」。
// 之後 api.ts 會在 Supabase 設定好時改走 Edge Function，這支就只在 demo 模式使用。
import { character, world, recentEntries } from './fixtures';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

/**
 * 產生一段「世界感 + 生活感」的回覆。模板式、非隨機創作，且不宣稱使用者主體性。
 * seed 用對話輪數，讓多輪不會每次都一樣。
 */
export function mockReply(history: ChatTurn[], _userMessage: string): string {
  const seed = history.length;
  const latest = recentEntries[0]!;

  const openers = [
    `還算平靜。${world.weather}，${latest.content}`,
    `今天沒什麼大事。${latest.content}`,
    `差不多就是平常的一天。${world.season}的${world.cityNote}`,
  ];

  const reflections = [
    '說到這個，我最近也在想，一個人不該只靠幾段對話被定義。',
    '這件事我也還在慢慢理清，沒急著下結論。',
    '我大概還是比較慢熱，但這樣也好。',
    '有些話，或許下次能更清楚地說。',
  ];

  return `${pick(openers, seed)}\n\n${pick(reflections, seed)}`;
}

export const demoCharacterName = character.name;
