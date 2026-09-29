const LINE_URL = 'https://lin.ee/rOydflm';
const PORTAL_URL = 'https://portaly.cc/swjonlyone/product/AsJrabRIMk2IJMwtBclw';
const scenarios = {
  convenience: { label: '超商', items: [
    ['🥚','茶葉蛋','超商蛋白質小幫手','你已經很會找方便的選擇了！','順手再拿一罐無糖豆漿，飽足感直接升級','蛋黃留著吃，營養才完整囉。'],
    ['🥛','無糖豆漿','植物蛋白好朋友','選無糖豆漿很會照顧自己！','搭一顆茶葉蛋，這餐更有飽足感','今天不用一次改很多。'],
    ['🍗','舒肥雞胸','冷藏櫃的蛋白質選擇','已經找到蛋白質主角，很棒！','再補一點生菜或水果，吃起來更完整','慢慢挑，你的日常已經在變好了。'],
    ['🍎','水果盒','清爽解膩選擇','想吃清爽一點，這個方向很不錯！','如果是正餐，再補一個蛋白質小品','有照顧到當下的需要就很可以。']
  ]},
  bento: { label: '便當店', items: [
    ['🍗','雞腿便當','熟悉又滿足的日常','你很懂得選一份有主菜的便當！','飯先留三分之一，配菜多吃幾口','便當是日常，不需要把喜歡的都拿掉。'],
    ['🥩','排骨便當','香香的主菜時光','想吃排骨完全可以，先好好享受它！','炸物去皮，或先吃幾口青菜再吃飯','不求完美，留一點空間給下一餐。'],
    ['🍚','滷肉飯','今天就是想吃這一味','選喜歡的食物也是照顧心情呀！','加一份燙青菜或滷豆腐，讓餐盤更平衡','開心吃完，再慢慢接回日常就好。'],
    ['🥬','自選配菜','會搭配就是很好的開始','你已經在思考怎麼搭配，這很棒！','先選一份蛋白質，再夾兩樣蔬菜','每次多一個小選擇，就很有累積。']
  ]},
  fastfood: { label: '速食店', items: [
    ['🍔','漢堡套餐','想吃漢堡也能好好吃','喜歡的速食不用消失，先享受這一餐！','飲料換無糖或小杯，今天做一個微調','有選擇，就已經是在照顧自己。'],
    ['🍟','薯條','香香脆脆的快樂','今天想吃薯條，完全可以理解！','和朋友分食，或搭配一杯無糖飲','吃喜歡的，也可以不帶罪惡感。'],
    ['🥤','無糖飲','先從飲料做小選擇','你已經替自己留了一個很棒的空間！','主餐慢慢吃，感覺一下飽足再決定要不要吃完','這種輕鬆的微調很適合放進日常。'],
    ['🍗','炸雞','滿足一下的晚餐','想吃炸雞的日子，也值得被好好對待！','先吃蛋白質和配菜，飲料選無糖','下一餐回到平常，不用重新開始。']
  ]},
  buffet: { label: '自助餐', items: [
    ['🍽️','夾夾樂','自己搭配的自由感','你願意停下來搭配，已經很會照顧自己！','先夾一份蛋白質，再補兩樣蔬菜','不用每次都一百分，方向對了就好。'],
    ['🥦','多蔬菜配菜','餐盤有綠色很加分','看到蔬菜就先夾，這個習慣很棒！','再搭一份豆腐、蛋或魚肉','餐盤多一點顏色，吃起來也更舒服。'],
    ['🐟','魚肉主菜','清爽又有蛋白質','選魚肉當主菜，很有自己的節奏！','飯先盛半碗，不夠再添也可以','你不需要靠忍耐，只要先留一點彈性。'],
    ['🍳','滷蛋豆腐','簡單的蛋白質補位','這種小小補位很實用，選得很好！','搭一樣蔬菜和喜歡的主食','一餐一個微調，慢慢就會變簡單。']
  ]},
  tea: { label: '手搖飲', items: [
    ['🧋','珍珠奶茶','甜甜的喜歡值得被照顧','想喝珍奶很正常，喜歡的飲料不用消失！','甜度往下調一格，或先選中杯','好好享受它，也是一種溫柔的選擇。'],
    ['🍵','無糖綠茶','清爽的日常選擇','選無糖飲很有自己的節奏，讚讚！','搭配正餐時補一份蛋白質和蔬菜','今天已經完成一個輕鬆的小調整。'],
    ['☕','拿鐵','午後的小小陪伴','下午想喝一杯，這份需要很可以理解！','糖漿少一點，或改成中杯慢慢喝','不用戒掉喜歡的，只要找到舒服的方式。'],
    ['🍓','水果茶','清爽又有香氣','想要有味道的飲料，這個選擇很可愛！','選微糖或少冰，讓每一口都喝得安心','今天的你有記得照顧自己，這就很棒。']
  ]}
};
const stepOne = document.querySelector('#quiz-step-one');
const stepTwo = document.querySelector('#quiz-step-two');
const stepTwoTitle = document.querySelector('#quiz-step-two-title');
const itemsEl = document.querySelector('.quiz-items');
const resultEl = document.querySelector('#result');
const stepLabel = document.querySelector('#quiz-step-label');
const stepHint = document.querySelector('#quiz-step-hint');
let activeScenario = null;
function safe(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showStepTwo(key){
  activeScenario=key; const scene=scenarios[key];
  stepOne.hidden=true; stepOne.style.display='none'; stepTwo.hidden=false; stepTwo.style.display=''; resultEl.hidden=true; resultEl.style.display='none';
  stepLabel.textContent='步驟 2／2'; stepHint.textContent='選一個餐點，阿茶 3 秒回你';
  stepTwoTitle.textContent=`選一個${scene.label}餐點看看阿茶怎麼說`;
  itemsEl.innerHTML=scene.items.map((it,i)=>`<button class="quiz-card quiz-item-card" data-item="${i}" type="button"><span class="food-icon">${it[0]}</span><span class="quiz-label">${safe(it[1])}</span><span class="quiz-hint">${safe(it[2])}</span><span class="card-arrow" aria-hidden="true">↗</span></button>`).join('');
  itemsEl.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>showResult(Number(btn.dataset.item))));
  stepTwoTitle.focus?.();
}
function showResult(index){
  const [icon,item,hint,affirm,tips1,tips2]=scenarios[activeScenario].items[index];
  resultEl.hidden=false; resultEl.style.display='';
  resultEl.innerHTML=`<div class="result-inner"><div class="result-visual" aria-hidden="true">${icon}</div><div><span class="eyebrow">阿茶回覆囉・${safe(scenarios[activeScenario].label)} · ${safe(item)}</span><div class="result-section result-affirm"><span>先肯定</span><p>${safe(affirm)}</p></div><div class="result-section result-tweak"><span>今天就做的小微調</span><ol><li>${safe(tips1)}</li><li>${safe(tips2)}</li></ol></div><div class="result-section result-warm"><span>暖心收尾</span><p>你今天有好好照顧自己，阿茶都看見了。慢慢來，就很棒了！</p></div><div class="result-reminder"><strong>🌿 阿茶順手提醒</strong><p>你微調得超棒！吃對了之外，阿茶平常也會順手給身體一點小支持——好奇的話，加阿茶 LINE 順手問呀。</p><a class="result-line-link" href="${LINE_URL}" target="_blank" rel="noopener noreferrer">加阿茶 LINE，順手聊聊 →</a></div><div class="result-purchase-note"><span>覺得阿茶好用嗎？</span><a href="${PORTAL_URL}" target="_blank" rel="noopener noreferrer">NT$299 買斷 →</a></div><button class="quiz-retry" type="button" id="quiz-retry">再測一餐</button></div></div>`;
  document.querySelector('#quiz-retry').addEventListener('click',resetQuiz);
  resultEl.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
}
function resetQuiz(){ activeScenario=null; resultEl.hidden=true; resultEl.style.display='none'; resultEl.innerHTML=''; stepTwo.hidden=true; stepTwo.style.display='none'; stepOne.hidden=false; stepOne.style.display=''; stepLabel.textContent='步驟 1／2'; stepHint.textContent='選一個今天最常遇到的情境'; document.querySelector('.quiz-scenarios .quiz-card')?.focus(); document.querySelector('#quiz')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}); }
document.querySelectorAll('.quiz-scenarios .quiz-card').forEach(card=>card.addEventListener('click',()=>showStepTwo(card.dataset.scenario)));
document.querySelector('#quiz-back').addEventListener('click',resetQuiz);
