import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { resolveSupabaseConfig } from './supabase-public.js';

const $ = id => document.getElementById(id);
const STORAGE = 'acha-supabase-config-v1';
const DEMO_STORAGE = 'acha-demo-logs-v2';
const ACCESS_STORAGE = 'acha-verified-email-v1';
const LOCAL_PAID = 'acha_paid';
let supabase = null;
let session = null;
let cache = [];
let paidAccess = false;
let loadAllGen = 0;
let logReadGen = 0;
let logsLoadedFor = '';
let loadAllTimer = 0;

function clearPaidUnlock() {
  paidAccess = false;
  localStorage.removeItem(LOCAL_PAID);
}
function grantPaidUnlock() {
  paidAccess = true;
  localStorage.setItem(LOCAL_PAID, 'true');
}
// Do not trust a stored acha_paid flag. Set it only after session + entitlement succeed.
clearPaidUnlock();

let authSubscription = null;
let initialAuthSettled = false;
let entitlementGeneration = 0;
function currentSupabaseConfig() {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE); } catch (_) { stored = null; }
  return resolveSupabaseConfig(stored);
}

// 裝置本地日期。toISOString 是 UTC，台灣早上 8 點前會變成前一天。
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const today = () => localDateString();
const num = value => (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const moneyDate = d => new Date(`${d}T00:00:00`);
const format = (value, digits = 1) => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
const percent = value => value === null || !Number.isFinite(Number(value)) ? '—' : `${Math.round(Number(value))}%`;

function msg(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('demo-saved-card');
  el.textContent = text;
  el.style.color = error ? '#bd4d3f' : 'var(--accent)';
}
function showDemoSavedCard() {
  const el = $('saveMessage');
  if (!el) return;
  el.style.color = '';
  el.classList.add('demo-saved-card');
  el.innerHTML = '記好了 ✓ 今天這一筆先放這裡。想每天留下來，可以<a href="../#plan">買完整版</a>。';
}
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}
function connect() {
  const c = currentSupabaseConfig();
  if (!c.url || !c.key) {
    supabase = null;
    document.documentElement.dataset.supabaseSource = 'missing';
    return false;
  }
  try {
    authSubscription?.unsubscribe();
    authSubscription = null;
    supabase = createClient(c.url, c.key);
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      session = s;
      // Ignore events until getSession has settled, and don't call Supabase
      // from inside this callback — it still holds the auth lock.
      if (!initialAuthSettled) return;
      setTimeout(() => {
        if (session) verifyPurchaseAccess({ announce: true });
        else { clearPaidUnlock(); updateAuth(); if (isUnlockEntry()) openPurchaseEmailLogin(); }
      }, 0);
    });
    authSubscription = data?.subscription || null;
    document.documentElement.dataset.supabaseSource = c.source;
    try { document.documentElement.dataset.supabaseHost = new URL(c.url).host; } catch (_) { /* host is only a debug marker */ }
    return true;
  } catch (_) {
    supabase = null;
    document.documentElement.dataset.supabaseSource = 'error';
    return false;
  }
}
connect();


const o = (veg, protein, starch, drink = '', fruit = '', hint = '') => ({ veg, protein, starch, drink, fruit, hint, hasVeg: Boolean(veg) });
const mealGuideData = [
  { icon: '☕', title: '早餐', items: [
    ['早安御飯糰組', '趕時間、想吃經典早餐', o('', '茶葉蛋', '御飯糰', '無糖茶'), o('', '茶葉蛋 2 顆', '御飯糰', '無糖茶')],
    ['地瓜豆漿組', '想吃溫熱、預算友善', o('', '茶葉蛋', '現蒸地瓜', '無糖豆漿'), o('', '茶葉蛋', '現蒸地瓜', '高蛋白牛奶')],
    ['雞胸沙拉組', '上午較忙、想先顧蛋白質', o('生菜沙拉', '舒肥雞胸', '小飯糰'), o('生菜沙拉', '舒肥雞胸', '飯糰')],
    ['優格三明治輕食組', '想吃清爽、手邊有三明治', o('', '希臘式優格', '雞肉三明治', '無糖黑咖啡'), o('', '希臘式優格 ＋ 蛋白丁', '雞肉三明治')],
    ['握沙拉捲餅組', '單手好拿、通勤族', o('生菜', '雞肉起司', '捲餅皮', '無糖豆漿'), o('生菜', '雞肉起司 ＋ 茶葉蛋', '捲餅皮', '無糖豆漿')],
    ['經典美式咖啡組', '想喝美式、配個飯糰', o('', '茶葉蛋 1 顆 ＋ 鮪魚', '御飯糰', '美式咖啡'), o('', '茶葉蛋 2 顆 ＋ 鮪魚', '御飯糰', '美式咖啡')],
    ['水果高纖高蛋白組', '茶葉蛋配一根香蕉', o('', '茶葉蛋 2 顆', '', '無糖綠茶', '香蕉 1 根'), o('', '茶葉蛋 2 顆', '', '無糖高纖豆漿', '香蕉 1 根')]
  ]},
  { icon: '🍱', title: '午餐', items: [
    ['超商烤雞餐盒組', '忙碌上班族、懶人首選', o('關東煮蘿蔔', '紐奧良烤雞胸肉 ＋ 鮭魚', '御飯糰'), o('關東煮蘿蔔', '紐奧良烤雞胸肉 ＋ 蛋白丁 ＋ 鮭魚', '御飯糰', '無糖茶')],
    ['溫暖雞湯餐盒組', '天冷想喝湯', o('香菇', '媽媽煮藝雞湯', '雞肉三明治', '', '盒裝芭樂'), o('香菇', '媽媽煮藝雞湯 ＋ 茶葉蛋', '雞肉三明治', '', '盒裝芭樂')],
    ['高蛋白便當組', '高活動量、爆汗日', o('', '烤雞（健身 G 達人）', '白飯 2/3 碗', '無糖綠茶'), o('', '烤雞（健身 G 達人）', '白飯 1 碗', '無糖黑豆漿')],
    ['台式自助餐組', '菜色豐富、想吃原型食物', o('綠色青菜 2 格', '滷雞腿／蒸魚', '白飯半碗'), o('綠色青菜 2 格', '滷雞腿 ＋ 滷蛋 1 顆', '白飯 2/3 碗')],
    ['便當店救援組', '外帶便當、聚餐避雷', o('', '台式滷排骨', '白飯半碗', '無糖烏龍茶', '', '去炸皮'), o('', '台式滷雞腿 ＋ 滷蛋', '白飯 2/3 碗', '無糖烏龍茶')],
    ['涼麵沙拉輕食組', '夏天食欲不振', o('高纖沙拉蔬菜', '鮮蝦', '涼麵'), o('高纖沙拉蔬菜', '鮮蝦 ＋ 茶葉蛋 1 顆', '涼麵', '無糖豆漿')],
    ['湯麵水餃外食組', '想吃小吃攤、麵食族', o('燙青菜', '滷蛋／豆干', '陽春麵', '', '', '少油蔥'), o('燙青菜', '嘴邊肉湯／肝連湯 ＋ 滷蛋', '水餃 8 顆')]
  ]},
  { icon: '🥗', title: '晚餐', items: [
    ['雞腿蔬菜便當組', '下班想吃飽、晚餐首選', o('青菜 2 格', '烤雞腿', '白飯半碗'), o('青菜 2 格', '烤雞腿 ＋ 滷蛋', '白飯 2/3 碗')],
    ['豆腐魚湯組', '想清爽、晚上不想太撐', o('燙青菜', '魚片豆腐湯', '小地瓜'), o('燙青菜', '魚片豆腐湯 ＋ 滷豆腐', '小地瓜')],
    ['火鍋聰明選組', '聚餐火鍋、想安心吃', o('蔬菜盤', '肉片 1 份', '冬粉半份', '無糖茶'), o('蔬菜盤', '肉片 1.5 份 ＋ 豆腐／蛋', '冬粉半份')],
    ['日式定食組', '喜歡魚類、想吃完整一餐', o('沙拉', '烤魚', '白飯半碗', '', '', '附味噌湯'), o('沙拉', '烤魚 ＋ 茶碗蒸', '白飯 2/3 碗', '', '', '附味噌湯')],
    ['滷味自選組', '想吃多樣配料、外帶方便', o('青菜 2 份', '豆干／滷蛋', '玉米或冬粉'), o('青菜 2 份', '雞胸肉 ＋ 豆干／滷蛋', '玉米')],
    ['超商沙拉晚餐組', '加班晚歸、快速解決', o('生菜沙拉', '舒肥雞胸', '烤地瓜'), o('生菜沙拉', '舒肥雞胸 ＋ 茶葉蛋', '烤地瓜')],
    ['粥品小菜組', '胃口較弱、想吃溫熱', o('燙青菜', '滷蛋 ＋ 海鮮', '白粥半碗'), o('燙青菜', '滷蛋 ＋ 海鮮 ＋ 豆腐', '白粥 2/3 碗')]
  ]},
  { icon: '🧁', title: '下午茶', items: [
    ['優格水果組', '嘴饞、想要清爽甜味', o('', '無糖優格', '', '', '小份水果'), o('', '希臘式優格 ＋ 蛋白丁', '', '', '水果')],
    ['茶葉蛋豆漿組', '下午容易餓、配顆茶葉蛋', o('', '茶葉蛋 1 顆', '', '無糖豆漿'), o('', '茶葉蛋 2 顆', '', '高蛋白牛奶')],
    ['咖啡小點組', '想喝咖啡、需要一點能量', o('', '', '小地瓜', '無糖咖啡'), o('', '茶葉蛋', '小地瓜', '無糖咖啡')],
    ['關東煮暖食組', '下午想吃熱的、超商熱食櫃', o('關東煮蘿蔔', '茶葉蛋', '冬粉一小份', '無糖茶'), o('關東煮蘿蔔', '茶葉蛋 ＋ 豆干', '冬粉一小份', '無糖茶')],
    ['毛豆茶葉蛋組', '想配一份小菜、毛豆配茶葉蛋', o('毛豆', '茶葉蛋 1 顆', '', '無糖茶'), o('毛豆', '茶葉蛋 2 顆', '', '無糖豆漿')]
  ]},
  { icon: '🌙', title: '宵夜', items: [
    ['溫豆漿輕食組', '晚睡、需要溫熱飲品', o('', '茶葉蛋 1 顆', '', '無糖豆漿'), o('', '茶葉蛋 1 顆', '', '高蛋白牛奶')],
    ['小地瓜蛋白組', '晚一點想吃點地瓜', o('', '無糖優格', '小地瓜'), o('', '茶葉蛋', '小地瓜', '高蛋白牛奶')],
    ['清湯豆腐組', '嘴饞但不想太有負擔', o('清湯蔬菜', '豆腐', '', '無糖茶'), o('清湯蔬菜', '豆腐 ＋ 滷蛋', '', '無糖茶')],
    ['鹽水雞組', '夜市想吃熱的、蔬菜可以多夾', o('高麗菜與豆芽', '鹽水雞肉', '', '無糖茶'), o('高麗菜與豆芽', '鹽水雞肉 ＋ 豆干', '', '無糖茶')]
  ]}
];
const VEG_TIP = '🌱 這組沒有蔬菜，方便的話可以加一份燙青菜或沙拉就很好囉';
function slotFood(value) {
  return value ? value : '（無）';
}
function editionSlots(opt, edition) {
  const rows = [
    ['🥬', '蔬菜', opt.veg],
    ['🍳', '蛋白質', opt.protein],
    ['🍚', '澱粉', opt.starch]
  ].map(([icon, label, value]) => `<p class="food-slot meal-edition" data-edition="${edition}"><span class="food-slot-icon" aria-hidden="true">${icon}</span><span class="food-slot-label">${label}</span><span class="food-slot-food${value ? '' : ' is-empty'}">${slotFood(value)}</span></p>`).join('');
  const fruit = opt.fruit ? `<p class="meal-fruit-note meal-edition" data-edition="${edition}">水果：${opt.fruit}</p>` : '';
  const hint = opt.hint ? `<p class="meal-hint-note meal-edition" data-edition="${edition}">${opt.hint}</p>` : '';
  const tip = opt.hasVeg ? '' : `<p class="meal-veg-note meal-edition" data-edition="${edition}">${VEG_TIP}</p>`;
  const drink = opt.drink ? `<p class="meal-drink-note meal-edition" data-edition="${edition}">飲品：${opt.drink}</p>` : '';
  return rows + fruit + hint + tip + drink;
}
function renderMealGuide() {
  const root = $('mealGuideAccordion');
  if (!root) return;
  if (!root.previousElementSibling?.classList.contains('edition-toggle')) {
    const bar = document.createElement('div');
    bar.className = 'edition-toggle';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', '211 或 221');
    bar.innerHTML = '<button type="button" class="is-on" data-edition="211" aria-pressed="true">211 一般</button><button type="button" data-edition="221" aria-pressed="false">221 健身</button>';
    bar.addEventListener('click', event => {
      const button = event.target.closest('button[data-edition]');
      if (!button) return;
      document.documentElement.dataset.guideEdition = button.dataset.edition;
      bar.querySelectorAll('button[data-edition]').forEach(el => {
        const on = el === button;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
    root.before(bar);
  }
  root.innerHTML = mealGuideData.map((group, groupIndex) => `
    <details class="meal-guide-group" ${groupIndex === 0 ? 'open' : ''}>
      <summary><span class="meal-guide-group-title">${group.icon} ${group.title} <small>｜ ${group.items.length}組</small></span><span class="meal-guide-chevron">⌄</span></summary>
      <div class="meal-guide-items">
        ${group.items.map((item, index) => `
          <article class="meal-combo-card">
            <div class="meal-combo-head"><span class="meal-combo-name">${String(index + 1).padStart(2, '0')} ｜ ${item[0]}</span><span class="meal-combo-tag">${item[1]}</span></div>
            ${editionSlots(item[2], '211')}${editionSlots(item[3], '221')}
          </article>`).join('')}
      </div>
    </details>`).join('');
}

renderMealGuide();

function isDemo() { return new URLSearchParams(location.search).has('demo'); }
function isUnlockEntry() { return new URLSearchParams(location.search).get('unlock') === '1'; }
function isDebugEntry() { return new URLSearchParams(location.search).get('debug') === '1'; }
function isGuideShowcase() {
  const params = new URLSearchParams(location.search);
  return isDemo() && (params.get('showcase') === 'guide' || params.get('view') === 'guide');
}
function sampleKind() {
  const sample = new URLSearchParams(location.search).get('sample');
  return sample === 'year' || sample === 'month' ? sample : '';
}
// 示範只給「想看月／年長什麼樣子」的人。今天不預填，體重在一個區間晃，不做成往下掉的曲線。
function demoSeed() {
  const rows = [];
  for (let ago = 13; ago >= 1; ago -= 1) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ago);
    const i = 13 - ago;
    const date = localDateString(d);
    const morning = 62.6 + ((i % 5) - 2) * 0.2;
    const minutes = i % 4 === 0 ? 0 : (i % 3 === 0 ? 20 : 35);
    const exercise = minutes > 0 ? (i % 2 ? '快走' : '瑜伽／伸展') : '沒有運動';
    rows.push({
      log_date: date,
      morning_weight: Number(morning.toFixed(1)),
      evening_weight: Number((morning + 0.4 + (i % 3) * 0.1).toFixed(1)),
      waist_cm: Number((78.4 + ((i % 3) - 1) * 0.3).toFixed(1)),
      hip_cm: 98,
      age_years: 32,
      height_cm: 162,
      reference_sex: 'female',
      sleep_hours: Number((6.4 + (i % 5) * 0.3).toFixed(1)),
      plate_pattern: i % 4 === 0 ? '221' : '211',
      eating_out_count: i % 5 === 0 ? 1 : 2,
      protein_status: i % 5 === 0 ? '普通' : '足夠',
      vegetables_status: i % 6 === 0 ? '普通' : '足夠',
      exercise,
      exercise_minutes: minutes,
      water_ml: 1600 + (i % 4) * 200,
      slept_well: i % 4 !== 0,
      bowel_movement: i % 5 !== 0,
      meals: { breakfast: { food: '無糖豆漿＋蛋' }, lunch: { food: '雞腿便當，飯半碗' }, dinner: { food: '豆腐蔬菜湯＋地瓜' } },
      notes: '示範資料，不是你的紀錄'
    });
  }
  return rows;
}
function demoRows() {
  const sample = sampleKind();
  if (sample === 'year') return richDemoRows();
  if (sample === 'month') return demoSeed();
  return [];
}
// ?demo=1&sample=year 用今年的示範紀錄看完整月／年；?ig=month 或 ?ig=year 只顯示分享圖。
function richDemoRows() {
  const rows = [];
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const cursor = new Date(end.getFullYear(), 0, 1, 12);
  let index = 0;
  while (cursor < end) {
    const month = cursor.getMonth();
    const day = cursor.getDate();
    const skip = month <= 7 && (day + month) % 6 === 0;
    if (!skip) {
      const morning = 63.1 + ((day % 5) - 2) * 0.22 + ((month % 3) - 1) * 0.15;
      const evening = morning + 0.45 + (day % 3) * 0.15;
      const sweetBreakfast = (month === 8 && day % 2 === 0) || (month !== 8 && day % 5 === 0);
      const breakfastDrink = sweetBreakfast ? (day % 2 ? '含糖飲料' : '奶茶') : (day % 3 === 0 ? '無糖茶' : '白開水');
      const dinner = day % 9 === 0
        ? { food: '豆腐蔬菜湯＋地瓜', drink: '拿鐵（含抹茶拿鐵）', drinkSweetness: '半糖' }
        : { food: '豆腐蔬菜湯＋地瓜', drink: '白開水' };
      rows.push({
        log_date: `${cursor.getFullYear()}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        morning_weight: Number(morning.toFixed(1)),
        evening_weight: Number(evening.toFixed(1)),
        waist_cm: Number((79.2 + ((day % 4) - 1.5) * 0.25).toFixed(1)),
        hip_cm: 98,
        age_years: 32,
        height_cm: 162,
        reference_sex: 'female',
        sleep_hours: Number((6.1 + (day % 5) * 0.4).toFixed(1)),
        plate_pattern: day % 4 === 0 ? '221' : '211',
        eating_out_count: day % 6 === 0 ? 0 : (day % 5 === 0 ? 2 : 1),
        protein_status: day % 5 === 0 ? '普通' : '足夠',
        vegetables_status: day % 6 === 0 ? '普通' : '足夠',
        exercise: day % 4 === 0 ? '沒有運動' : '快走',
        exercise_minutes: day % 4 === 0 ? 0 : 30,
        water_ml: Math.round(morning * 40 * (day % 3 === 0 ? 0.72 : 1.05)),
        slept_well: day % 4 !== 0,
        bowel_movement: day % 5 !== 0,
        meals: {
          breakfast: { food: '無糖豆漿＋蛋', drink: breakfastDrink },
          lunch: { food: '雞腿便當，飯半碗', drink: day % 7 === 0 ? '果汁' : '無糖茶' },
          dinner
        },
        notes: '示範資料，不是你的紀錄'
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    index += 1;
  }
  return rows;
}
function preferSampleMonth() {
  if (preferSampleMonth.done) return;
  if (new URLSearchParams(location.search).get('sample') !== 'year') return;
  let best = '';
  const counts = new Map();
  cache.forEach(row => {
    const key = String(row.log_date || '').slice(0, 7);
    if (key.length === 7) counts.set(key, (counts.get(key) || 0) + 1);
  });
  counts.forEach((count, key) => { if (count >= 20 && key > best) best = key; });
  if (best && $('monthPicker')) $('monthPicker').value = best;
  preferSampleMonth.done = true;
}
function saveDemoRows() { /* 免費體驗資料只存在記憶體，重新載入頁面即重置 */ }
function syncGuideTeaser(on) {
  const accordion = $('mealGuideAccordion');
  if (!accordion) return;
  const existing = accordion.querySelector('.guide-teaser-lock');
  if (existing) {
    const card = existing.querySelector('.meal-combo-card');
    if (card) {
      card.classList.remove('is-teaser-peek');
      existing.before(card);
    }
    existing.remove();
  }
  accordion.querySelectorAll('.is-teaser-rest').forEach(card => card.classList.remove('is-teaser-rest'));
  if (!on) return;
  const firstGroup = accordion.querySelector('.meal-guide-group');
  const items = firstGroup?.querySelector('.meal-guide-items');
  if (firstGroup) firstGroup.open = true;
  const cards = items ? [...items.querySelectorAll('.meal-combo-card')] : [];
  cards.forEach((card, index) => {
    if (index > 1) card.classList.add('is-teaser-rest');
  });
  const peek = cards[1];
  if (!peek) return;
  const lock = document.createElement('div');
  lock.className = 'guide-teaser-lock';
  peek.classList.add('is-teaser-peek');
  peek.before(lock);
  lock.appendChild(peek);
  const label = document.createElement('span');
  label.textContent = '🔒 其他組合在完整版';
  lock.appendChild(label);
}
function updateGuideLock(show = false) {
  const locked = !paidAccess && !isGuideShowcase();
  const teaser = locked && isDemo() && show;
  const modal = locked && show && !teaser;
  const content = $('guideLockedContent'), wall = $('guidePaywall');
  if (content) content.classList.toggle('is-guide-locked', modal);
  if (wall) {
    wall.classList.toggle('hidden', !(modal || teaser));
    wall.setAttribute('aria-modal', modal ? 'true' : 'false');
    wall.setAttribute('role', teaser ? 'region' : 'dialog');
  }
  document.documentElement.classList.toggle('is-guide-paywall', modal);
  document.documentElement.classList.toggle('is-guide-teaser', teaser);
  syncGuideTeaser(teaser);
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
function syncSaveCloudHint() {
  const hint = $('saveCloudHint');
  if (!hint) return;
  hint.hidden = !!paidAccess;
}
function syncDemoHint(demo) {
  const link = $('sampleMonthLink');
  if (!link) return;
  link.hidden = !(demo && !sampleKind());
}
function updateAccessStrip(demo) {
  const strip = $('accessStrip'), badge = $('accessBadge'), buy = $('accessBuy');
  if (!strip || !badge || !buy) return;
  const authVisible = $('authView') && !$('authView').classList.contains('hidden');
  strip.classList.toggle('is-paid', paidAccess);
  if (paidAccess || authVisible || (!demo && !isGuideShowcase())) {
    strip.hidden = true;
    return;
  }
  strip.hidden = false;
  buy.hidden = false;
  buy.classList.add('buy-btn');
  if (isGuideShowcase()) {
    badge.textContent = '外食建議展示模式 ｜ 僅供截圖參考';
    buy.textContent = 'NT$ 99 買完整版';
  } else {
    badge.textContent = '免費體驗中・換頁會重置';
    buy.textContent = 'NT$ 99 買完整版';
  }
}
function dismissPurchaseModal() {
  $('purchaseAuthModal')?.classList.add('hidden');
  syncUnlockBackdrop();
  const el = $('purchaseAuthMessage');
  if (!el) return;
  el.textContent = '';
  el.style.color = '';
}
async function verifyPurchaseAccess({ announce = false, retried = false } = {}) {
  const gen = ++entitlementGeneration;
  const current = session;
  const sessionKey = current?.user?.id || current?.user?.email || '';
  if (!supabase || !current) {
    if (gen !== entitlementGeneration) return false;
    clearPaidUnlock();
    updateAuth();
    return false;
  }
  let data = null;
  let error = null;
  try {
    const result = await supabase.rpc('has_active_acha_entitlement');
    data = result.data;
    error = result.error;
  } catch (err) {
    error = err;
  }
  if (gen !== entitlementGeneration) return paidAccess;
  const stillSignedIn = !!session && (session.user?.id || session.user?.email || '') === sessionKey;
  if (!stillSignedIn) { clearPaidUnlock(); updateAuth(); return false; }
  if (error && !retried) {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (gen !== entitlementGeneration) return paidAccess;
    return verifyPurchaseAccess({ announce, retried: true });
  }
  if (!error && data === true) {
    grantPaidUnlock();
    try { localStorage.setItem(ACCESS_STORAGE, session.user.email || ''); } catch (_) { /* keep the unlocked session */ }
    dismissPurchaseModal();
  } else {
    clearPaidUnlock();
    if (announce && isUnlockEntry()) {
      const text = error
        ? '還沒確認到開通。去 Portaly 看訂單，或加 LINE 跟阿茶說一聲。'
        : '這個 Email 還沒有開通紀錄。去 Portaly 買，或加 LINE 跟阿茶領取。';
      msg('purchaseAuthMessage', text, true);
      $('purchaseAuthModal')?.classList.remove('hidden');
    }
  }
  updateAuth();
  return paidAccess;
}
async function bootstrapAuth() {
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const restored = data?.session ?? null;
      if (restored) session = restored;
      else if (!session) session = null;
    }
  } catch (_) { /* onAuthStateChange may already have the session */ }
  if (session) await verifyPurchaseAccess({ announce: true });
  else clearPaidUnlock();
  initialAuthSettled = true;
  if (paidAccess) dismissPurchaseModal();
  else if (isUnlockEntry() && !session) openPurchaseEmailLogin();
  updateAuth();
}
function updateAuth() {
  const demo = isDemo() && !paidAccess;
  const accessible = paidAccess || demo;
  $('authView').classList.toggle('hidden', accessible);
  $('mainView').classList.toggle('hidden', !accessible);
  $('logoutBtn').classList.toggle('hidden', !session);
  $('userLabel').textContent = paidAccess ? (session?.user?.email || '正式版已解鎖') : demo ? '免費體驗，先記一餐' : (session?.user?.email || '外食也行・先記一餐就好');
  updateAccessStrip(demo);
  document.documentElement.classList.toggle('is-free-trial', demo);
  syncDemoHint(demo);
  updateGuideLock(false);
  syncUnlockEntry();
  syncUnlockBackdrop();
  syncSaveCloudHint();
  if (paidAccess) dismissPurchaseModal();
  if (!accessible && session) msg('authMessage', '這個帳號還沒開通。去 Portaly 買，或加 LINE 跟阿茶領取。填 Email 不會直接開通。', true);
  if (accessible) {
    $('logDate').value = $('logDate').value || today();
    scheduleLoadAll();
  } else dropLogReads();
  updateWaterHint();
}

async function auth(mode) {
  if (!supabase) { msg('authMessage', '連線還沒準備好，請重新整理後再試。', true); return; }
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
$('logoutBtn').addEventListener('click', async () => {
  try { await supabase?.auth.signOut(); } catch (_) { /* still drop the local unlock */ }
  session = null;
  clearPaidUnlock();
  dropLogReads();
  updateAuth();
});
$('demoBtn').addEventListener('click', () => { const u = new URL(location.href); u.searchParams.set('demo', '1'); location.href = u.toString(); });
// 頂端大顆「已購買？Email 登入」與付費牆那顆維持關閉。
// 一般網址與 ?unlock=1 都用同一組購買 Email 視窗寄驗證連結。
// 只填 Email 不會寫入 acha_paid；要登入後有有效權益才會打開。
function hidePurchaseEmailEntry() {
  ['purchaseLoginBtn', 'paywallEmailBtn'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.hidden = true;
    el.disabled = true;
    el.classList.add('hidden');
  });
}
function syncUnlockBackdrop() {
  const modal = $('purchaseAuthModal');
  const open = !!(modal && !modal.classList.contains('hidden') && isUnlockEntry() && !paidAccess);
  document.documentElement.classList.toggle('is-unlock-entry', open);
}
function openPurchaseEmailLogin() {
  $('purchaseAuthModal')?.classList.remove('hidden');
  syncUnlockBackdrop();
  $('purchaseEmail')?.focus();
}
function setEntryVisible(id, show) {
  const el = $(id);
  if (!el) return;
  el.hidden = !show;
  el.disabled = !show;
  el.classList.toggle('hidden', !show);
}
function syncUnlockEntry() {
  const showLogin = !paidAccess;
  setEntryVisible('unlockEmailLink', showLogin);
  setEntryVisible('authUnlockEmailBtn', showLogin);
  setEntryVisible('paywallUnlockLink', !paidAccess);
}
function syncDebugGear() {
  const show = isDebugEntry();
  setEntryVisible('configBtn', show);
  if (!show) $('configView')?.classList.add('hidden');
}
hidePurchaseEmailEntry();
syncUnlockEntry();
syncDebugGear();
$('unlockEmailLink')?.addEventListener('click', openPurchaseEmailLogin);
$('authUnlockEmailBtn')?.addEventListener('click', openPurchaseEmailLogin);
$('paywallUnlockLink')?.addEventListener('click', openPurchaseEmailLogin);
$('purchaseLoginBtn').addEventListener('click', openPurchaseEmailLogin);
$('closePurchaseAuth').addEventListener('click', () => { $('purchaseAuthModal').classList.add('hidden'); syncUnlockBackdrop(); });
$('purchaseAuthModal').addEventListener('click', e => { if (e.target.id === 'purchaseAuthModal') { e.currentTarget.classList.add('hidden'); syncUnlockBackdrop(); } });
// Built-in Supabase email is a project-wide cap (2 sends/hour). Say that in Chinese
// when the send is rate-limited; other send failures keep the existing wording.
function isEmailOtpRateLimit(error) {
  const status = Number(error?.status);
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  const message = String(error?.message || error?.msg || '').toLowerCase();
  if (status === 429 || Number(code) === 429) return true;
  if (code.includes('rate_limit') || code.includes('over_email_send') || code.includes('over_request_rate')) return true;
  return /rate limit|too many requests|for security purposes|only request this/.test(message);
}
function purchaseOtpSendErrorText(error) {
  if (isEmailOtpRateLimit(error)) {
    return '為了帳號安全，登入信每小時最多重寄 2 次。若提示寄太多次，請等約 1 小時再按寄送。只填 Email 不會開通。去 Portaly 買，或加 LINE 跟阿茶領取。';
  }
  return `${error.message} 只填 Email 不會開通。去 Portaly 買，或加 LINE 跟阿茶領取。`;
}
$('purchaseAuthForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('purchaseEmail').value.trim().toLowerCase();
  if (!email) return;
  clearPaidUnlock();
  if (!supabase) {
    msg('purchaseAuthMessage', '驗證連結還沒寄出。請重新整理後再試一次。只填 Email 不會開通。', true);
    return;
  }
  const redirect = new URL(location.href);
  redirect.hash = '';
  if (isUnlockEntry()) redirect.searchParams.set('unlock', '1');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString() } });
  if (error) {
    clearPaidUnlock();
    msg('purchaseAuthMessage', purchaseOtpSendErrorText(error), true);
    return;
  }
  msg('purchaseAuthMessage', '驗證連結已寄出。點開信裡的連結，確認有開通紀錄後才會打開。清除瀏覽資料會被登出，重新登入就好，紀錄都在雲端。');
});
$('paywallEmailBtn')?.addEventListener('click', openPurchaseEmailLogin);
$('closeGuidePaywall')?.addEventListener('click', closeGuidePaywall);
$('returnTodayFromPaywall')?.addEventListener('click', closeGuidePaywall);
$('guidePaywall')?.addEventListener('click', e => { if (e.target.id === 'guidePaywall') closeGuidePaywall(); });
$('paywallDemoLink')?.addEventListener('click', event => {
  if (!isDemo() || paidAccess) return;
  event.preventDefault();
  switchToTodayFromPaywall();
});
function fillConfigForm() {
  const saved = currentSupabaseConfig();
  const usingOverride = saved.source === 'override';
  $('supabaseUrl').value = usingOverride ? saved.url : '';
  $('supabaseKey').value = usingOverride ? saved.key : '';
  const note = $('configBuiltinNote');
  if (note) {
    note.textContent = usingOverride
      ? '目前用的是這台瀏覽器存過的覆寫。一般不用改；要恢復公開連線就按「改回內建連線」。'
      : '已經接上內建公開連線，購買不用在這裡貼金鑰。只有要改連別的專案時才填，會存在這台瀏覽器。';
  }
}
function setupConfigPanel() {
  const card = $('configView')?.querySelector('.modal-card');
  const anchor = card?.querySelector('p');
  if (card && anchor && !$('configBuiltinNote')) {
    const note = document.createElement('p');
    note.id = 'configBuiltinNote';
    note.className = 'subtle';
    anchor.before(note);
    const reset = document.createElement('button');
    reset.id = 'resetConfig';
    reset.type = 'button';
    reset.className = 'secondary full';
    reset.textContent = '改回內建連線';
    reset.style.marginTop = '8px';
    $('saveConfig')?.after(reset);
    reset.addEventListener('click', () => {
      try { localStorage.removeItem(STORAGE); } catch (_) { /* keep the baked client */ }
      $('supabaseUrl').value = '';
      $('supabaseKey').value = '';
      const ok = connect();
      fillConfigForm();
      msg('configMessage', ok ? '已改回內建連線。' : '內建連線沒接上，請重新整理。', !ok);
      if (ok) setTimeout(() => { $('configView').classList.add('hidden'); updateAuth(); }, 700);
    });
  }
  fillConfigForm();
}
setupConfigPanel();
$('configBtn').addEventListener('click', () => {
  if (!isDebugEntry()) return;
  fillConfigForm();
  $('configView').classList.remove('hidden');
});
$('closeConfig').addEventListener('click', () => $('configView').classList.add('hidden'));
$('saveConfig').addEventListener('click', () => {
  const url = $('supabaseUrl').value.trim().replace(/\/$/, '');
  const key = $('supabaseKey').value.trim();
  if (!url || !key) { msg('configMessage', '請填寫兩個欄位。', true); return; }
  try { localStorage.setItem(STORAGE, JSON.stringify({ url, key })); }
  catch (_) { msg('configMessage', '這台瀏覽器存不了覆寫，請再試一次。', true); return; }
  const ok = connect();
  fillConfigForm();
  msg('configMessage', ok ? '覆寫已存好，已重新連線。' : '這組連線沒接上，請再看一次網址和金鑰。', !ok);
  if (ok) setTimeout(() => { $('configView').classList.add('hidden'); updateAuth(); }, 700);
});

const MEAL_PREFIXES = ['breakfast', 'lunch', 'dinner'];
const MEAL_FIELDS = ['Type', 'TypeOther', 'Drink', 'DrinkOther', 'DrinkSweetness', 'Food', 'Note'];
const SUGARY_DRINKS = new Set(['含糖飲料', '拿鐵（含抹茶拿鐵）', '奶茶', '果汁']);
const QUICK_DRINKS = new Set(['白開水', '無糖茶', '無糖咖啡', '含糖飲料', '無糖豆漿', '牛奶', '拿鐵（含抹茶拿鐵）', '奶茶', '果汁', '湯', '酒精']);
const ids = [
  'morningWeight', 'eveningWeight', 'waistCm', 'hipCm', 'bodyFatPct', 'sleepHours', 'ageYears', 'heightCm', 'referenceSex', 'mood',
  'breakfastType', 'breakfastTypeOther', 'breakfastDrink', 'breakfastDrinkOther', 'breakfastDrinkSweetness', 'breakfastFood', 'breakfastNote',
  'lunchType', 'lunchTypeOther', 'lunchDrink', 'lunchDrinkOther', 'lunchDrinkSweetness', 'lunchFood', 'lunchNote',
  'dinnerType', 'dinnerTypeOther', 'dinnerDrink', 'dinnerDrinkOther', 'dinnerDrinkSweetness', 'dinnerFood', 'dinnerNote',
  'platePattern', 'eatingOutCount', 'proteinStatus', 'vegetablesStatus',
  'exercise', 'exerciseMinutes', 'waterMl', 'drinks', 'drinksOther', 'sleptWell', 'bowelMovement', 'notes'
];
const val = id => { const el = $(id); return el.type === 'checkbox' ? el.checked : el.value; };
// 資料庫 check 允許 null、拒絕空字串。選填空白要存成 null。
const blankToNull = value => typeof value === 'string' && value.trim() === '' ? null : value;
function ensureOption(el, value) {
  const text = value == null ? '' : String(value);
  if (text && ![...el.options].some(option => option.value === text)) {
    const option = document.createElement('option');
    option.value = text;
    option.textContent = text;
    option.dataset.legacy = '1';
    el.appendChild(option);
  }
  el.value = text;
}
function syncMealFields(prefix) {
  const type = $(`${prefix}Type`)?.value || '';
  const drink = $(`${prefix}Drink`)?.value || '';
  $(`${prefix}TypeOtherWrap`)?.classList.toggle('hidden', type !== '其他');
  $(`${prefix}DrinkOtherWrap`)?.classList.toggle('hidden', drink !== '其他');
  $(`${prefix}DrinkSweetnessWrap`)?.classList.toggle('hidden', !SUGARY_DRINKS.has(drink));
}
function syncAllMealFields() { MEAL_PREFIXES.forEach(syncMealFields); }
function syncQuickDrink() {
  const drink = $('drinks')?.value || '';
  $('drinksOtherWrap')?.classList.toggle('hidden', drink !== '其他');
}
function quickDrinkValue() {
  const drink = val('drinks');
  if (drink !== '其他') return blankToNull(drink);
  const other = String(val('drinksOther') || '').trim();
  return other || '其他';
}
function fillQuickDrink(value) {
  const select = $('drinks');
  const other = $('drinksOther');
  if (!select) return;
  const text = value == null ? '' : String(value);
  if (!text || QUICK_DRINKS.has(text)) {
    select.value = text;
    if (other) other.value = '';
  } else if (text === '其他') {
    select.value = '其他';
    if (other) other.value = '';
  } else {
    select.value = '其他';
    if (other) other.value = text;
  }
  syncQuickDrink();
}
function mealRecord(prefix) {
  const type = val(`${prefix}Type`);
  const drink = val(`${prefix}Drink`);
  return {
    type: blankToNull(type),
    typeOther: type === '其他' ? blankToNull(val(`${prefix}TypeOther`)) : null,
    drink: blankToNull(drink),
    drinkOther: drink === '其他' ? blankToNull(val(`${prefix}DrinkOther`)) : null,
    drinkSweetness: SUGARY_DRINKS.has(drink) ? blankToNull(val(`${prefix}DrinkSweetness`)) : null,
    food: blankToNull(val(`${prefix}Food`)),
    note: blankToNull(val(`${prefix}Note`))
  };
}
function resetMealFields() {
  MEAL_PREFIXES.forEach(prefix => MEAL_FIELDS.forEach(suffix => {
    const el = $(`${prefix}${suffix}`);
    if (!el) return;
    if (el.tagName === 'SELECT') el.querySelectorAll('option[data-legacy]').forEach(option => option.remove());
    el.value = '';
  }));
}

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
    reference_sex: blankToNull(val('referenceSex')),
    meals: {
      breakfast: mealRecord('breakfast'),
      lunch: mealRecord('lunch'),
      dinner: mealRecord('dinner')
    },
    plate_pattern: blankToNull(val('platePattern')),
    eating_out_count: Number(val('eatingOutCount') || 0),
    protein_status: val('proteinStatus'),
    vegetables_status: val('vegetablesStatus'),
    drinks: quickDrinkValue(),
    exercise: val('exercise'),
    exercise_minutes: Number(val('exerciseMinutes') || 0),
    water_ml: Number(val('waterMl') || 0),
    slept_well: val('sleptWell'),
    bowel_movement: val('bowelMovement'),
    mood: val('mood') ? Number(val('mood')) : null,
    notes: blankToNull(val('notes'))
  };
}
function fill(d) {
  const map = {
    morningWeight: d?.morning_weight ?? '', eveningWeight: d?.evening_weight ?? '', waistCm: d?.waist_cm ?? '', hipCm: d?.hip_cm ?? '', bodyFatPct: d?.body_fat_pct ?? '', sleepHours: d?.sleep_hours ?? '',
    ageYears: d?.age_years ?? '', heightCm: d?.height_cm ?? '', referenceSex: d?.reference_sex ?? '', mood: d?.mood ?? '',
    platePattern: d?.plate_pattern ?? '', eatingOutCount: d?.eating_out_count ?? 0, proteinStatus: d?.protein_status ?? '',
    vegetablesStatus: d?.vegetables_status ?? '', exercise: d?.exercise ?? '沒有運動',
    exerciseMinutes: d?.exercise_minutes ?? '', waterMl: d?.water_ml ?? '', notes: d?.notes ?? ''
  };
  Object.entries(map).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
  fillQuickDrink(d?.drinks ?? '');
  ['sleptWell', 'bowelMovement'].forEach(id => { $(id).checked = !!d?.[id === 'sleptWell' ? 'slept_well' : 'bowel_movement']; });
  resetMealFields();
  Object.entries(d?.meals || {}).forEach(([meal, m]) => Object.entries(m || {}).forEach(([key, value]) => {
    const el = $(`${meal}${key[0].toUpperCase()}${key.slice(1)}`);
    if (!el) return;
    if (el.tagName === 'SELECT') ensureOption(el, value || '');
    else el.value = value || '';
  }));
  syncAllMealFields();
  updateWaterHint();
  updateProgress();
}
async function loadLog(date) {
  const gen = ++logReadGen;
  if (isDemo() && !paidAccess) {
    fill(cache.find(row => row.log_date === date) || {});
    return;
  }
  if (!session || !supabase) return;
  const userId = session.user?.id || '';
  if (logsLoadedFor && logsLoadedFor === userId) {
    if (gen !== logReadGen) return;
    if (($('logDate').value || '') !== date) return;
    fill(cache.find(row => row.log_date === date) || {});
    return;
  }
  const { data, error } = await supabase.from('daily_logs').select('*').eq('log_date', date).maybeSingle();
  if (gen !== logReadGen) return;
  if (!session || (session.user?.id || '') !== userId) return;
  if (($('logDate').value || '') !== date) return;
  if (error) { msg('saveMessage', error.message, true); return; }
  fill(data || {});
}
$('logDate').value = today();
$('logDate').addEventListener('change', () => loadLog($('logDate').value));
ids.forEach(id => {
  const el = $(id);
  if (!el) return;
  const refresh = () => { updateProgress(); updateWaterHint(); syncAllMealFields(); syncQuickDrink(); };
  el.addEventListener('input', refresh);
  if (el.tagName === 'SELECT') el.addEventListener('change', refresh);
});
syncAllMealFields();

function companionStats(rows = cache) {
  const dates = new Set(rows.map(row => row.log_date).filter(Boolean));
  const todayDate = today();
  let cursor = todayDate, streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = prevDate(cursor);
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

function todayLoggedBits(x) {
  const bits = [];
  const meals = num(x?.eating_out_count);
  if (meals) bits.push(`記了 ${meals} 餐外食`);
  if (x?.plate_pattern) bits.push(`餐盤 ${x.plate_pattern}`);
  if (x?.protein_status) bits.push(`蛋白質${x.protein_status}`);
  if (x?.vegetables_status) bits.push(`蔬菜${x.vegetables_status}`);
  const water = num(x?.water_ml);
  if (water) bits.push(`喝水 ${water} ml`);
  const minutes = num(x?.exercise_minutes);
  if (minutes) bits.push(`運動 ${minutes} 分鐘`);
  else if (x?.exercise && x.exercise !== '沒有運動') bits.push(x.exercise);
  if (x?.drinks) bits.push(x.drinks);
  if (x?.slept_well) bits.push('有早睡');
  if (x?.bowel_movement) bits.push('有排便');
  const morning = num(x?.morning_weight);
  if (morning !== null) bits.push(`早上 ${format(morning)} kg`);
  return bits;
}
function todayLoggedSentence(x) {
  const bits = todayLoggedBits(x);
  return bits.length ? `今天${bits.join('、')}。` : '';
}
function weekLoggedCount(anchor = $('logDate')?.value || today()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return 0;
  const start = new Date(`${anchor}T12:00:00`);
  start.setDate(start.getDate() - start.getDay());
  const startKey = localDateString(start);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const endKey = localDateString(end);
  const dates = new Set(cache.map(row => row.log_date).filter(date => date && date >= startKey && date <= endKey));
  if (anchor === ($('logDate')?.value || today()) && todayLoggedBits(formData()).length) dates.add(anchor);
  return dates.size;
}
function updateProgress() {
  const sentence = todayLoggedSentence(formData());
  const week = weekLoggedCount();
  const weekEl = $('weekCountLine');
  const todayEl = $('todayCountLine');
  const card = $('companionProgress');
  if (weekEl) {
    weekEl.hidden = week < 1;
    weekEl.textContent = week > 0 ? `這週記了 ${week} 天` : '';
  }
  if (todayEl) {
    todayEl.hidden = !sentence;
    todayEl.textContent = sentence;
  }
  if (card) card.hidden = week < 1 && !sentence;
  renderTodayCalendar();
}
const bodyDataDetails = $('bodyDataDetails');
bodyDataDetails?.addEventListener('invalid', () => { bodyDataDetails.open = true; }, true);
const mealDetails = $('mealDetails');
mealDetails?.addEventListener('invalid', () => { mealDetails.open = true; }, true);
$('logForm').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = formData();
  if (isDemo() && !paidAccess) {
    cache = cache.filter(x => x.log_date !== payload.log_date);
    cache.push({ ...payload, id: `demo-${payload.log_date}` });
    cache = sortRows(cache);
    saveDemoRows();
    showDemoSavedCard();
    toast('記好了');
    updateProgress();
    renderMonth(); renderYear();
    return;
  }
  if (!session) { msg('saveMessage', '請先登入。', true); return; }
  const { error } = await supabase.from('daily_logs').upsert({ ...payload, user_id: session.user.id }, { onConflict: 'user_id,log_date' });
  if (error) msg('saveMessage', error.message, true);
  else {
    msg('saveMessage', '已儲存今天的記錄。');
    toast('今天的記錄已儲存');
    clearTimeout(loadAllTimer);
    loadAllTimer = 0;
    loadAll();
  }
});

function sortRows(rows) { return [...rows].sort((a, b) => a.log_date.localeCompare(b.log_date)); }
function rowByDate(date) { return cache.find(x => x.log_date === date); }
function dayIncrease(row) {
  const morning = num(row?.morning_weight), evening = num(row?.evening_weight);
  return morning !== null && evening !== null ? evening - morning : null;
}
function sleepChange(row) {
  if (!row?.log_date) return null;
  const prev = rowByDate(prevDate(row.log_date));
  const lastNight = num(prev?.evening_weight), morning = num(row.morning_weight);
  return lastNight !== null && morning !== null ? morning - lastNight : null;
}
function signedKg(value) {
  return `${value > 0 ? '+' : ''}${format(value)} kg`;
}
function weightChangeBits(row) {
  const bits = [];
  const day = dayIncrease(row), sleep = sleepChange(row);
  if (day !== null) bits.push(`白天變化 ${signedKg(day)}`);
  if (sleep !== null) bits.push(`睡一覺變化 ${signedKg(sleep)}`);
  return bits;
}
function waistHip(row) {
  const waist = num(row?.waist_cm), hip = num(row?.hip_cm);
  return waist !== null && hip > 0 ? waist / hip : null;
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
    avgWaterPct: avg(rows.map(waterPct).filter(v => v !== null)),
    avgDayIncrease: avg(rows.map(dayIncrease).filter(v => v !== null)),
    avgSleepChange: avg(rows.map(sleepChange).filter(v => v !== null)),
    out: rows.reduce((n, x) => n + Number(x.eating_out_count || 0), 0),
    exercise: rows.filter(x => num(x.exercise_minutes) > 0).length,
    checks,
    habit: rows.length ? Math.round(total / (rows.length * 6) * 100) : 0
  };
}
const SUGAR_CUP_DRINKS = new Set(['含糖飲料', '奶茶', '果汁']);
const LATTE_DRINKS = new Set(['拿鐵（含抹茶拿鐵）', '拿鐵']);
function mealObjects(row) {
  const meals = row?.meals;
  if (!meals || typeof meals !== 'object') return [];
  return Object.values(meals).filter(meal => meal && typeof meal === 'object');
}
function sweetnessChosen(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== '' && text !== '未選擇';
}
function isSugaryCup(meal) {
  const drink = typeof meal?.drink === 'string' ? meal.drink.trim() : '';
  if (!drink) return false;
  if (SUGAR_CUP_DRINKS.has(drink)) return true;
  return LATTE_DRINKS.has(drink) && sweetnessChosen(meal.drinkSweetness);
}
function sugaryCupCount(rows) {
  return rows.reduce((sum, row) => sum + mealObjects(row).filter(isSugaryCup).length, 0);
}
function hasDrinkRecords(rows) {
  return rows.some(row => mealObjects(row).some(meal => typeof meal.drink === 'string' && meal.drink.trim() !== ''));
}
function eatingOutTotal(rows) {
  const known = rows.map(row => num(row?.eating_out_count)).filter(value => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}
function waterRecordedDays(rows) { return rows.filter(row => num(row?.water_ml) > 0).length; }
function exerciseKnown(rows) { return rows.some(row => num(row?.exercise_minutes) !== null); }
function exerciseDayCount(rows) { return rows.filter(row => num(row?.exercise_minutes) > 0).length; }
function flagKnown(rows, key) { return rows.some(row => typeof row?.[key] === 'boolean'); }
function flagDays(rows, key) { return rows.filter(row => row?.[key] === true).length; }
function shiftMonth(month, delta) {
  const [year, mon] = String(month).split('-').map(Number);
  const date = new Date(year, (mon || 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function statGrid(items) {
  return items.filter(Boolean).map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
}
function summarySwitch(active) {
  const button = (view, label) => `<button type="button" data-summary-view="${view}" class="${active === view ? 'is-active' : ''}" aria-pressed="${active === view}">${label}</button>`;
  return `<div class="summary-switch" role="group" aria-label="切換月總結與年總結">${button('monthView', '月')}${button('yearView', '年')}</div>`;
}
function diffPhrase(label, diff, unit, when) {
  if (!diff) return '';
  return `${label}比${when}${diff < 0 ? '少' : '多'} ${Math.abs(diff)} ${unit}。`;
}
function monthCompare(rows, prev) {
  if (!prev.length) return '';
  if (hasDrinkRecords(rows) && hasDrinkRecords(prev)) {
    const phrase = diffPhrase('含糖飲料', sugaryCupCount(rows) - sugaryCupCount(prev), '杯', '上月');
    if (phrase) return phrase;
  }
  const out = eatingOutTotal(rows), prevOut = eatingOutTotal(prev);
  if (out !== null && prevOut !== null) {
    const phrase = diffPhrase('外食', out - prevOut, '餐', '上月');
    if (phrase) return phrase;
  }
  if (waterRecordedDays(rows) || waterRecordedDays(prev)) {
    const phrase = diffPhrase('有記喝水', waterRecordedDays(rows) - waterRecordedDays(prev), '天', '上月');
    if (phrase) return phrase;
  }
  if (exerciseKnown(rows) && exerciseKnown(prev)) {
    const phrase = diffPhrase('運動', exerciseDayCount(rows) - exerciseDayCount(prev), '天', '上月');
    if (phrase) return phrase;
  }
  return diffPhrase('記錄天數', rows.length - prev.length, '天', '上月');
}
function yearCompare(rows, prev) {
  if (!prev.length) return '';
  const out = eatingOutTotal(rows), prevOut = eatingOutTotal(prev);
  if (out !== null && prevOut !== null) {
    const phrase = diffPhrase('外食', out - prevOut, '餐', '去年');
    if (phrase) return phrase;
  }
  if (waterRecordedDays(rows) || waterRecordedDays(prev)) {
    const phrase = diffPhrase('有記喝水', waterRecordedDays(rows) - waterRecordedDays(prev), '天', '去年');
    if (phrase) return phrase;
  }
  return diffPhrase('記錄天數', rows.length - prev.length, '天', '去年');
}
function summaryBits(rows) {
  const bits = [`記了 ${rows.length} 天`];
  const out = eatingOutTotal(rows);
  if (out !== null) bits.push(`外食 ${out} 餐`);
  const waterDays = waterRecordedDays(rows);
  if (waterDays) bits.push(`有記喝水 ${waterDays} 天`);
  const bowelDays = flagDays(rows, 'bowel_movement');
  if (bowelDays) bits.push(`有排便 ${bowelDays} 天`);
  const sleepDays = flagDays(rows, 'slept_well');
  if (sleepDays) bits.push(`有早睡 ${sleepDays} 天`);
  const movedDays = exerciseDayCount(rows);
  if (movedDays) bits.push(`有運動 ${movedDays} 天`);
  if (hasDrinkRecords(rows)) bits.push(`含糖飲料 ${sugaryCupCount(rows)} 杯`);
  return bits;
}
function monthSummarySentence(rows, prev) {
  if (!rows.length) return '這個月還沒開始記，先記一餐就好。';
  return `這個月${summaryBits(rows).join('，')}，辛苦了。`;
}
function steadiestMonth(rows) {
  const groups = new Map();
  rows.forEach(row => {
    if (!row?.log_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.log_date)) return;
    const key = row.log_date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.log_date);
  });
  if (groups.size < 2) return null;
  let best = null;
  groups.forEach((dates, key) => {
    const unique = [...new Set(dates)].sort();
    let gap = 99;
    if (unique.length >= 2) {
      let sum = 0;
      for (let i = 1; i < unique.length; i += 1) sum += (moneyDate(unique[i]) - moneyDate(unique[i - 1])) / 86400000;
      gap = sum / (unique.length - 1);
    }
    const score = { key, days: unique.length, gap };
    const better = !best || score.days > best.days || (score.days === best.days && score.gap < best.gap) || (score.days === best.days && score.gap === best.gap && score.key > best.key);
    if (better) best = score;
  });
  return { key: best.key, label: `${Number(best.key.slice(5))} 月` };
}
function yearWeightSeries(year) {
  const points = [];
  for (let month = 1; month <= 12; month += 1) {
    const values = monthRows(`${year}-${String(month).padStart(2, '0')}`).map(row => num(row.morning_weight)).filter(value => value !== null);
    if (!values.length) continue;
    points.push([`${month}月`, avg(values)]);
  }
  return points;
}
function yearSummarySentence(rows, prev) {
  if (!rows.length) return '今年還沒開始記，先記一餐就好。';
  return `今年${summaryBits(rows).join('，')}，辛苦了。${yearCompare(rows, prev)}`;
}
function weekdayHeads() {
  return `<div class="cal-week" aria-hidden="true">${['日', '一', '二', '三', '四', '五', '六'].map(day => `<span>${day}</span>`).join('')}</div>`;
}
function monthCalendarCells(year, month, logged, selected) {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: first.getDay() }, () => '<i></i>');
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const classes = [logged.has(key) ? 'is-logged' : '', key === selected ? 'is-selected' : ''].filter(Boolean).join(' ');
    const label = logged.has(key) ? ` aria-label="${month}月${day}日已記錄"` : '';
    cells.push(`<b class="${classes}"${label}>${day}</b>`);
  }
  return cells.join('');
}
function yearCalendarHTML(year, rows) {
  const logged = new Set(rows.map(row => row.log_date).filter(Boolean));
  const board = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return `<div class="cal-month"><strong>${month} 月</strong>${weekdayHeads()}<div class="cal-grid">${monthCalendarCells(Number(year), month, logged, '')}</div></div>`;
  }).join('');
  return `<div class="year-calendar"><div class="section-head summary-chart-head"><h3>一年的紀錄</h3><span>有記的日子會亮起來</span></div><div class="cal-board">${board}</div></div>`;
}
const SUMMARY_LINE = '#3f6f66';
const SUMMARY_LINE_SOFT = '#9dc8b4';
const BALANCE_LEGEND = '<div class="chart-legend" aria-label="日夜圖例"><span><i class="legend-dot day"></i>白天變化</span><span><i class="legend-dot night"></i>睡一覺變化</span></div>';
const SLEEP_LEGEND = '<div class="chart-legend"><span><i class="legend-dot day"></i>早上體重（kg）</span><span><i class="legend-dot sleep"></i>睡眠時數（hr）</span></div>';
function igKind() {
  const kind = new URLSearchParams(location.search).get('ig');
  return kind === 'month' || kind === 'year' ? kind : '';
}
function longestStreak(rows) {
  const dates = [...new Set(rows.map(row => row.log_date).filter(Boolean))].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  dates.forEach(date => {
    run = prev && moneyDate(date) - moneyDate(prev) === 86400000 ? run + 1 : 1;
    if (run > best) best = run;
    prev = date;
  });
  return best;
}
function chipGrid(items) {
  const html = statGrid(items);
  return html ? `<div class="stat-grid summary-grid">${html}</div>` : '';
}
function catBlock(id, title, body) {
  if (!body) return '';
  return `<section class="card summary-cat cat-${id}"><h3 class="summary-cat-title"><i aria-hidden="true"></i>${title}</h3>${body}</section>`;
}
function noteHTML(text) {
  return text ? `<p class="summary-cat-note">${text}</p>` : '';
}
function logItems(rows, scope) {
  if (!rows.length) return [];
  const items = [['記錄天數', `${rows.length} 天`]];
  const streak = longestStreak(rows);
  if (streak >= 2) items.push(['連續記錄', `${streak} 天`]);
  if (scope === 'year') {
    const month = steadiestMonth(rows);
    if (month) items.push(['最穩的月', month.label]);
  }
  return items;
}
function logInner(rows, prev, scope, calendar) {
  if (!rows.length) return '';
  const streak = longestStreak(rows);
  const milestone = streak >= 2 ? encouragement(streak) : '';
  const compare = scope === 'month' ? monthCompare(rows, prev) : '';
  return [
    chipGrid(logItems(rows, scope)),
    noteHTML(milestone),
    compare ? noteHTML(`與上月比較：${compare}`) : '',
    calendar || ''
  ].filter(Boolean).join('');
}
function foodItems(rows) {
  const items = [];
  const out = eatingOutTotal(rows);
  if (out !== null) items.push(['外食餐數', `${out} 餐`]);
  if (hasDrinkRecords(rows)) items.push(['含糖飲料杯數', `${sugaryCupCount(rows)} 杯`]);
  return items;
}
function habitCount(label, days) {
  if (!days) return '';
  return `<div class="stat"><strong>${days} 天</strong><span>${label}</span></div>`;
}
function habitInner(rows) {
  const meters = [
    habitCount('有記喝水', waterRecordedDays(rows)),
    habitCount('有排便', flagDays(rows, 'bowel_movement')),
    habitCount('有早睡', flagDays(rows, 'slept_well')),
    habitCount('有運動', exerciseDayCount(rows))
  ].filter(Boolean);
  if (!meters.length) return '';
  return `<div class="stat-grid summary-grid">${meters.join('')}</div>`;
}
function bodyAverageItems(s) {
  return [
    s.avgWeight !== null ? ['平均早上體重', `${format(s.avgWeight)} kg`] : null,
    s.avgDayIncrease !== null ? ['白天變化', signedKg(s.avgDayIncrease)] : null,
    s.avgSleepChange !== null ? ['睡一覺變化', signedKg(s.avgSleepChange)] : null,
    s.avgWaistHip !== null ? ['平均腰臀比', format(s.avgWaistHip, 2)] : null
  ].filter(Boolean);
}
function chartBox(chart) {
  if (!chart) return '';
  const noteClass = chart.noteClass || 'insight-note';
  return `<div class="summary-chart"><div class="section-head summary-chart-head"><h3>${chart.title}</h3><span>${chart.hint || ''}</span></div><div class="chart-canvas-wrap"><canvas id="${chart.id}"></canvas></div>${chart.legend || ''}${chart.note ? `<p class="${noteClass}">${chart.note}</p>` : ''}</div>`;
}
function bodyInner(s, charts, details) {
  const parts = [chipGrid(bodyAverageItems(s))];
  if (charts?.weight) parts.push(chartBox(charts.weight));
  if (details && charts) {
    ['balance', 'sleep', 'whr', 'fat'].forEach(key => { if (charts[key]) parts.push(chartBox(charts[key])); });
  }
  return parts.filter(Boolean).join('');
}
function summaryViewHTML({ scope, rows, prev, stats: s, sentence, charts, details, calendar = '', chrome = null }) {
  const cats = [
    catBlock('log', '記錄概況', logInner(rows, prev, scope, calendar)),
    catBlock('food', '外食與飲料', chipGrid(foodItems(rows))),
    catBlock('habit', '生活習慣', habitInner(rows)),
    catBlock('body', '體重與身體', bodyInner(s, charts, details))
  ].join('');
  const head = chrome ? `<div class="card summary-switch-card"><div class="section-head"><h2>${chrome.title}</h2></div></div>` : '';
  const sample = sampleKind() && !paidAccess ? '<p class="summary-line sample-note">這是示範資料，不是你的紀錄。<a href="?demo=1&locale=zh-TW">回到空白體驗，自己記一餐</a></p>' : '';
  return `${sample}${head}${cats}${sentence ? `<p class="summary-line">${sentence}</p>` : ''}`;
}
function paintCharts(charts) {
  if (!charts) return;
  if (charts.weight) drawChart(charts.weight.id, charts.weight.points, charts.weight.unit || 'kg', SUMMARY_LINE);
  if (charts.balance) drawDualChart(charts.balance.id, charts.balance.points, [SUMMARY_LINE, SUMMARY_LINE_SOFT]);
  if (charts.sleep) drawSleepWeightChart(charts.sleep.id, charts.sleep.points, SUMMARY_LINE);
  if (charts.whr) drawChart(charts.whr.id, charts.whr.points, charts.whr.unit || 'WHR', SUMMARY_LINE);
  if (charts.fat) drawChart(charts.fat.id, charts.fat.points, charts.fat.unit || '%', SUMMARY_LINE);
}
function monthCharts(rows, prefix = '') {
  const id = name => `${prefix}${name}`;
  const morningPoints = rows.map(row => [row.log_date, num(row.morning_weight)]).filter(point => point[1] !== null);
  const balancePoints = rows.map(row => [row.log_date, dayIncrease(row), sleepChange(row)]);
  const sleepPoints = rows.map(row => [row.log_date, num(row.morning_weight), num(row.sleep_hours)]).filter(point => point[1] !== null || point[2] !== null);
  const whrPoints = rows.map(row => [row.log_date, waistHip(row)]).filter(point => point[1] !== null);
  return {
    weight: morningPoints.length ? { id: id('monthChart'), title: '體重曲線', hint: '有早上體重就畫', points: morningPoints, unit: 'kg', note: '飲食、飲水、排便與測量時間都會讓數字晃動，僅供觀察。', noteClass: 'source-note' } : null,
    balance: balancePoints.some(point => point[1] !== null || point[2] !== null) ? { id: id('monthBalanceChart'), title: '白天變化／睡一覺變化', hint: '有填才畫', points: balancePoints, kind: 'dual', legend: BALANCE_LEGEND } : null,
    sleep: sleepPoints.length ? { id: id('monthSleepWeightChart'), title: '體重 × 睡眠時數', hint: '放在一起看', points: sleepPoints, kind: 'sleep', legend: SLEEP_LEGEND, note: '睡眠時數和早上體重放在一起，只供自己看。' } : null,
    whr: whrPoints.length ? { id: id('monthWhrChart'), title: '腰臀比（WHR）變化', hint: '腰圍 ÷ 臀圍', points: whrPoints, unit: 'WHR', note: '腰圍 ÷ 臀圍，數字上下晃很正常，只供自己看。' } : null,
    fat: null
  };
}
function yearCharts(year, prefix = '') {
  const id = name => `${prefix}${name}`;
  const weightPoints = yearWeightSeries(year);
  const monthlyPoints = Array.from({ length: 12 }, (_, index) => {
    const monthRowsForChart = monthRows(`${year}-${String(index + 1).padStart(2, '0')}`);
    return { label: String(index + 1), rows: monthRowsForChart, stats: stats(monthRowsForChart) };
  });
  const balancePoints = monthlyPoints.map(item => [item.label, item.stats.avgDayIncrease, item.stats.avgSleepChange]);
  const sleepPoints = monthlyPoints.map(item => [item.label, item.stats.avgWeight, avg(item.rows.map(row => num(row.sleep_hours)).filter(value => value !== null))]).filter(point => point[1] !== null || point[2] !== null);
  const whrPoints = monthlyPoints.map(item => [item.label, item.stats.avgWaistHip]).filter(point => point[1] !== null);
  return {
    weight: weightPoints.length ? { id: id('yearSummaryChart'), title: '體重曲線', hint: '各月早上體重平均', points: weightPoints, unit: 'kg' } : null,
    balance: balancePoints.some(point => point[1] !== null || point[2] !== null) ? { id: id('yearBalanceChart'), title: '每月白天變化／睡一覺變化', hint: '平均值', points: balancePoints, kind: 'dual', legend: BALANCE_LEGEND } : null,
    sleep: sleepPoints.length ? { id: id('yearSleepWeightChart'), title: '體重 × 睡眠時數', hint: '每月平均', points: sleepPoints, kind: 'sleep', legend: '<div class="chart-legend"><span><i class="legend-dot day"></i>平均早上體重（kg）</span><span><i class="legend-dot sleep"></i>平均睡眠時數（hr）</span></div>', note: '睡眠和早上體重的每月平均，只供自己看。' } : null,
    whr: whrPoints.length ? { id: id('yearWhrChart'), title: '腰臀比（WHR）變化', hint: '每月平均', points: whrPoints, unit: 'WHR', note: '腰圍 ÷ 臀圍的每月平均，只供自己看。' } : null,
    fat: null
  };
}
let igPaintToken = 0;
function renderIgExample() {
  const kind = igKind();
  document.documentElement.classList.toggle('is-ig', Boolean(kind));
  const stage = $('igStage');
  if (!stage) return;
  stage.classList.toggle('hidden', !kind);
  if (!kind) { stage.innerHTML = ''; return; }
  const year = String($('yearPicker').value || new Date().getFullYear());
  const month = selectedMonth();
  const rows = kind === 'month' ? monthRows(month) : sortRows(cache.filter(row => row.log_date && row.log_date.startsWith(year)));
  const prev = kind === 'month' ? monthRows(shiftMonth(month, -1)) : sortRows(cache.filter(row => row.log_date && row.log_date.startsWith(String(Number(year) - 1))));
  const charts = kind === 'month' ? monthCharts(rows, 'ig') : yearCharts(year, 'ig');
  const sentence = kind === 'month' ? monthSummarySentence(rows, prev) : yearSummarySentence(rows, prev);
  const heading = kind === 'month' ? `${Number(String(month).slice(5))} 月手記` : `${year} 年手記`;
  const calendar = kind === 'year' && rows.length ? yearCalendarHTML(year, rows) : '';
  stage.innerHTML = `<article class="ig-card"><header class="ig-head"><p class="ig-brand">🍵 阿茶手記</p><h2>${heading}</h2><span>先記錄，不追求完美</span></header>${summaryViewHTML({ scope: kind, rows, prev, stats: stats(rows), sentence, charts, details: false, calendar })}<p class="ig-foot">外食也能好好照顧自己</p></article>`;
  const token = ++igPaintToken;
  requestAnimationFrame(() => { if (token === igPaintToken) paintCharts(charts); });
}
function prevDate(date) {
  const cursor = new Date(`${date}T12:00:00`);
  cursor.setDate(cursor.getDate() - 1);
  return localDateString(cursor);
}
function streakEnding(date) {
  const dates = new Set(cache.map(row => row.log_date).filter(Boolean));
  let cursor = date, count = 0;
  while (cursor && dates.has(cursor)) {
    count += 1;
    cursor = prevDate(cursor);
  }
  return count;
}
function encouragement(count) {
  if (count >= 30) return '整整 30 天，謝謝你一直陪自己。';
  if (count >= 25) return '25 天，快一整個月了，很穩。';
  if (count >= 20) return '20 天了，外食也能好好照顧自己。';
  if (count >= 15) return '半個月都有記，習慣慢慢長出來了。';
  if (count >= 7) return '一連記了 7 天，這樣就很好，辛苦了。';
  return '';
}
function renderTodayCalendar() {
  const root = $('todayCalendar');
  if (!root) return;
  const selected = $('logDate')?.value || today();
  const [year, month] = selected.split('-').map(Number);
  if (!year || !month) return;
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const logged = new Set(cache.filter(row => row.log_date && row.log_date.startsWith(prefix)).map(row => row.log_date));
  const note = encouragement(streakEnding(selected));
  root.innerHTML = `<div class="section-head"><h2>${month} 月紀錄</h2><span>記完的日子會亮起來</span></div>${weekdayHeads()}<div class="cal-grid today-cal-grid">${monthCalendarCells(year, month, logged, selected)}</div>${note ? `<p class="summary-line">${note}</p>` : ''}`;
}
function dailySummarySentence(row) {
  return todayLoggedSentence(row);
}
function dailySummaryHTML(row) {
  const m = num(row.morning_weight), e = num(row.evening_weight), whr = waistHip(row), ex = num(row.exercise_minutes);
  const weights = [m !== null ? `早 ${format(m)} kg` : '', e !== null ? `晚 ${format(e)} kg` : ''].filter(Boolean).join('　');
  const trend = [...weightChangeBits(row), whr !== null ? `腰臀比 ${format(whr, 2)}` : ''].filter(Boolean).join('　');
  const water = num(row.water_ml);
  const details = [row.plate_pattern ? `餐盤 ${row.plate_pattern}` : '', num(row.eating_out_count) > 0 ? `外食 ${num(row.eating_out_count)} 餐` : '', water ? `喝水 ${water} ml` : '', row.slept_well ? '有早睡' : '', row.bowel_movement ? '有排便' : '', ex > 0 ? `運動 ${ex} 分鐘` : ''].filter(Boolean).join('　');
  const sentence = dailySummarySentence(row);
  return `<div class="log-row"><div class="log-summary"><strong>${row.log_date}</strong>${weights ? `<span>${weights}</span>` : ''}</div>${sentence ? `<p class="daily-summary-sentence">${sentence}</p>` : ''}${trend ? `<p class="daily-metrics">${trend}</p>` : ''}${details ? `<details><summary>查看每日摘要</summary><p class="subtle">${details}</p></details>` : ''}</div>`;
}
function renderMonth() {
  const month = selectedMonth(), rows = monthRows(month), prev = monthRows(shiftMonth(month, -1)), s = stats(rows);
  const charts = monthCharts(rows);
  const summary = $('monthSummary');
  if (summary) {
    summary.classList.toggle('is-empty', !rows.length);
    summary.innerHTML = summaryViewHTML({
      scope: 'month',
      rows,
      prev,
      stats: s,
      sentence: monthSummarySentence(rows, prev),
      charts,
      details: true,
      chrome: { title: '月總結', active: 'monthView' }
    });
  }
  const list = $('monthList');
  if (list) list.innerHTML = rows.length ? rows.slice().reverse().map(dailySummaryHTML).join('') : '<p class="subtle">這個月還沒有記錄。</p>';
  paintCharts(charts);
  renderTodayCalendar();
  renderIgExample();
}
function renderYear() {
  const y = String($('yearPicker').value || new Date().getFullYear());
  const rows = sortRows(cache.filter(x => x.log_date && x.log_date.startsWith(y)));
  const prev = sortRows(cache.filter(x => x.log_date && x.log_date.startsWith(String(Number(y) - 1))));
  const s = stats(rows);
  const charts = yearCharts(y);
  const summary = $('yearSummary');
  if (summary) {
    summary.classList.toggle('is-empty', !rows.length);
    summary.innerHTML = summaryViewHTML({
      scope: 'year',
      rows,
      prev,
      stats: s,
      sentence: yearSummarySentence(rows, prev),
      charts,
      details: true,
      calendar: rows.length ? yearCalendarHTML(y, rows) : '',
      chrome: { title: '年總結', active: 'yearView' }
    });
  }
  const months = Array.from({ length: 12 }, (_, i) => {
    const mm = `${y}-${String(i + 1).padStart(2, '0')}`, r = monthRows(mm);
    if (!r.length) return '';
    const z = stats(r);
    const bits = [`${z.days} 天`];
    if (z.avgWeight !== null) bits.push(`平均 ${format(z.avgWeight)} kg`);
    if (z.avgWaistHip !== null) bits.push(`腰臀比 ${format(z.avgWaistHip, 2)}`);
    if (z.avgDayIncrease !== null) bits.push(`白天 ${signedKg(z.avgDayIncrease)}`);
    if (z.avgSleepChange !== null) bits.push(`睡一覺 ${signedKg(z.avgSleepChange)}`);
    return `<div class="month-row"><div class="log-summary"><strong>${i + 1} 月</strong><span>${bits.join('　')}</span></div></div>`;
  }).filter(Boolean).join('');
  const list = $('yearList');
  if (list) list.innerHTML = months || '<p class="subtle">今年還沒有記錄。</p>';
  paintCharts(charts);
  renderIgExample();
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
  const ticks = [];
  labels.forEach((_, i) => { if (i % step === 0 || i === labels.length - 1) ticks.push(i); });
  const minGap = Math.max(2, Math.ceil(step * 0.6));
  const shown = [];
  ticks.forEach(i => {
    const prev = shown[shown.length - 1];
    if (prev !== undefined && i - prev < minGap) {
      if (i === labels.length - 1) shown[shown.length - 1] = i;
      return;
    }
    shown.push(i);
  });
  shown.forEach(i => {
    const label = labels[i];
    const x = pad.left + plotW * i / Math.max(1, labels.length - 1);
    const shortLabel = /^\d{4}-\d{2}-\d{2}$/.test(label) ? label.slice(5).replace('-', '/') : label;
    ctx.fillText(shortLabel, x, pad.top + plotH + 9);
  });
  ctx.save(); ctx.translate(12, pad.top + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(yUnit, 0, 0); ctx.restore();
  // 刻度保留 MM/DD；不繪製多餘的「日期／月份」軸標題，避免手機裁切。
  return { pad, plotW, plotH, x: i => pad.left + plotW * i / Math.max(1, labels.length - 1), y: value => pad.top + (max - value) / (max - min || 1) * plotH };
}
function drawChart(id, points, yUnit = 'kg', lineColor = SUMMARY_LINE) {
  const canvas = $(id); if (!canvas) return;
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth || 600, h = canvas.clientHeight || 260;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  if (!points.length) { ctx.fillStyle = '#748680'; ctx.font = '14px sans-serif'; ctx.fillText('有記錄後會顯示趨勢圖', 52, 120); return; }
  const values = points.map(x => x[1]), min = Math.min(...values) - .5, max = Math.max(...values) + .5;
  const frame = chartFrame(ctx, w, h, min, max, points.map(x => x[0]), yUnit);
  ctx.strokeStyle = lineColor; ctx.lineWidth = 3; ctx.beginPath();
  points.forEach((p, i) => { const x = frame.x(i), y = frame.y(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  ctx.fillStyle = '#193d37'; points.forEach((p, i) => { const x = frame.x(i), y = frame.y(p[1]); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
}
function drawSleepWeightChart(id, points, lineColor = SUMMARY_LINE) {
  const canvas = $(id); if (!canvas) return;
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth || 600, h = canvas.clientHeight || 280;
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
  ctx.strokeStyle = lineColor; ctx.lineWidth = 3; ctx.beginPath(); let started = false;
  valid.forEach((p, i) => { if (p[1] === null) return; const x = frame.x(i), y = frame.y(p[1]); started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; }); ctx.stroke();
  ctx.fillStyle = '#193d37'; valid.forEach((p, i) => { if (p[1] === null) return; const x = frame.x(i), y = frame.y(p[1]); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
}
function drawDualChart(id, points, colors = [SUMMARY_LINE, SUMMARY_LINE_SOFT]) {
  const canvas = $(id); if (!canvas) return;
  const valid = points.filter(x => x[1] !== null || x[2] !== null);
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth || 600, h = canvas.clientHeight || 260;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  if (!valid.length) { ctx.fillStyle = '#748680'; ctx.font = '14px sans-serif'; ctx.fillText('有白天或睡一覺的變化時會畫在這裡', 52, 120); return; }
  const values = valid.flatMap(x => [x[1], x[2]]).filter(v => v !== null), min = Math.min(...values, 0) - .2, max = Math.max(...values, .5) + .2;
  const frame = chartFrame(ctx, w, h, min, max, valid.map(x => x[0]), 'kg');
  [[colors[0], 1], [colors[1], 2]].forEach(([color, index]) => {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); let started = false;
    valid.forEach((p, i) => { if (p[index] === null) return; const x = frame.x(i), y = frame.y(p[index]); started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; });
    ctx.stroke();
  });
}

$('mainView')?.addEventListener('click', event => {
  const button = event.target.closest('[data-summary-view]');
  if (!button) return;
  document.querySelector(`.view-tab[data-view="${button.dataset.summaryView}"]`)?.click();
});

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

function dropLogReads() {
  loadAllGen += 1;
  logReadGen += 1;
  logsLoadedFor = '';
  clearTimeout(loadAllTimer);
  loadAllTimer = 0;
  cache = [];
}
function scheduleLoadAll() {
  clearTimeout(loadAllTimer);
  if (isDemo() && !paidAccess) {
    loadAllTimer = 0;
    loadAll();
    return;
  }
  loadAllTimer = setTimeout(() => {
    loadAllTimer = 0;
    loadAll();
  }, 0);
}
function applyLoadedLogs(rows) {
  cache = sortRows(rows || []);
  preferSampleMonth();
  renderMonth();
  renderYear();
  const date = $('logDate').value || today();
  fill(cache.find(row => row.log_date === date) || {});
}
// 後到的整包讀取才算數。重複觸發或較慢的舊回應不能蓋掉較新的結果。
async function loadAll() {
  if (isDemo() && !paidAccess) {
    logsLoadedFor = '';
    applyLoadedLogs(demoRows());
    return;
  }
  if (!session || !supabase) return;
  const gen = ++loadAllGen;
  const userId = session.user?.id || '';
  logReadGen += 1;
  const { data, error } = await supabase.from('daily_logs').select('*').order('log_date', { ascending: true });
  if (gen !== loadAllGen) return;
  if (!session || (session.user?.id || '') !== userId) return;
  if (error) { toast(error.message); return; }
  logsLoadedFor = userId;
  logReadGen += 1;
  applyLoadedLogs(data || []);
}
bootstrapAuth();

// 展示網址：自動開啟外食建議，方便作業截圖與引流貼文展示。
if (isGuideShowcase()) {
  const guideTab = document.querySelector('.view-tab[data-view=\"guideView\"]');
  guideTab?.click();
} else if (sampleKind() === 'month') {
  document.querySelector('.view-tab[data-view=\"monthView\"]')?.click();
} else if (sampleKind() === 'year') {
  document.querySelector('.view-tab[data-view=\"yearView\"]')?.click();
}

// Collapsible eating-out combinations with paired 211 / 221 choices.
