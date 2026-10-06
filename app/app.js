import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = id => document.getElementById(id);
const STORAGE = 'acha-supabase-config-v1';
const DEMO_STORAGE = 'acha-demo-logs-v2';
const ACCESS_STORAGE = 'acha-verified-email-v1';
const LOCAL_PAID = 'acha_paid';
let supabase = null;
let session = null;
let cache = [];
let paidAccess = localStorage.getItem(LOCAL_PAID) === 'true';

const config = JSON.parse(localStorage.getItem(STORAGE) || '{}');
$('supabaseUrl').value = config.url || '';
$('supabaseKey').value = config.key || '';

const today = () => new Date().toISOString().slice(0, 10);
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const moneyDate = d => new Date(`${d}T00:00:00`);
const format = (value, digits = 1) => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
const percent = value => value === null || !Number.isFinite(Number(value)) ? '—' : `${Math.round(Number(value))}%`;

function msg(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? '#bd4d3f' : 'var(--accent)';
}
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}
function connect() {
  const c = JSON.parse(localStorage.getItem(STORAGE) || '{}');
  if (!c.url || !c.key) return false;
  supabase = createClient(c.url, c.key);
  supabase.auth.onAuthStateChange((_event, s) => {
    session = s;
    if (s) verifyPurchaseAccess();
    else { paidAccess = false; updateAuth(); }
  });
  return true;
}
connect();


const mealGuideData = [
  { icon: '☕', title: '早餐', items: [
    ['早安御飯糰組', '趕時間、想吃經典早餐', '御飯糰 ＋ 茶葉蛋 ＋ 無糖茶', '御飯糰 ＋ 茶葉蛋 2 顆 ＋ 無糖茶'],
    ['地瓜豆漿組', '想吃溫熱、預算友善', '現蒸地瓜 ＋ 無糖豆漿 ＋ 茶葉蛋', '現蒸地瓜 ＋ 高蛋白牛奶 ＋ 茶葉蛋'],
    ['雞胸沙拉組', '上午較忙、想先顧蛋白質', '舒肥雞胸 ＋ 生菜沙拉 ＋ 小飯糰', '舒肥雞胸 ＋ 生菜沙拉 ＋ 飯糰'],
    ['燕麥優格輕食組', '喜歡清涼口感、控糖族', '希臘式優格 ＋ 無糖黑咖啡 ＋ 雞肉三明治', '希臘式優格 ＋ 蛋白丁 ＋ 雞肉三明治'],
    ['握沙拉捲餅組', '單手好拿、通勤族', '雞肉起司握沙拉 ＋ 無糖豆漿', '雞肉起司握沙拉 ＋ 茶葉蛋 ＋ 無糖豆漿'],
    ['經典美式咖啡組', '提神醒腦、低碳水', '美式咖啡 ＋ 鮪魚御飯糰 ＋ 茶葉蛋 1 顆', '美式咖啡 ＋ 鮪魚御飯糰 ＋ 茶葉蛋 2 顆'],
    ['水果高纖高蛋白組', '腸胃順暢、輕盈補給', '無糖綠茶 ＋ 茶葉蛋 2 顆 ＋ 香蕉 1 根', '無糖高纖豆漿 ＋ 茶葉蛋 2 顆 ＋ 香蕉 1 根']
  ]},
  { icon: '🍱', title: '午餐', items: [
    ['超商烤雞餐盒組', '忙碌上班族、懶人首選', '紐奧良烤雞胸肉 ＋ 鮭魚御飯糰 ＋ 關東煮蘿蔔', '紐奧良烤雞胸肉 ＋ 鮭魚御飯糰 ＋ 蛋白丁 ＋ 無糖茶'],
    ['溫暖雞湯餐盒組', '天冷想喝湯、養生族', '媽媽煮藝香菇雞湯 ＋ 雞肉三明治 ＋ 盒裝芭樂', '媽媽煮藝香菇雞湯 ＋ 雞肉三明治 ＋ 茶葉蛋 ＋ 盒裝芭樂'],
    ['高蛋白便當組', '高活動量、爆汗日', '健身 G 達人烤雞飯盒（飯吃 2/3） ＋ 無糖綠茶', '健身 G 達人烤雞飯盒（全吃） ＋ 無糖黑豆漿'],
    ['台式自助餐組', '菜色豐富、想吃原型食物', '綠色青菜 2 格 ＋ 滷雞腿／蒸魚 ＋ 白飯半碗', '綠色青菜 2 格 ＋ 滷雞腿 ＋ 滷蛋 1 顆 ＋ 白飯 2/3 碗'],
    ['便當店救援組', '外帶便當、聚餐避雷', '台式滷排骨便當（去炸皮、飯半碗） ＋ 無糖烏龍茶', '台式滷雞腿便當（飯 2/3 碗） ＋ 加購滷蛋 ＋ 無糖烏龍茶'],
    ['涼麵沙拉輕食組', '夏天食欲不振', '鮮蝦高纖沙拉 ＋ 雞肉飯糰', '鮮蝦高纖沙拉 ＋ 雞肉飯糰 ＋ 茶葉蛋 1 顆 ＋ 無糖豆漿'],
    ['湯麵水餃外食組', '想吃小吃攤、麵食族', '陽春麵（少油蔥） ＋ 燙青菜 ＋ 滷蛋／豆干', '嘴邊肉湯／肝連湯 ＋ 燙青菜 ＋ 水餃 8 顆 ＋ 滷蛋']
  ]},
  { icon: '🥗', title: '晚餐', items: [
    ['雞腿蔬菜便當組', '下班想吃飽、晚餐首選', '烤雞腿 ＋ 青菜 2 格 ＋ 飯半碗', '烤雞腿 ＋ 青菜 2 格 ＋ 滷蛋 ＋ 飯 2/3 碗'],
    ['豆腐魚湯組', '想清爽、晚上不想太撐', '魚片豆腐湯 ＋ 燙青菜 ＋ 小地瓜', '魚片豆腐湯 ＋ 滷豆腐 ＋ 燙青菜 ＋ 小地瓜'],
    ['火鍋聰明選組', '聚餐火鍋、想安心吃', '蔬菜盤 ＋ 肉片 1 份 ＋ 冬粉半份 ＋ 無糖茶', '蔬菜盤 ＋ 肉片 1.5 份 ＋ 豆腐／蛋 ＋ 冬粉半份'],
    ['日式定食組', '喜歡魚類、想吃完整一餐', '烤魚定食（飯半碗） ＋ 沙拉 ＋ 味噌湯', '烤魚定食（飯 2/3 碗） ＋ 沙拉 ＋ 茶碗蒸'],
    ['滷味自選組', '想吃多樣配料、外帶方便', '青菜 2 份 ＋ 豆干／滷蛋 ＋ 玉米或冬粉', '青菜 2 份 ＋ 雞胸肉 ＋ 豆干／滷蛋 ＋ 玉米'],
    ['超商沙拉晚餐組', '加班晚歸、快速解決', '生菜沙拉 ＋ 舒肥雞胸 ＋ 烤地瓜', '生菜沙拉 ＋ 舒肥雞胸 ＋ 茶葉蛋 ＋ 烤地瓜'],
    ['粥品小菜組', '胃口較弱、想吃溫熱', '海鮮粥半碗 ＋ 滷蛋 ＋ 燙青菜', '海鮮粥 2/3 碗 ＋ 滷蛋 ＋ 豆腐 ＋ 燙青菜']
  ]},
  { icon: '🧁', title: '下午茶', items: [
    ['優格水果組', '嘴饞、想要清爽甜味', '無糖優格 ＋ 小份水果', '希臘式優格 ＋ 水果 ＋ 蛋白丁'],
    ['茶葉蛋豆漿組', '下午容易餓、需要補蛋白質', '茶葉蛋 1 顆 ＋ 無糖豆漿', '茶葉蛋 2 顆 ＋ 高蛋白牛奶'],
    ['咖啡小點組', '想喝咖啡、需要一點能量', '無糖咖啡 ＋ 小地瓜', '無糖咖啡 ＋ 小地瓜 ＋ 茶葉蛋']
  ]},
  { icon: '🌙', title: '宵夜', items: [
    ['溫豆漿輕食組', '晚睡、需要溫熱飲品', '無糖豆漿 ＋ 茶葉蛋 1 顆', '高蛋白牛奶 ＋ 茶葉蛋 1 顆'],
    ['小地瓜蛋白組', '運動後、想補一點碳水', '小地瓜 ＋ 無糖優格', '小地瓜 ＋ 高蛋白牛奶 ＋ 茶葉蛋'],
    ['清湯豆腐組', '嘴饞但不想太有負擔', '豆腐蔬菜清湯 ＋ 無糖茶', '豆腐蔬菜清湯 ＋ 滷蛋 ＋ 無糖茶']
  ]}
];

function renderMealGuide() {
  const root = $('mealGuideAccordion');
  if (!root) return;
  root.innerHTML = mealGuideData.map((group, groupIndex) => `
    <details class="meal-guide-group" ${groupIndex === 0 ? 'open' : ''}>
      <summary><span class="meal-guide-group-title">${group.icon} ${group.title} <small>｜ ${group.items.length}組</small></span><span class="meal-guide-chevron">⌄</span></summary>
      <div class="meal-guide-items">
        ${group.items.map((item, index) => `
          <article class="meal-combo-card">
            <div class="meal-combo-head"><span class="meal-combo-name">${String(index + 1).padStart(2, '0')} ｜ ${item[0]}</span><span class="meal-combo-tag">${item[1]}</span></div>
            <ul class="meal-combo-options"><li><b>211 一般</b><span><small class="meal-order-note">順序：🥗 蔬菜 ➔ 🥩 蛋白質 ➔ 🍠 澱粉</small>${item[2]}</span></li><li><b>221 健身</b><span><small class="meal-order-note">順序：🥗 蔬菜 ➔ 🥩 蛋白質 ➔ 🍠 澱粉</small>${item[3]}</span></li></ul>
          </article>`).join('')}
      </div>
    </details>`).join('');
}

renderMealGuide();

function isDemo() { return new URLSearchParams(location.search).has('demo'); }
function demoSeed() {
  const base = new Date();
  const rows = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(base.getTime() - (13 - i) * 86400000).toISOString().slice(0, 10);
    const morning = 62.8 - i * 0.08 + (i % 4) * 0.12;
    rows.push({ log_date: d, morning_weight: Number(morning.toFixed(1)), evening_weight: Number((morning + 0.65 + (i % 3) * 0.12).toFixed(1)), waist_cm: Number((78 - i * 0.08).toFixed(1)), hip_cm: 98, age_years: 32, height_cm: 162, reference_sex: 'female', body_fat_pct: Number((25.8 - i * 0.06 + (i % 3) * 0.08).toFixed(1)), sleep_hours: Number((6.2 + (i % 5) * 0.45).toFixed(1)), plate_pattern: i % 4 === 0 ? '221' : '211', eating_out_count: 2, protein_status: i % 5 === 0 ? '普通' : '足夠', vegetables_status: i % 6 === 0 ? '普通' : '足夠', exercise_minutes: i % 3 === 0 ? 20 : 35, water_ml: Math.round(morning * 40 * (0.8 + (i % 4) * 0.07)), slept_well: i % 4 !== 0, bowel_movement: i % 5 !== 0, meals: { breakfast: { food: '無糖豆漿＋蛋' }, lunch: { food: '雞腿便當，飯半碗' }, dinner: { food: '豆腐蔬菜湯＋地瓜' } }, notes: '示範資料：可自行修改' });
  }
  return rows;
}
function demoRows() { return demoSeed(); }
function saveDemoRows() { /* 免費體驗資料只存在記憶體，重新載入頁面即重置 */ }
function updateGuideLock(show = false) {
  const locked = !paidAccess;
  const content = $('guideLockedContent'), wall = $('guidePaywall');
  if (content) content.classList.toggle('is-guide-locked', locked && show);
  if (wall) wall.classList.toggle('hidden', !(locked && show));
}
function switchToTodayFromPaywall() {
  const todayTab = document.querySelector('.view-tab[data-view=\"todayView\"]');
  document.querySelectorAll('.view-tab').forEach(x => x.classList.remove('active'));
  todayTab?.classList.add('active');
  document.querySelectorAll('.page-view').forEach(x => x.classList.add('hidden'));
  $('todayView')?.classList.remove('hidden');
  updateGuideLock(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function closeGuidePaywall() { switchToTodayFromPaywall(); }
function updateAccessStrip(demo) {
  const strip = $('accessStrip'), badge = $('accessBadge'), buy = $('accessBuy');
  if (!strip || !badge || !buy) return;
  strip.classList.toggle('is-paid', paidAccess);
  if (paidAccess) {
    badge.textContent = `正式版已解鎖 ｜ ${session?.user?.email || '已驗證購買者'}`;
    buy.hidden = true;
  } else if (demo) {
    badge.textContent = '免費體驗中 ｜ 換頁將重置資料';
    buy.hidden = false;
  } else {
    badge.textContent = '尚未解鎖 ｜ 請使用購買 Email 登入';
    buy.hidden = false;
  }
}
async function verifyPurchaseAccess() {
  if (!supabase || !session) { paidAccess = false; updateAuth(); return false; }
  const { data, error } = await supabase.rpc('has_active_acha_entitlement');
  paidAccess = !error && data === true;
  if (paidAccess) localStorage.setItem(ACCESS_STORAGE, session.user.email || '');
  updateAuth();
  if (!paidAccess) msg('purchaseAuthMessage', error ? '付款權限驗證尚未完成，請確認 Supabase 權限表與 Webhook 設定。' : '找不到這個 Email 的有效購買紀錄，請使用付款時的相同 Email。', true);
  return paidAccess;
}
function updateAuth() {
  const demo = isDemo() && !paidAccess;
  const accessible = paidAccess || demo;
  $('authView').classList.toggle('hidden', accessible);
  $('mainView').classList.toggle('hidden', !accessible);
  $('logoutBtn').classList.toggle('hidden', !session);
  $('userLabel').textContent = paidAccess ? (session?.user?.email || '正式版已解鎖') : demo ? '免費體驗中（不保存資料）' : session?.user?.email || '尚未登入';
  updateAccessStrip(demo);
  updateGuideLock(false);
  if (!accessible && session) msg('authMessage', '已登入，但尚未找到有效購買紀錄；請使用購買 Email 或先完成 Portaly 付款。', true);
  if (accessible) {
    if (demo) cache = demoRows();
    renderMonth(); renderYear();
    $('logDate').value = $('logDate').value || today();
    loadLog($('logDate').value);
  }
  updateWaterHint();
}

async function auth(mode) {
  if (!supabase) { msg('authMessage', '請先到設定貼上 Supabase URL 與 anon key。', true); return; }
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (!email || !password) return;
  const r = mode === 'signup'
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  if (r.error) msg('authMessage', r.error.message, true);
  else msg('authMessage', mode === 'signup' ? '帳號建立成功；若有啟用 Email 驗證，請先點擊驗證信。' : '登入成功。');
}
$('authForm').addEventListener('submit', e => { e.preventDefault(); auth('login'); });
$('signupBtn').addEventListener('click', () => auth('signup'));
$('logoutBtn').addEventListener('click', async () => { await supabase?.auth.signOut(); session = null; updateAuth(); });
$('demoBtn').addEventListener('click', () => { const u = new URL(location.href); u.searchParams.set('demo', '1'); location.href = u.toString(); });
$('purchaseLoginBtn').addEventListener('click', () => $('purchaseAuthModal').classList.remove('hidden'));
$('closePurchaseAuth').addEventListener('click', () => $('purchaseAuthModal').classList.add('hidden'));
$('purchaseAuthModal').addEventListener('click', e => { if (e.target.id === 'purchaseAuthModal') e.currentTarget.classList.add('hidden'); });
$('purchaseAuthForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('purchaseEmail').value.trim().toLowerCase();
  if (!email) return;
  localStorage.setItem(LOCAL_PAID, 'true');
  paidAccess = true;
  if (supabase) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    if (error) { msg('purchaseAuthMessage', error.message, true); return; }
    msg('purchaseAuthMessage', 'Email 登入連結已寄出；本機預覽已先解鎖，完成驗證後會再檢查付款權限。');
  } else {
    msg('purchaseAuthMessage', '已用購買 Email 解鎖本機預覽；正式同步資料仍需設定 Supabase。');
  }
  updateAuth();
  $('purchaseAuthModal').classList.add('hidden');
});
$('paywallEmailBtn').addEventListener('click', () => $('purchaseAuthModal').classList.remove('hidden'));
$('closeGuidePaywall')?.addEventListener('click', closeGuidePaywall);
$('returnTodayFromPaywall')?.addEventListener('click', closeGuidePaywall);
$('guidePaywall')?.addEventListener('click', e => { if (e.target.id === 'guidePaywall') closeGuidePaywall(); });
$('configBtn').addEventListener('click', () => $('configView').classList.remove('hidden'));
$('closeConfig').addEventListener('click', () => $('configView').classList.add('hidden'));
$('saveConfig').addEventListener('click', () => {
  const url = $('supabaseUrl').value.trim().replace(/\/$/, '');
  const key = $('supabaseKey').value.trim();
  if (!url || !key) { msg('configMessage', '請填寫兩個欄位。', true); return; }
  localStorage.setItem(STORAGE, JSON.stringify({ url, key }));
  connect();
  msg('configMessage', '設定已儲存，請回到登入頁。');
  setTimeout(() => { $('configView').classList.add('hidden'); updateAuth(); }, 700);
});

const ids = [
  'morningWeight', 'eveningWeight', 'waistCm', 'hipCm', 'bodyFatPct', 'sleepHours', 'ageYears', 'heightCm', 'referenceSex', 'mood',
  'breakfastType', 'breakfastDrink', 'breakfastFood', 'breakfastNote', 'lunchType', 'lunchDrink', 'lunchFood', 'lunchNote',
  'dinnerType', 'dinnerDrink', 'dinnerFood', 'dinnerNote', 'platePattern', 'eatingOutCount', 'proteinStatus', 'vegetablesStatus',
  'exercise', 'exerciseMinutes', 'waterMl', 'drinks', 'sleptWell', 'bowelMovement', 'notes'
];
const val = id => { const el = $(id); return el.type === 'checkbox' ? el.checked : el.value; };

function hydrationTarget(weight = val('morningWeight')) {
  const kg = num(weight);
  return kg && kg > 0 ? Math.round(kg * 40) : null;
}
function updateWaterHint() {
  const target = hydrationTarget();
  const hint = $('waterHint');
  if (hint) hint.textContent = target ? `參考目標 ${target.toLocaleString()} ml（體重 × 40 ml；僅供參考）` : '先填早上體重，顯示個人化參考目標';
}
function formData() {
  return {
    log_date: $('logDate').value,
    morning_weight: val('morningWeight') ? Number(val('morningWeight')) : null,
    evening_weight: val('eveningWeight') ? Number(val('eveningWeight')) : null,
    waist_cm: val('waistCm') ? Number(val('waistCm')) : null,
    hip_cm: val('hipCm') ? Number(val('hipCm')) : null,
    body_fat_pct: val('bodyFatPct') ? Number(val('bodyFatPct')) : null,
    sleep_hours: val('sleepHours') ? Number(val('sleepHours')) : null,
    age_years: val('ageYears') ? Number(val('ageYears')) : null,
    height_cm: val('heightCm') ? Number(val('heightCm')) : null,
    reference_sex: val('referenceSex'),
    meals: {
      breakfast: { type: val('breakfastType'), drink: val('breakfastDrink'), food: val('breakfastFood'), note: val('breakfastNote') },
      lunch: { type: val('lunchType'), drink: val('lunchDrink'), food: val('lunchFood'), note: val('lunchNote') },
      dinner: { type: val('dinnerType'), drink: val('dinnerDrink'), food: val('dinnerFood'), note: val('dinnerNote') }
    },
    plate_pattern: val('platePattern'),
    eating_out_count: Number(val('eatingOutCount') || 0),
    protein_status: val('proteinStatus'),
    vegetables_status: val('vegetablesStatus'),
    drinks: val('drinks'),
    exercise: val('exercise'),
    exercise_minutes: Number(val('exerciseMinutes') || 0),
    water_ml: Number(val('waterMl') || 0),
    slept_well: val('sleptWell'),
    bowel_movement: val('bowelMovement'),
    mood: val('mood') ? Number(val('mood')) : null,
    notes: val('notes')
  };
}
function fill(d) {
  const map = {
    morningWeight: d?.morning_weight ?? '', eveningWeight: d?.evening_weight ?? '', waistCm: d?.waist_cm ?? '', hipCm: d?.hip_cm ?? '', bodyFatPct: d?.body_fat_pct ?? '', sleepHours: d?.sleep_hours ?? '',
    ageYears: d?.age_years ?? '', heightCm: d?.height_cm ?? '', referenceSex: d?.reference_sex ?? '', mood: d?.mood ?? '',
    platePattern: d?.plate_pattern ?? '', eatingOutCount: d?.eating_out_count ?? 0, proteinStatus: d?.protein_status ?? '',
    vegetablesStatus: d?.vegetables_status ?? '', drinks: d?.drinks ?? '', exercise: d?.exercise ?? '沒有運動',
    exerciseMinutes: d?.exercise_minutes ?? 0, waterMl: d?.water_ml ?? 0, notes: d?.notes ?? ''
  };
  Object.entries(map).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
  ['sleptWell', 'bowelMovement'].forEach(id => { $(id).checked = !!d?.[id === 'sleptWell' ? 'slept_well' : 'bowel_movement']; });
  Object.entries(d?.meals || {}).forEach(([meal, m]) => Object.entries(m || {}).forEach(([key, value]) => {
    const el = $(`${meal}${key[0].toUpperCase()}${key.slice(1)}`);
    if (el) el.value = value || '';
  }));
  updateWaterHint();
  updateProgress();
}
async function loadLog(date) {
  if (isDemo() && !paidAccess) { fill(cache.find(x => x.log_date === date) || {}); return; }
  if (!session || !supabase) return;
  const { data, error } = await supabase.from('daily_logs').select('*').eq('log_date', date).maybeSingle();
  if (error) { msg('saveMessage', error.message, true); return; }
  fill(data || {});
}
$('logDate').value = today();
$('logDate').addEventListener('change', () => loadLog($('logDate').value));
ids.forEach(id => { const el = $(id); if (el) el.addEventListener('input', () => { updateProgress(); updateWaterHint(); }); });

function companionStats(rows = cache) {
  const dates = new Set(rows.map(row => row.log_date).filter(Boolean));
  const todayDate = today();
  let cursor = todayDate, streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    const previous = new Date(`${cursor}T12:00:00`);
    previous.setDate(previous.getDate() - 1);
    cursor = previous.toISOString().slice(0, 10);
  }
  const recorded = rows.filter(row => row.log_date && row.log_date <= todayDate).length;
  return { streak, recorded: Math.min(365, recorded) };
}
function updateCompanionStats() {
  const { streak, recorded } = companionStats();
  const streakBadge = $('streakBadge'), planCount = $('planCount');
  if (streakBadge) streakBadge.textContent = `🔥 連續打卡：第 ${streak || 0} 天`;
  if (planCount) planCount.textContent = `🍵 365 陪伴計畫：第 ${recorded || 0} / 365 天`;
}

function updateProgress() {
  const x = formData();
  const done = [x.morning_weight, x.evening_weight, x.waist_cm, x.meals.breakfast.food, x.meals.lunch.food, x.meals.dinner.food, x.plate_pattern, x.protein_status, x.vegetables_status, x.exercise_minutes, x.water_ml, x.drinks, x.mood, x.notes].filter(v => v !== null && v !== undefined && v !== '' && v !== 0).length + [x.slept_well, x.bowel_movement].filter(Boolean).length;
  const pct = Math.round(done / 17 * 100);
  $('progressValue').textContent = `${Math.min(100, pct)}%`;
  $('progressBar').style.width = `${Math.min(100, pct)}%`;
  const bubble = $('celebrationBubble');
  if (bubble) bubble.classList.toggle('hidden', pct < 100);
  updateCompanionStats();
}
$('logForm').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = formData();
  if (isDemo() && !paidAccess) {
    cache = cache.filter(x => x.log_date !== payload.log_date);
    cache.push({ ...payload, id: `demo-${payload.log_date}` });
    cache = sortRows(cache);
    saveDemoRows();
    msg('saveMessage', '示範資料已儲存到這支瀏覽器。');
    toast('示範資料已更新');
    renderMonth(); renderYear();
    return;
  }
  if (!session) { msg('saveMessage', '請先登入。', true); return; }
  const { error } = await supabase.from('daily_logs').upsert({ ...payload, user_id: session.user.id }, { onConflict: 'user_id,log_date' });
  if (error) msg('saveMessage', error.message, true);
  else { msg('saveMessage', '已儲存今天的記錄。'); toast('今天的記錄已儲存'); loadAll(); }
});

function sortRows(rows) { return [...rows].sort((a, b) => a.log_date.localeCompare(b.log_date)); }
function rowByDate(date) { return cache.find(x => x.log_date === date); }
function dayIncrease(row) {
  const morning = num(row?.morning_weight), evening = num(row?.evening_weight);
  return morning !== null && evening !== null ? evening - morning : null;
}
function overnightDrop(row) {
  if (!row) return null;
  const prev = rowByDate(new Date(moneyDate(row.log_date).getTime() - 86400000).toISOString().slice(0, 10));
  const previousEvening = num(prev?.evening_weight), currentMorning = num(row.morning_weight);
  return previousEvening !== null && currentMorning !== null ? previousEvening - currentMorning : null;
}
function waistHip(row) {
  const waist = num(row?.waist_cm), hip = num(row?.hip_cm);
  return waist !== null && hip > 0 ? waist / hip : null;
}
function bmr(row) {
  const w = num(row?.morning_weight), h = num(row?.height_cm), age = num(row?.age_years);
  if (w === null || h === null || age === null || !row?.reference_sex) return null;
  return row.reference_sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
}
function waterPct(row) {
  const target = hydrationTarget(row?.morning_weight);
  return target && num(row?.water_ml) !== null ? Math.min(100, row.water_ml / target * 100) : null;
}
function avg(values) {
  const n = values.map(Number).filter(Number.isFinite);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
}
function stats(rows) {
  const weights = rows.map(x => num(x.morning_weight)).filter(v => v !== null);
  const checks = {
    sleep: rows.filter(x => x.slept_well).length,
    bowel: rows.filter(x => x.bowel_movement).length,
    water: rows.filter(x => (waterPct(x) || 0) >= 100).length,
    exercise: rows.filter(x => num(x.exercise_minutes) >= 20).length,
    protein: rows.filter(x => x.protein_status === '足夠').length,
    vegetables: rows.filter(x => x.vegetables_status === '足夠').length
  };
  const total = Object.values(checks).reduce((a, b) => a + b, 0);
  return {
    days: rows.length,
    avgWeight: avg(weights),
    avgWaistHip: avg(rows.map(waistHip).filter(v => v !== null)),
    avgBmr: avg(rows.map(bmr).filter(v => v !== null)),
    avgWaterPct: avg(rows.map(waterPct).filter(v => v !== null)),
    avgDayIncrease: avg(rows.map(dayIncrease).filter(v => v !== null)),
    avgOvernightDrop: avg(rows.map(overnightDrop).filter(v => v !== null)),
    out: rows.reduce((n, x) => n + Number(x.eating_out_count || 0), 0),
    exercise: rows.filter(x => num(x.exercise_minutes) > 0).length,
    checks,
    habit: rows.length ? Math.round(total / (rows.length * 6) * 100) : 0
  };
}
function habitHTML(s) {
  const names = [['sleep', '早睡'], ['bowel', '排便'], ['water', '飲水達個人目標'], ['exercise', '運動 ≥ 20 分'], ['protein', '蛋白質足夠'], ['vegetables', '蔬菜足夠']];
  return `<div class="habit-head"><div><h2>生活習慣達成度</h2><p class="subtle">${s.days ? `已完成 ${s.habit}%` : '有記錄後會顯示'}</p></div><strong>${s.habit}%</strong></div><div class="habit-bars">${names.map(([key, name]) => { const pct = s.days ? Math.round(s.checks[key] / s.days * 100) : 0; return `<div class="habit-item"><span>${name}</span><b>${pct}%</b><i><em style="width:${pct}%"></em></i></div>`; }).join('')}</div><p class="source-note">飲水達成度以早上體重 × 40 ml 作為本工具的簡化參考目標；各項僅供自我追蹤。</p>`;
}
function metricCards(s) {
  return [
    ['已記錄', `${s.days} 天`], ['平均早上體重', `${format(s.avgWeight)} kg`], ['平均腰臀比', format(s.avgWaistHip, 2)],
    ['基礎代謝估算', s.avgBmr ? `${Math.round(s.avgBmr)} kcal` : '待補資料'], ['平均飲水達成', percent(s.avgWaterPct)], ['外食餐數', `${s.out} 餐`],
    ['日內增加量', s.avgDayIncrease === null ? '待補資料' : `${s.avgDayIncrease >= 0 ? '+' : ''}${format(s.avgDayIncrease)} kg`],
    ['夜間回落量', s.avgOvernightDrop === null ? '待補資料' : `${format(s.avgOvernightDrop)} kg`]
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
}
function dailySummaryHTML(row) {
  const day = dayIncrease(row), night = overnightDrop(row), water = waterPct(row), whr = waistHip(row), metabolic = bmr(row);
  const trend = [day === null ? '日內增加 待補' : `日內增加 ${day >= 0 ? '+' : ''}${format(day)} kg`, night === null ? '夜間回落 待補' : `夜間回落 ${format(night)} kg`, `飲水 ${water === null ? '待補' : percent(water)}`, `腰臀比 ${whr === null ? '待補' : format(whr, 2)}`].join('　');
  return `<div class="log-row"><div class="log-summary"><strong>${row.log_date}</strong><span>早 ${format(row.morning_weight)} kg　晚 ${format(row.evening_weight)} kg</span></div><p class="daily-metrics">${trend}</p><details><summary>查看每日摘要</summary><p class="subtle">${row.plate_pattern ? `餐盤 ${row.plate_pattern}` : '餐盤待補'}　外食 ${row.eating_out_count || 0} 餐<br>早睡：${row.slept_well ? '完成' : '未勾選'}　排便：${row.bowel_movement ? '完成' : '未勾選'}　運動：${row.exercise_minutes || 0} 分鐘<br>基礎代謝估算：${metabolic ? `${Math.round(metabolic)} kcal` : '資料不足'}<br>以上指標為自我追蹤估算，僅供參考。</p></details></div>`;
}
function renderMonth() {
  const rows = monthRows(selectedMonth()), s = stats(rows);
  $('monthStats').innerHTML = metricCards(s);
  $('monthHabits').innerHTML = habitHTML(s);
  $('monthCount').textContent = `6 項習慣綜合 ${s.habit}%`;
  $('monthList').innerHTML = rows.length ? rows.slice().reverse().map(dailySummaryHTML).join('') : '<p class="subtle">這個月還沒有記錄。</p>';
  drawChart('monthChart', rows.map(x => [x.log_date, num(x.morning_weight)]).filter(x => x[1] !== null), 'kg');
  drawDualChart('monthBalanceChart', rows.map(x => [x.log_date, dayIncrease(x), overnightDrop(x)]));
  drawSleepWeightChart('monthSleepWeightChart', rows.map(x => [x.log_date, num(x.morning_weight), num(x.sleep_hours)]).filter(x => x[1] !== null || x[2] !== null));
  drawChart('monthWhrChart', rows.map(x => [x.log_date, waistHip(x)]).filter(x => x[1] !== null), 'WHR');
  drawChart('monthBodyFatChart', rows.map(x => [x.log_date, num(x.body_fat_pct)]).filter(x => x[1] !== null), '%');
}
function renderYear() {
  const y = String($('yearPicker').value || new Date().getFullYear()), rows = cache.filter(x => x.log_date.startsWith(y)), s = stats(rows);
  $('yearStats').innerHTML = metricCards(s);
  $('yearHabits').innerHTML = habitHTML(s);
  const months = Array.from({ length: 12 }, (_, i) => {
    const mm = `${y}-${String(i + 1).padStart(2, '0')}`, r = monthRows(mm), z = stats(r);
    return `<div class="month-row"><div class="log-summary"><strong>${i + 1} 月</strong><span>${z.days} 天　平均 ${format(z.avgWeight)} kg　腰臀比 ${format(z.avgWaistHip, 2)}　日內 +${format(z.avgDayIncrease)} kg　夜間回落 ${format(z.avgOvernightDrop)} kg</span></div></div>`;
  }).join('');
  $('yearList').innerHTML = months;
  drawChart('yearChart', Array.from({ length: 12 }, (_, i) => { const r = monthRows(`${y}-${String(i + 1).padStart(2, '0')}`); return [String(i + 1), avg(r.map(x => num(x.morning_weight)).filter(v => v !== null))]; }).filter(x => x[1] !== null));
  drawDualChart('yearBalanceChart', Array.from({ length: 12 }, (_, i) => { const r = monthRows(`${y}-${String(i + 1).padStart(2, '0')}`), z = stats(r); return [String(i + 1), z.avgDayIncrease, z.avgOvernightDrop]; }));
}
function selectedMonth() { return $('monthPicker').value || today().slice(0, 7); }
function monthRows(month) { return sortRows(cache.filter(x => x.log_date.startsWith(month))); }
$('monthPicker').value = today().slice(0, 7);
$('monthPicker').addEventListener('change', renderMonth);
$('yearPicker').value = new Date().getFullYear();
$('yearPicker').addEventListener('change', renderYear);

function chartFrame(ctx, w, h, min, max, labels, yUnit = 'kg') {
  const pad = { left: 48, right: 12, top: 22, bottom: 52 };
  const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#748680';
  for (let i = 0; i < 4; i++) {
    const ratio = i / 3, y = pad.top + plotH * ratio, value = max - (max - min) * ratio;
    ctx.strokeStyle = '#dfeae5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    ctx.fillText(value.toFixed(1), pad.left - 7, y);
  }
  ctx.strokeStyle = '#9aaca5'; ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + plotH); ctx.lineTo(w - pad.right, pad.top + plotH); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '10px sans-serif'; ctx.fillStyle = '#999';
  const step = labels.length > 7 ? Math.ceil(labels.length / 6) : 1;
  labels.forEach((label, i) => {
    if (i % step && i !== labels.length - 1) return;
    const x = pad.left + plotW * i / Math.max(1, labels.length - 1);
    const shortLabel = /^\d{4}-\d{2}-\d{2}$/.test(label) ? label.slice(5).replace('-', '/') : label;
    ctx.fillText(shortLabel, x, pad.top + plotH + 9);
  });
  ctx.save(); ctx.translate(12, pad.top + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(yUnit, 0, 0); ctx.restore();
  // 刻度保留 MM/DD；不繪製多餘的「日期／月份」軸標題，避免手機裁切。
  return { pad, plotW, plotH, x: i => pad.left + plotW * i / Math.max(1, labels.length - 1), y: value => pad.top + (max - value) / (max - min || 1) * plotH };
}
function drawChart(id, points, yUnit = 'kg') {
  const canvas = $(id); if (!canvas) return;
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth || 600, h = 260;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  if (!points.length) { ctx.fillStyle = '#748680'; ctx.font = '14px sans-serif'; ctx.fillText('有記錄後會顯示趨勢圖', 52, 120); return; }
  const values = points.map(x => x[1]), min = Math.min(...values) - .5, max = Math.max(...values) + .5;
  const frame = chartFrame(ctx, w, h, min, max, points.map(x => x[0]), yUnit);
  ctx.strokeStyle = '#d87550'; ctx.lineWidth = 3; ctx.beginPath();
  points.forEach((p, i) => { const x = frame.x(i), y = frame.y(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  ctx.fillStyle = '#193d37'; points.forEach((p, i) => { const x = frame.x(i), y = frame.y(p[1]); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
}
function drawSleepWeightChart(id, points) {
  const canvas = $(id); if (!canvas) return;
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth || 600, h = 280;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const valid = points.filter(x => x[1] !== null || x[2] !== null);
  if (!valid.length) { ctx.fillStyle = '#748680'; ctx.font = '14px sans-serif'; ctx.fillText('有記錄後會顯示體重與睡眠趨勢', 52, 120); return; }
  const weights = valid.map(x => x[1]).filter(v => v !== null), min = (weights.length ? Math.min(...weights) : 60) - .5, max = (weights.length ? Math.max(...weights) : 70) + .5;
  const frame = chartFrame(ctx, w, h, min, max, valid.map(x => x[0]), 'kg');
  const sleepMax = 10, sleepMin = 0;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#83a6ba';
  [0, 5, 10].forEach(v => ctx.fillText(String(v), w - 30, frame.pad.top + (sleepMax - v) / sleepMax * frame.plotH));
  valid.forEach((p, i) => { if (p[2] === null) return; const x = frame.x(i), barH = (p[2] - sleepMin) / sleepMax * frame.plotH; ctx.fillStyle = 'rgba(137,186,211,.42)'; ctx.fillRect(x - 10, frame.pad.top + frame.plotH - barH, 20, barH); });
  ctx.strokeStyle = '#d87550'; ctx.lineWidth = 3; ctx.beginPath(); let started = false;
  valid.forEach((p, i) => { if (p[1] === null) return; const x = frame.x(i), y = frame.y(p[1]); started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; }); ctx.stroke();
  ctx.fillStyle = '#193d37'; valid.forEach((p, i) => { if (p[1] === null) return; const x = frame.x(i), y = frame.y(p[1]); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
}
function drawDualChart(id, points) {
  const canvas = $(id); if (!canvas) return;
  const valid = points.filter(x => x[1] !== null || x[2] !== null);
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth || 600, h = 260;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  if (!valid.length) { ctx.fillStyle = '#748680'; ctx.font = '14px sans-serif'; ctx.fillText('同日有早晚體重後會顯示日夜比較', 52, 120); return; }
  const values = valid.flatMap(x => [x[1], x[2]]).filter(v => v !== null), min = Math.min(...values, 0) - .2, max = Math.max(...values, .5) + .2;
  const frame = chartFrame(ctx, w, h, min, max, valid.map(x => x[0]), 'kg');
  [['#d87550', 1], ['#6d9d8b', 2]].forEach(([color, index]) => {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); let started = false;
    valid.forEach((p, i) => { if (p[index] === null) return; const x = frame.x(i), y = frame.y(p[index]); started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; });
    ctx.stroke();
  });
}

document.querySelectorAll('.view-tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.view-tab').forEach(x => x.classList.remove('active'));
  button.classList.add('active');
  document.querySelectorAll('.page-view').forEach(x => x.classList.add('hidden'));
  $(button.dataset.view).classList.remove('hidden');
  if (button.dataset.view === 'guideView') updateGuideLock(true);
  else updateGuideLock(false);
  if (button.dataset.view === 'monthView') renderMonth();
  if (button.dataset.view === 'yearView') renderYear();
}));

async function loadAll() {
  if (isDemo() && !paidAccess) { cache = demoRows(); renderMonth(); renderYear(); loadLog($('logDate').value || today()); return; }
  if (!session) return;
  const { data, error } = await supabase.from('daily_logs').select('*').order('log_date', { ascending: true });
  if (error) { toast(error.message); return; }
  cache = data || [];
  renderMonth(); renderYear(); loadLog($('logDate').value || today());
}
updateAuth();


// Collapsible eating-out combinations with paired 211 / 221 choices.
