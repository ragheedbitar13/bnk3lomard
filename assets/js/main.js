// أدوات مشتركة لكل صفحات الموقع

// حقن الخلفية المتحركة (سديم + نجوم) في كل صفحة
(function injectMagmaField(){
  const field = document.createElement('div');
  field.className = 'magma-field';
  field.innerHTML = '<span class="blob"></span><span class="blob"></span><span class="blob"></span>';
  document.body.prepend(field);

  const stars = document.createElement('div');
  stars.className = 'star-field';
  let starsHtml = '';
  const starCount = 46;
  for(let i=0;i<starCount;i++){
    const top = Math.random()*100;
    const left = Math.random()*100;
    const delay = (Math.random()*3.4).toFixed(2);
    const dur = (2.6 + Math.random()*2.4).toFixed(2);
    starsHtml += `<i style="top:${top}%; left:${left}%; animation-delay:${delay}s; animation-duration:${dur}s;"></i>`;
  }
  stars.innerHTML = starsHtml;
  document.body.prepend(stars);
})();

// طبقة بسيطة فوق localStorage لتخزين تقدّم الطالب
const QBank = {
  key(lessonId){ return `qbank:${lessonId}`; },

  getLessonState(lessonId){
    try{
      const raw = localStorage.getItem(this.key(lessonId));
      return raw ? JSON.parse(raw) : { bestScore: null, attempts: 0, lastMistakes: [] };
    }catch(e){
      return { bestScore: null, attempts: 0, lastMistakes: [] };
    }
  },

  saveAttempt(lessonId, { score, mistakes }){
    const state = this.getLessonState(lessonId);
    state.attempts += 1;
    state.bestScore = state.bestScore === null ? score : Math.max(state.bestScore, score);
    state.lastMistakes = mistakes;
    try{
      localStorage.setItem(this.key(lessonId), JSON.stringify(state));
    }catch(e){ /* تجاهل بيئات بدون تخزين */ }
    return state;
  }
};

window.QBank = QBank;
