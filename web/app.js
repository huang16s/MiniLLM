const view = document.querySelector('#lesson-view');
const nav = document.querySelector('#lesson-nav');
const sidebar = document.querySelector('#sidebar');
const menu = document.querySelector('#menu-toggle');
const progress = document.querySelector('#course-progress');
const progressCount = document.querySelector('#progress-count');
const storageKey = 'minillm-course-v1';
const tabNames = [['notes', '课程讲解'], ['code', '代码练习'], ['quiz', '随堂自测']];
const courseIds = LESSONS.map(lesson => lesson.id);
const saved = readProgress();
const completed = new Set(Array.isArray(saved.completed) ? saved.completed.filter(id => courseIds.includes(id)) : []);
let activeLesson;
let disposeLab = () => {};

function readProgress() {
  try { return JSON.parse(localStorage.getItem(storageKey)) ?? {}; }
  catch { return {}; }
}

function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify({ last: activeLesson.id, completed: [...completed] })); }
  catch { /* The course still works when browser storage is unavailable. */ }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function inlineCode(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function highlightPython(source) {
  const tokens = /"""[\s\S]*?"""|#[^\n]*|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*'|\b(?:import|from|for|while|in|if|elif|else|def|return|with|as|True|False|None)\b|\b\d+(?:\.\d+)?\b/g;
  let html = '';
  let end = 0;
  for (const match of source.matchAll(tokens)) {
    const word = match[0];
    const kind = word.startsWith('#') ? 'comment' : /['"]/.test(word) ? 'string' : /^\d/.test(word) ? 'number' : 'keyword';
    html += `${escapeHtml(source.slice(end, match.index))}<span class="syntax-${kind}">${escapeHtml(word)}</span>`;
    end = match.index + word.length;
  }
  return html + escapeHtml(source.slice(end));
}

function lessonNumber(id) { return String(id).padStart(2, '0'); }

function navigationMarkup() {
  const groups = [...new Set(LESSONS.map(lesson => lesson.group))];
  return groups.map(group => `<section class="nav-group"><h3>${group}</h3>${LESSONS.filter(lesson => lesson.group === group).map(lesson => `
    <a class="nav-entry" data-lesson="${lesson.id}" href="#lesson-${lesson.id}">
      <span class="nav-number">${lessonNumber(lesson.id)}</span>
      <span><strong>${lesson.short}</strong><small>${lesson.subtitle}</small></span>
      <span class="nav-check" aria-label="已完成" hidden>✓</span>
    </a>`).join('')}</section>`).join('');
}

function updateProgress() {
  progress.value = completed.size;
  progressCount.textContent = `${completed.size} / ${LESSONS.length}`;
  nav.querySelectorAll('[data-lesson]').forEach(link => {
    const id = Number(link.dataset.lesson);
    if (id === activeLesson.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
    link.querySelector('.nav-check').hidden = !completed.has(id);
  });
  const button = view.querySelector('#complete-lesson');
  const marked = completed.has(activeLesson.id);
  button.setAttribute('aria-pressed', marked);
  button.textContent = marked ? '✓ 已完成本课' : '标记为已完成';
}

function setMenu(open) {
  menu.setAttribute('aria-expanded', open);
  sidebar.classList.toggle('menu-open', open);
}

function headerMarkup(lesson) {
  const art = lesson.art.map(value => `<span class="art-node">${escapeHtml(value)}</span>`).join('<i class="art-link"></i>');
  return `<header class="hero">
    <div>
      <div class="hero-meta"><span class="lesson-badge">第 ${lessonNumber(lesson.id)} 课</span><span>${lesson.group}</span></div>
      <h1 id="lesson-title" tabindex="-1">${lesson.title}</h1>
      <p>${lesson.summary}</p>
    </div>
    <div class="hero-art" aria-hidden="true"><span class="art-grid"></span><span class="art-spark one">✧</span><span class="art-spark two">✦</span><div class="art-track">${art}</div></div>
  </header>`;
}

function labMarkup(lesson) {
  const controls = LABS[lesson.id].options.map(option => `<label>${option.label}<select data-option="${option.key}">${option.values.map(([value, label]) => `<option value="${escapeHtml(value)}"${value === option.initial ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`).join('');
  return `<section class="lab" aria-labelledby="lab-heading">
    <div class="section-heading"><h2 id="lab-heading">${lesson.labTitle}</h2><span>交互实验</span></div>
    <div class="lab-card">
      <div class="stage">
        <div class="stage-visual" id="stage-visual"></div>
        <div class="stage-notes" id="stage-notes" aria-live="polite"></div>
      </div>
      <div class="transport">
        <div class="transport-buttons">
          <button class="btn primary play" id="play" type="button"></button>
          <button class="btn" id="prev-step" type="button">上一步</button>
          <button class="btn" id="next-step" type="button">下一步</button>
        </div>
        <div class="timeline"><input id="timeline" type="range" min="0" value="0" aria-label="实验步骤"></div>
        <output id="step-count" for="timeline"></output>
      </div>
      <div class="lab-options">${controls}</div>
    </div>
  </section>`;
}

function notesMarkup(lesson) {
  return `<div class="explanation">
    <div><h2>学完这一课</h2><p class="lesson-goal">${inlineCode(lesson.goal)}</p></div>
    ${lesson.topics.map(([title, paragraph], index) => `<section class="topic"><span class="topic-number" aria-hidden="true">${index + 1}</span><div><h3>${title}</h3><p>${inlineCode(paragraph)}</p></div></section>`).join('')}
    <p class="callout">${inlineCode(lesson.takeaway)}</p>
  </div>`;
}

function codeMarkup(lesson, sample) {
  return `<div class="code-intro"><p>在 <code>MiniLLM</code> 目录运行本课的 Python 代码。示例使用 Python 3.12 和 PyTorch，支持 CPU。</p><p><kbd>py -3.12 -X utf8 .\\${escapeHtml(sample.name)}</kbd></p></div>
    <div class="code-box">
      <div class="code-header"><span class="monospace">${escapeHtml(sample.name)}</span><div class="code-actions"><button type="button" class="btn" id="copy-code">复制代码</button><button type="button" class="btn" id="download-code">下载 .py</button></div></div>
      <pre tabindex="0" aria-label="${escapeHtml(sample.name)} 源码"><code>${highlightPython(sample.source)}</code></pre>
    </div>
    <span class="sr-only" id="copy-status" role="status"></span>
    <section class="exercise"><h3>动手试一试</h3><p>${inlineCode(lesson.exercise)}</p><details class="exercise-hint"><summary>查看提示</summary><p>${inlineCode(lesson.hint)}</p></details></section>`;
}

function quizMarkup(lesson) {
  return `<div class="quiz"><h2 class="quiz-title">检查这课学懂了什么</h2>${lesson.quizzes.map((quiz, index) => `
    <form class="quiz-form" data-quiz="${index}">
      <fieldset><legend>${index + 1}. ${quiz.question}</legend>
        <div class="quiz-options">${quiz.choices.map((option, choice) => `<label class="quiz-option"><input type="radio" name="quiz-${index}" value="${choice}" required><span>${inlineCode(option)}</span></label>`).join('')}</div>
      </fieldset>
      <button class="btn" type="submit">检查答案</button>
      <p class="quiz-feedback" role="status"></p>
    </form>`).join('')}</div>`;
}

const tabPanelMarkup = [notesMarkup, codeMarkup, quizMarkup];

function readerMarkup(lesson, sample) {
  return `<section class="reader" aria-label="课程材料">
    <div class="tabs" role="tablist" aria-label="课程材料">${tabNames.map(([key, title], index) => `<button class="tab" id="tab-${key}" type="button" role="tab" aria-controls="panel-${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${title}</button>`).join('')}</div>
    ${tabNames.map(([key], index) => `<div class="tab-panel" id="panel-${key}" role="tabpanel" aria-labelledby="tab-${key}" tabindex="0"${index === 0 ? '' : ' hidden'}>${tabPanelMarkup[index](lesson, sample)}</div>`).join('')}
  </section>`;
}

function footerMarkup(lesson) {
  const index = LESSONS.indexOf(lesson);
  const previous = LESSONS[index - 1];
  const next = LESSONS[index + 1];
  return `<footer class="lesson-footer"><div class="lesson-links">${previous ? `<a class="btn" href="#lesson-${previous.id}">上一课</a>` : ''}${next ? `<a class="btn" href="#lesson-${next.id}">下一课</a>` : ''}</div><button class="btn" id="complete-lesson" type="button" aria-pressed="false"></button></footer>`;
}

function bindLab(lesson) {
  const lab = LABS[lesson.id];
  const stage = view.querySelector('#stage-notes');
  const renderer = createLabRenderer(view.querySelector('#stage-visual'));
  const timeline = view.querySelector('#timeline');
  const stepCount = view.querySelector('#step-count');
  const previous = view.querySelector('#prev-step');
  const next = view.querySelector('#next-step');
  const play = view.querySelector('#play');
  const options = Object.fromEntries(lab.options.map(option => [option.key, option.initial]));
  let frames = lab.build(options);
  let frameIndex = 0;
  let timer;

  function showPlayLabel() {
    const label = timer ? '暂停' : frameIndex === frames.length - 1 ? '重播' : '播放';
    play.innerHTML = `<span class="play-symbol" aria-hidden="true">${timer ? 'Ⅱ' : '▶'}</span>${label}`;
  }

  function stopPlayback() {
    window.clearInterval(timer);
    timer = undefined;
    showPlayLabel();
  }

  function showFrame(index) {
    frameIndex = Math.max(0, Math.min(index, frames.length - 1));
    const frame = frames[frameIndex];
    timeline.max = frames.length - 1;
    timeline.value = frameIndex;
    timeline.setAttribute('aria-valuetext', `第 ${frameIndex + 1} 个画面，共 ${frames.length} 个画面`);
    stepCount.textContent = `${lessonNumber(frameIndex + 1)} / ${lessonNumber(frames.length)}`;
    previous.disabled = frameIndex === 0;
    next.disabled = frameIndex === frames.length - 1;
    if (next.disabled) stopPlayback();
    else showPlayLabel();
    stage.innerHTML = `<div><h3>${frame.title}</h3><p>${frame.description}</p></div><div class="stage-metrics">${frame.metrics.map(([label, value]) => `<div class="stage-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`;
    renderer.update(frame);
  }

  function moveManually(index) { stopPlayback(); showFrame(index); }

  play.addEventListener('click', () => {
    if (timer) { stopPlayback(); return; }
    if (frameIndex === frames.length - 1) showFrame(0);
    timer = window.setInterval(() => showFrame(frameIndex + 1), 1450);
    showPlayLabel();
  });
  previous.addEventListener('click', () => moveManually(frameIndex - 1));
  next.addEventListener('click', () => moveManually(frameIndex + 1));
  timeline.addEventListener('input', () => moveManually(Number(timeline.value)));
  view.querySelectorAll('[data-option]').forEach(select => select.addEventListener('change', () => {
    options[select.dataset.option] = select.value;
    frames = lab.build(options);
    moveManually(frameIndex);
  }));
  showFrame(0);

  return () => { window.clearInterval(timer); renderer.dispose(); };
}

function bindReader(lesson, sample) {
  const tabs = [...view.querySelectorAll('[role="tab"]')];
  const setTab = (index, focus) => {
    tabs.forEach((tab, position) => {
      const selected = position === index;
      tab.tabIndex = selected ? 0 : -1;
      tab.setAttribute('aria-selected', selected);
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setTab(index, false));
    tab.addEventListener('keydown', event => {
      const targets = { ArrowLeft: (index - 1 + tabs.length) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (event.key in targets) { event.preventDefault(); setTab(targets[event.key], true); }
    });
  });

  view.querySelectorAll('.quiz-form').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const quiz = lesson.quizzes[Number(form.dataset.quiz)];
    const choice = Number(new FormData(form).get(`quiz-${form.dataset.quiz}`));
    const correct = choice === quiz.answer;
    const feedback = form.querySelector('.quiz-feedback');
    feedback.className = `quiz-feedback ${correct ? 'correct' : 'incorrect'}`;
    feedback.textContent = correct ? `答对了。${quiz.why}` : `再想想。正确答案是「${quiz.choices[quiz.answer]}」。${quiz.why}`;
  }));

  const copyButton = view.querySelector('#copy-code');
  copyButton.addEventListener('click', async () => {
    const status = view.querySelector('#copy-status');
    const success = await copyText(sample.source);
    copyButton.textContent = success ? '已复制' : '请手动复制';
    status.textContent = success ? '代码已复制到剪贴板' : '可选中代码手动复制，或下载文件';
  });
  view.querySelector('#download-code').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([sample.source], { type: 'text/x-python;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = sample.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.className = 'copy-fallback';
    const focused = document.activeElement;
    document.body.append(field);
    field.select();
    try { return document.execCommand('copy'); }
    catch { return false; }
    finally { field.remove(); focused?.focus(); }
  }
}

function openLesson(id, focus) {
  if (activeLesson?.id === id) return;
  disposeLab();
  activeLesson = LESSONS.find(lesson => lesson.id === id) ?? LESSONS[0];
  const sample = EXAMPLES[LESSONS.indexOf(activeLesson)];
  view.innerHTML = headerMarkup(activeLesson) + labMarkup(activeLesson) + readerMarkup(activeLesson, sample) + footerMarkup(activeLesson);
  document.title = `${activeLesson.short} · MiniLLM`;
  disposeLab = bindLab(activeLesson);
  bindReader(activeLesson, sample);
  view.querySelector('#complete-lesson').addEventListener('click', () => {
    if (completed.has(activeLesson.id)) completed.delete(activeLesson.id);
    else completed.add(activeLesson.id);
    updateProgress();
    saveProgress();
  });
  updateProgress();
  saveProgress();
  if (focus) {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    view.querySelector('#lesson-title').focus({ preventScroll: true });
  }
}

function lessonFromHash() {
  return Number(location.hash.match(/^#lesson-(\d+)$/)?.[1]);
}

nav.innerHTML = navigationMarkup();
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  setMenu(open);
  if (open) nav.querySelector('[aria-current="page"]')?.focus();
});
nav.addEventListener('click', event => {
  const link = event.target.closest('[data-lesson]');
  if (!link || Number(link.dataset.lesson) !== activeLesson.id) return;
  setMenu(false);
  window.scrollTo({ top: 0, behavior: 'instant' });
  view.querySelector('#lesson-title').focus({ preventScroll: true });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); }
});
window.addEventListener('hashchange', () => {
  if (courseIds.includes(lessonFromHash())) openLesson(lessonFromHash(), true);
});
openLesson(lessonFromHash() || saved.last || LESSONS[0].id, false);
