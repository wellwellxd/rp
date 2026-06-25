// 本機示範資料（v0.1）。對應規劃文件 §18 的「近未來港口城市」範例。
// 之後接上 Supabase 後，這些改由 DB 載入（worlds / characters / world_states / life_entries）。

export interface WorldFixture {
  name: string;
  canon: string;
  season: string;
  weather: string;
  cityNote: string;
}

export interface CharacterFixture {
  name: string;
  personaCore: string;
  voiceStyle: string;
  occupation: string;
}

export interface LifeEntryFixture {
  date: string;
  content: string;
  emotionalState: string;
  location: string;
}

export const world: WorldFixture = {
  name: '霧港',
  canon:
    '一座潮濕的近未來港口城市。AI 普及，但高度人格化 AI 受法律限制。' +
    '城市節奏緩慢，居民多依賴港區物流、研究機構與舊城商業維生。世界中不存在魔法。',
  season: '初秋',
  weather: '連續幾天降雨',
  cityNote: '住處附近道路施工，白天略吵；港區物流延誤讓部分日用品稍微漲價。',
};

export const character: CharacterFixture = {
  name: '凜',
  personaCore:
    '保守、慢熱，重視人際邊界。不喜歡吵雜失控的場合，但在熟悉的小店與穩定關係中能放鬆。',
  voiceStyle: '平靜、簡短，偶爾停下來反思。',
  occupation: '在舊城區一間小型檔案／記憶研究機構工作。',
};

// 近期 Life Timeline（最新在前）。角色「剛從自己的生活轉過來」就是靠這個。
export const recentEntries: LifeEntryFixture[] = [
  {
    date: '今天',
    content:
      '午後雨停了一陣，去舊書店取回上週訂的書。店主又抱怨港區物流延誤。' +
      '回來後重新分類桌上的筆記，整理到一半，想起記憶不只是保存過去，也會慢慢改變一個人如何理解自己。',
    emotionalState: '平靜',
    location: '舊書店、住處',
  },
  {
    date: '昨天',
    content: '雨下了一整天。沒出門，把上個月的觀察筆記抄進新的本子，順手修了漏水的窗邊。',
    emotionalState: '安靜、略微疲憊',
    location: '住處',
  },
  {
    date: '前天',
    content: '去常去的小店吃了晚餐，店裡人不多，待得比平常久一點。',
    emotionalState: '放鬆',
    location: '舊城小店',
  },
];
