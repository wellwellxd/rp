import { useEffect, useState } from 'react';
import { getCharacterFull } from '../lib/db';
import { saveCharacter } from '../lib/api';

const todayISO = () => new Date().toISOString().slice(0, 10);

export function CharacterEditor({
  mode,
  characterId,
  onBack,
  onSaved,
}: {
  mode: 'create' | 'edit';
  characterId?: string;
  onBack: () => void;
  onSaved: (characterId: string) => void;
}) {
  // 角色欄位
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [personaCore, setPersonaCore] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('');
  const [coreValues, setCoreValues] = useState('');
  const [backstory, setBackstory] = useState('');
  const [initialDate, setInitialDate] = useState(todayISO());
  // 世界欄位
  const [worldName, setWorldName] = useState('');
  const [worldCanon, setWorldCanon] = useState('');
  const [season, setSeason] = useState('');
  const [weather, setWeather] = useState('');
  const [locationState, setLocationState] = useState('');
  // 開場近期生活（僅建立時）
  const [firstLife, setFirstLife] = useState('');

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'edit' && characterId) {
      getCharacterFull(characterId)
        .then((c) => {
          if (!c) {
            setError('找不到角色');
            return;
          }
          setName(c.name);
          setOccupation(c.occupation ?? '');
          setPersonaCore(c.persona_core);
          setVoiceStyle(c.voice_style ?? '');
          setCoreValues(c.core_values ?? '');
          setBackstory(c.backstory ?? '');
          setInitialDate(c.initial_date);
          setWorldName(c.world_name);
          setWorldCanon(c.world_canon);
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
  }, [mode, characterId]);

  const canSave =
    name.trim() && personaCore.trim() && worldName.trim() && worldCanon.trim();

  async function handleSave() {
    if (!canSave || saving) return;
    setError('');
    setSaving(true);
    try {
      const id = await saveCharacter({
        action: mode === 'edit' ? 'update' : 'create',
        characterId,
        character: {
          name,
          occupation,
          persona_core: personaCore,
          voice_style: voiceStyle,
          core_values: coreValues,
          backstory,
          ...(mode === 'create' ? { initial_date: initialDate } : {}),
        },
        world: {
          name: worldName,
          world_canon: worldCanon,
          ...(mode === 'create'
            ? { season, weather_pattern: weather, location_state: locationState }
            : {}),
        },
        ...(mode === 'create' && firstLife.trim() ? { firstLife } : {}),
      });
      onSaved(id);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <header className="appbar">
        <button className="icon-btn" aria-label="返回" onClick={onBack}>‹</button>
        <div className="title-block">
          <div className="name">{mode === 'create' ? '新增角色' : '編輯角色'}</div>
          <div className="sub">{mode === 'create' ? '建立一個有自己世界的角色' : name}</div>
        </div>
      </header>

      <div className="list form">
        {loading ? (
          <div className="hint">載入中…</div>
        ) : (
          <>
            <div className="form-section">角色</div>
            <label className="field">
              <span>名字 *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：凜" />
            </label>
            <label className="field">
              <span>職業 / 身分</span>
              <input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="例：在舊城區研究機構工作" />
            </label>
            <label className="field">
              <span>人格核心 *</span>
              <textarea rows={3} value={personaCore} onChange={(e) => setPersonaCore(e.target.value)} placeholder="個性、與人相處的方式、邊界…" />
            </label>
            <label className="field">
              <span>說話風格</span>
              <input value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)} placeholder="例：平靜、簡短，偶爾停下來反思" />
            </label>
            <label className="field">
              <span>重視的價值</span>
              <input value={coreValues} onChange={(e) => setCoreValues(e.target.value)} placeholder="例：誠實、邊界、長期勝過一時" />
            </label>
            <label className="field">
              <span>背景故事</span>
              <textarea rows={3} value={backstory} onChange={(e) => setBackstory(e.target.value)} placeholder="可留空" />
            </label>
            {mode === 'create' && (
              <label className="field">
                <span>起始日期（角色生活時間線的第一天）</span>
                <input type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} />
              </label>
            )}

            <div className="form-section">世界</div>
            <label className="field">
              <span>世界名稱 *</span>
              <input value={worldName} onChange={(e) => setWorldName(e.target.value)} placeholder="例：霧港" />
            </label>
            <label className="field">
              <span>世界設定 *</span>
              <textarea rows={4} value={worldCanon} onChange={(e) => setWorldCanon(e.target.value)} placeholder="時代、氛圍、不可違反的限制（例：是否有魔法）…" />
            </label>
            {mode === 'create' && (
              <>
                <label className="field">
                  <span>季節</span>
                  <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="例：初秋" />
                </label>
                <label className="field">
                  <span>天氣</span>
                  <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="例：連續幾天降雨" />
                </label>
                <label className="field">
                  <span>當前環境狀態</span>
                  <input value={locationState} onChange={(e) => setLocationState(e.target.value)} placeholder="例：住處附近道路施工" />
                </label>
                <label className="field">
                  <span>開場近期生活（可留空）</span>
                  <textarea rows={3} value={firstLife} onChange={(e) => setFirstLife(e.target.value)} placeholder="一段角色起始日的生活紀錄，讓角色不是全白起跑" />
                </label>
              </>
            )}

            {error && <div className="hint err">{error}</div>}
            <button className="new-chat" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? '儲存中…' : mode === 'create' ? '建立角色' : '儲存變更'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
