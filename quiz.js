// ============================================================
// محرك الاختبار
// ============================================================

const LEVEL_LABEL = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const LEVEL_CLASS = { easy: 'lvl-easy', medium: 'lvl-medium', hard: 'lvl-hard' };

const lessonId = LESSON_DATA.lesson.id + '-' + LESSON_DATA.subject.id + '-' + (LESSON_DATA.dataVersion || 'v1');
const ALL_Q = LESSON_DATA.questions;

let quiz = {
  mode: 'all',        // all | easy | medium | hard | mistakes
  pool: [],            // الأسئلة الفعلية في هذه المحاولة (مخلوطة)
  index: 0,
  records: [],          // سجل كل إجابة
  helpUsedOnCurrent: false,
  removedOptions: [],  // خيارات محذوفة بالمساعدة للسؤال الحالي
  streak: 0,            // عدد الإجابات الصحيحة المتتالية الحالي
  bestStreak: 0
};

// ---------- أدوات عامة ----------
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function byIds(ids){
  return ids.map(id => ALL_Q.find(q=>q.id===id)).filter(Boolean);
}

// ---------- إعداد معلومات الصفحة ----------
document.getElementById('lessonTitle').textContent = LESSON_DATA.lesson.title;
document.getElementById('lessonSub').textContent =
  `${LESSON_DATA.subject.name} · ${LESSON_DATA.unit.name} · ${LESSON_DATA.lesson.name}`;

const counts = {
  all: ALL_Q.length,
  easy: ALL_Q.filter(q=>q.level==='easy').length,
  medium: ALL_Q.filter(q=>q.level==='medium').length,
  hard: ALL_Q.filter(q=>q.level==='hard').length,
};
document.getElementById('cnt-all').textContent = counts.all;
document.getElementById('cnt-easy').textContent = counts.easy;
document.getElementById('cnt-medium').textContent = counts.medium;
document.getElementById('cnt-hard').textContent = counts.hard;

// عرض بطاقة "أخطاؤك السابقة" إن وجدت
(function setupMistakesCard(){
  const state = QBank.getLessonState(lessonId);
  const box = document.getElementById('mistakesBox');
  if(state.lastMistakes && state.lastMistakes.length){
    box.style.display = '';
    document.getElementById('mistakesCount').textContent = state.lastMistakes.length;
  } else {
    box.style.display = 'none';
  }
  if(state.bestScore !== null){
    document.getElementById('bestScoreBox').style.display = '';
    document.getElementById('bestScoreVal').textContent = state.bestScore;
  }
})();

// ---------- اختيار الوضع في شاشة البدء ----------
let selectedMode = 'all';
document.querySelectorAll('.mode-card').forEach(card=>{
  card.addEventListener('click', ()=>{
    document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
  });
});
document.querySelector('.mode-card[data-mode="all"]').classList.add('selected');

document.getElementById('startBtn').addEventListener('click', ()=>{
  startQuiz(selectedMode);
});

document.getElementById('reviewMistakesBtn')?.addEventListener('click', ()=>{
  const state = QBank.getLessonState(lessonId);
  startQuiz('mistakes', state.lastMistakes.map(m=>m.id));
});

// ---------- بدء اختبار ----------
function startQuiz(mode, mistakeIds){
  quiz.mode = mode;
  let base;
  if(mode === 'mistakes'){
    base = byIds(mistakeIds);
  } else if(mode === 'all'){
    base = ALL_Q;
  } else {
    base = ALL_Q.filter(q=>q.level===mode);
  }
  quiz.pool = shuffle(base);
  quiz.index = 0;
  quiz.records = [];
  quiz.streak = 0;
  quiz.bestStreak = 0;

  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('quizScreen').style.display = '';
  document.getElementById('resultScreen').style.display = 'none';

  buildStrataTrack();
  renderQuestion();
}

// ---------- شريط الطبقات ----------
function buildStrataTrack(){
  const track = document.getElementById('strataTrack');
  const bit = document.getElementById('drillBit'); // نحافظ على إبرة الحفر قبل ما نفرّغ الشريط
  track.innerHTML = '';
  const levels = ['easy','medium','hard'];
  const totalLen = quiz.pool.length;
  levels.forEach(lvl=>{
    const n = quiz.pool.filter(q=>q.level===lvl).length;
    if(n===0) return;
    const seg = document.createElement('div');
    seg.className = `seg ${lvl}`;
    seg.style.width = (n/totalLen*100)+'%';
    seg.dataset.level = lvl;
    seg.dataset.count = n;
    const fill = document.createElement('div');
    fill.className = 'fill';
    seg.appendChild(fill);
    track.appendChild(seg);
  });
  track.appendChild(bit); // نعيد إبرة الحفر بعد بناء الطبقات
}

function updateStrataProgress(){
  const levels = ['easy','medium','hard'];
  levels.forEach(lvl=>{
    const seg = document.querySelector(`.seg.${lvl}`);
    if(!seg) return;
    const total = Number(seg.dataset.count);
    const answered = quiz.records.filter(r=>r.level===lvl).length;
    seg.querySelector('.fill').style.width = (answered/total*100)+'%';
  });
  const bit = document.getElementById('drillBit');
  const pct = (quiz.index / quiz.pool.length) * 100;
  bit.style.right = pct+'%';
}

// ---------- عرض سؤال ----------
function renderQuestion(){
  const q = quiz.pool[quiz.index];
  quiz.helpUsedOnCurrent = false;
  quiz.removedOptions = [];

  updateStrataProgress();

  document.getElementById('qCounter').textContent =
    `سؤال ${quiz.index+1} من ${quiz.pool.length}`;

  const correctSoFar = quiz.records.filter(r=>r.isCorrect).length;
  document.getElementById('liveScore').textContent =
    quiz.records.length ? `${correctSoFar} صح من ${quiz.records.length}` : '';

  renderStreakBadge();

  document.getElementById('importantBadge').style.display = q.important ? '' : 'none';
  document.getElementById('qText').textContent = q.question;

  const optsWrap = document.getElementById('optsWrap');
  optsWrap.innerHTML = '';
  const letters = ['أ','ب','ج','د'];
  q.options.forEach((optText, i)=>{
    const div = document.createElement('div');
    div.className = 'opt';
    div.dataset.index = i;
    div.innerHTML = `
      <span class="letter">${letters[i]}</span>
      <span class="txt">${optText}</span>
      <svg class="icon" viewBox="0 0 24 24" fill="none"></svg>
    `;
    div.addEventListener('click', ()=> selectOption(i));
    optsWrap.appendChild(div);
  });

  const helpBtn = document.getElementById('helpBtn');
  if(q.important){
    helpBtn.disabled = true;
    helpBtn.innerHTML = '🔒 المساعدة غير متاحة — سؤال مهم';
  } else {
    helpBtn.disabled = false;
    helpBtn.innerHTML = '💡 مساعدة (احذف إجابتين خاطئتين)';
  }

  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('answeredLock').answered = false;
}

function renderStreakBadge(){
  let badge = document.getElementById('streakBadge');
  if(quiz.streak >= 3){
    if(!badge){
      badge = document.createElement('span');
      badge.id = 'streakBadge';
      badge.className = 'streak-badge';
      document.getElementById('liveScore').insertAdjacentElement('afterend', badge);
    } else {
      // إعادة تشغيل أنيميشن الدخول عند كل زيادة
      badge.style.animation = 'none';
      void badge.offsetWidth;
      badge.style.animation = '';
    }
    badge.textContent = `🔥 ${quiz.streak} متتالية`;
  } else if(badge){
    badge.remove();
  }
}

// ---------- رسائل تحفيزية للستريك ----------
const STREAK_GOING_MSGS = [
  '🔥 نار عليك، كمل هيك!',
  '🔥 ماشي زي السكة، لا توقف!',
  '🔥 قوي كتير، استمر!',
  '🔥 ماشالله عليك، خلك هيك!',
  '🔥 تحفة، ما حدا واقف بوجهك!',
  '🔥 رهيب، سلسلة ما بتنكسر!'
];
const STREAK_BROKEN_MSGS = [
  'ولا يهمك، رجعها من جديد 💪',
  'بسيطة، كل واحد بغلط أحياناً — كمل 💪',
  'غلطة وحدة ما بتخلص الحكاية، دوس قدام 💪',
  'طبيعي جداً، المهم ما تحبط وتكمل 💪',
  'لا تحبط، الستريك الجاي رح يكون أطول 💪'
];

function showStreakToast(kind){
  const msgs = kind === 'going' ? STREAK_GOING_MSGS : STREAK_BROKEN_MSGS;
  const text = msgs[Math.floor(Math.random()*msgs.length)];

  document.querySelectorAll('.streak-toast').forEach(el=>el.remove());

  const toast = document.createElement('div');
  toast.className = `streak-toast ${kind === 'going' ? 'toast-going' : 'toast-broken'}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(()=>{
    toast.classList.add('toast-out');
    setTimeout(()=> toast.remove(), 400);
  }, 2200);
}

// ---------- المساعدة ----------
document.getElementById('helpBtn').addEventListener('click', ()=>{
  const q = quiz.pool[quiz.index];
  const wrongIdx = q.options.map((_,i)=>i).filter(i=>i!==q.correct);
  const toRemove = shuffle(wrongIdx).slice(0,2);
  quiz.removedOptions = toRemove;
  quiz.helpUsedOnCurrent = true;

  toRemove.forEach(i=>{
    const el = document.querySelector(`.opt[data-index="${i}"]`);
    if(el) el.classList.add('removed');
  });

  const helpBtn = document.getElementById('helpBtn');
  helpBtn.disabled = true;
  helpBtn.innerHTML = '💡 تم استخدام المساعدة';
});

// ---------- اختيار إجابة ----------
function selectOption(chosenIndex){
  if(document.getElementById('answeredLock').answered) return;
  document.getElementById('answeredLock').answered = true;

  const q = quiz.pool[quiz.index];
  const isCorrect = chosenIndex === q.correct;
  const helped = quiz.helpUsedOnCurrent;

  document.querySelectorAll('.opt').forEach(el=>{
    el.classList.add('locked');
    const idx = Number(el.dataset.index);
    if(idx === q.correct && !(helped && isCorrect)){
      el.classList.add('correct');
      el.querySelector('.icon').innerHTML = checkIcon();
    }
    if(idx === chosenIndex){
      if(helped && isCorrect){
        el.classList.add('helped-correct');
        el.querySelector('.icon').innerHTML = checkIcon();
      } else if(isCorrect){
        el.classList.add('correct');
        el.querySelector('.icon').innerHTML = checkIcon();
      } else {
        el.classList.add('wrong');
        el.querySelector('.icon').innerHTML = crossIcon();
      }
    }
  });

  document.getElementById('helpBtn').disabled = true;

  const prevStreak = quiz.streak;
  if(isCorrect){
    quiz.streak += 1;
    quiz.bestStreak = Math.max(quiz.bestStreak, quiz.streak);
    if(quiz.streak >= 3) showStreakToast('going');
  } else {
    if(prevStreak >= 3) showStreakToast('broken');
    quiz.streak = 0;
  }
  renderStreakBadge();

  quiz.records.push({
    id: q.id,
    level: q.level,
    important: q.important,
    question: q.question,
    options: q.options,
    correct: q.correct,
    chosen: chosenIndex,
    isCorrect,
    helped
  });

  updateStrataProgress();

  const nextBtn = document.getElementById('nextBtn');
  nextBtn.style.display = '';
  nextBtn.textContent = (quiz.index === quiz.pool.length-1) ? 'عرض النتيجة' : 'السؤال التالي ←';
}

document.getElementById('nextBtn').addEventListener('click', ()=>{
  if(quiz.index < quiz.pool.length-1){
    quiz.index++;
    renderQuestion();
  } else {
    showResult();
  }
});

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    const nextBtn = document.getElementById('nextBtn');
    if(nextBtn.style.display !== 'none') nextBtn.click();
  }
});

function checkIcon(){
  return '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
}
function crossIcon(){
  return '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
}

// ---------- النتيجة ----------
function showResult(){
  document.getElementById('quizScreen').style.display = 'none';
  document.getElementById('resultScreen').style.display = '';

  const total = quiz.records.length;
  const correctCount = quiz.records.filter(r=>r.isCorrect).length;
  const score = Math.round((correctCount/total)*100);

  animateGauge(score);
  document.getElementById('scoreLabel').textContent = score;

  let msg;
  if(score >= 90){ msg = 'ممتاز كتير! 🌋 وصلت للُبّ الأرض وأنت متمكن من المادة.'; spawnConfetti(); }
  else if(score >= 75) msg = 'حلو كتير! فاهم أغلب الدرس، راجع بس الأخطاء البسيطة تحت.';
  else if(score >= 50) msg = 'مو سيء، بس في مفاهيم لسا محتاجة مراجعة — شوف قسم المراجعة تحت.';
  else msg = 'الدرس محتاج مراجعة من جديد، راجع الأخطاء تحت وجرب مرة ثانية.';
  document.getElementById('resultMsg').textContent = msg;

  // تفصيل حسب المستوى
  const bdWrap = document.getElementById('breakdown');
  bdWrap.innerHTML = '';
  ['easy','medium','hard'].forEach(lvl=>{
    const recs = quiz.records.filter(r=>r.level===lvl);
    if(!recs.length) return;
    const c = recs.filter(r=>r.isCorrect).length;
    const pct = Math.round((c/recs.length)*100);
    const div = document.createElement('div');
    div.className = 'bd-card';
    div.innerHTML = `
      <span class="lvl-pill ${LEVEL_CLASS[lvl]}">${LEVEL_LABEL[lvl]}</span>
      <div class="frac num">${c}/${recs.length}</div>
      <div class="bar"><i style="width:${pct}%; background:var(--${lvl==='easy'?'accent':lvl==='medium'?'warning':'spark'})"></i></div>
    `;
    bdWrap.appendChild(div);
  });

  // مراجعة الأخطاء + الأسئلة اللي استُخدمت فيها مساعدة (تنحط بالآخر دائماً)
  const mistakes = quiz.records.filter(r=>!r.isCorrect);
  const normalMistakes = quiz.records.filter(r=>!r.isCorrect && !r.helped);
  const helpedOnes = quiz.records.filter(r=>r.helped);
  const reviewCombined = normalMistakes.concat(helpedOnes);

  const reviewWrap = document.getElementById('reviewList');
  reviewWrap.innerHTML = '';
  if(reviewCombined.length === 0){
    reviewWrap.innerHTML = '<div class="empty-note">ما أخطأت ولا سؤال، وما استخدمت مساعدة — 🎉 كامل العلامة!</div>';
  } else {
    reviewCombined.forEach(m=> reviewWrap.appendChild(buildReviewItem(m)));
  }

  // قسم الأسئلة المهمة: الغلط أولاً ثم الصح بالآخر
  const importantRecords = quiz.records.filter(r=>r.important);
  const importantWrap = document.getElementById('importantList');
  const importantHead = document.getElementById('importantSectionHead');
  importantWrap.innerHTML = '';
  if(importantRecords.length === 0){
    importantHead.style.display = 'none';
  } else {
    importantHead.style.display = '';
    const importantOrdered = importantRecords.filter(r=>!r.isCorrect).concat(importantRecords.filter(r=>r.isCorrect));
    importantOrdered.forEach(m=> importantWrap.appendChild(buildReviewItem(m)));
  }

  // حفظ في التخزين المحلي
  const state = QBank.saveAttempt(lessonId, {
    score,
    mistakes: mistakes.map(m=>({ id:m.id }))
  });

  const retryMistakesBtn = document.getElementById('retryMistakesBtn');
  if(mistakes.length){
    retryMistakesBtn.style.display = '';
    retryMistakesBtn.onclick = ()=> startQuiz('mistakes', mistakes.map(m=>m.id));
  } else {
    retryMistakesBtn.style.display = 'none';
  }

  document.getElementById('retryBtn').onclick = ()=> startQuiz(quiz.mode === 'mistakes' ? 'all' : quiz.mode);
}

function buildReviewItem(m){
  const letters = ['أ','ب','ج','د'];
  const div = document.createElement('div');
  div.className = 'review-item';

  let badges = '';
  if(m.important) badges += '<span class="lvl-pill lvl-hard" style="margin-inline-end:6px;">⚠ سؤال مهم</span>';
  if(m.helped) badges += '<span class="lvl-pill lvl-mixed">💡 استُخدمت مساعدة</span>';

  let answerRows;
  if(m.isCorrect){
    answerRows = `
      <div class="a-row correct">
        <span class="lab">إجابتك:</span>
        <span>${letters[m.chosen]}) ${m.options[m.chosen]} ✅</span>
      </div>
    `;
  } else {
    answerRows = `
      <div class="a-row mine">
        <span class="lab">إجابتك:</span>
        <span>${letters[m.chosen]}) ${m.options[m.chosen]}</span>
      </div>
      <div class="a-row correct">
        <span class="lab">الصحيحة:</span>
        <span>${letters[m.correct]}) ${m.options[m.correct]}</span>
      </div>
    `;
  }

  div.innerHTML = `
    ${badges ? `<div style="margin-bottom:10px;">${badges}</div>` : ''}
    <div class="q">${m.question}</div>
    ${answerRows}
  `;
  return div;
}

function animateGauge(score){
  const circle = document.getElementById('gaugeFill');
  const r = 80;
  const c = 2*Math.PI*r;
  circle.style.strokeDasharray = `${c} ${c}`;
  circle.style.strokeDashoffset = c;
  requestAnimationFrame(()=>{
    circle.style.strokeDashoffset = c - (score/100)*c;
  });
}

// ---------- احتفال كونفيتي ----------
function spawnConfetti(){
  const colors = ['#2f6bff','#5b8bff','#ffd60a','#22e07a','#7c3aed'];
  const count = 60;
  for(let i=0;i<count;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const left = Math.random()*100;
    const dur = 2.6 + Math.random()*1.8;
    const delay = Math.random()*0.4;
    const color = colors[Math.floor(Math.random()*colors.length)];
    const rotate = Math.random()*360;
    piece.style.left = left+'vw';
    piece.style.background = color;
    piece.style.animationDuration = dur+'s';
    piece.style.animationDelay = delay+'s';
    piece.style.transform = `rotate(${rotate}deg)`;
    piece.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    document.body.appendChild(piece);
    setTimeout(()=> piece.remove(), (dur+delay)*1000 + 200);
  }
}

// نموذج مخفي لتتبع حالة "تمت الإجابة على هذا السؤال"
(function(){
  const marker = document.createElement('div');
  marker.id = 'answeredLock';
  marker.style.display = 'none';
  document.body.appendChild(marker);
})();
