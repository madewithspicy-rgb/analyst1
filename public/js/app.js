let fullRawResult = '';
let knowledgeBaseText = '';
let manualOpen = false;

const uploadZone = document.getElementById('uploadZone');

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('has-file'); });
uploadZone.addEventListener('dragleave', () => { if (!knowledgeBaseText) uploadZone.classList.remove('has-file'); });
uploadZone.addEventListener('drop', e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) processFile(file); });

function handleFile(event) {
  const file = event.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (file.size > 5 * 1024 * 1024) { showError('Файл слишком большой. Максимум 5 МБ.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    knowledgeBaseText = typeof e.target.result === 'string' ? e.target.result : '';
    uploadZone.classList.add('has-file');
    document.getElementById('uploadText').textContent = '✓ ' + file.name;
    document.getElementById('uploadSub').textContent = (knowledgeBaseText.length / 1000).toFixed(1) + 'K символов загружено';
  };
  reader.readAsText(file);
}

function toggleManual() {
  manualOpen = !manualOpen;
  document.getElementById('manualBlock').classList.toggle('open', manualOpen);
  document.getElementById('toggleIcon').style.transform = manualOpen ? 'rotate(180deg)' : '';
}

function setStep(n, msg) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('ps' + i);
    el.className = 'pstep' + (i < n ? ' done' : i === n ? ' active' : '');
  }
  document.getElementById('progressFill').style.width = ((n - 1) / 4 * 100) + '%';
  if (msg) document.getElementById('progressMsg').textContent = msg;
}

function showError(msg) {
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorCard').style.display = 'flex';
}

function hideError() { document.getElementById('errorCard').style.display = 'none'; }

async function fetchSiteText(url) {
  // Try allorigins proxy to get site HTML
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error('proxy failed');
    const data = await resp.json();
    const html = data.contents || '';
    // Strip tags, get readable text
    const tmp = document.createElement('div');
    tmp.innerHTML = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    return (tmp.innerText || tmp.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 5000);
  } catch {
    return '';
  }
}

async function runAnalysis() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url || !url.startsWith('http')) { showError('Введите корректный URL (начинается с https://)'); return; }
  hideError();

  const btn = document.getElementById('scanBtn');
  btn.disabled = true;
  document.querySelector('.btn-scan-text').textContent = 'Анализируем...';
  document.getElementById('progressCard').style.display = 'block';
  document.getElementById('resultsSection').style.display = 'none';

  try {
    setStep(1, 'Загружаем страницу...');
    const siteText = await fetchSiteText(url);

    setStep(2, 'Читаем структуру сайта...');
    await delay(300);
    setStep(3, 'Формируем правки...');

    const resp = await fetch('/.netlify/functions/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        siteText: siteText || null,
        knowledgeBase: knowledgeBaseText || null,
        manualContext: document.getElementById('manualContext').value || null,
      }),
    });

    setStep(4, 'Финализируем документ...');

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(errData.error || `Ошибка сервера: ${resp.status}`);
    }

    const data = await resp.json();
    fullRawResult = data.raw || '';

    document.getElementById('progressFill').style.width = '100%';
    document.getElementById('progressMsg').textContent = 'Готово!';

    setTimeout(() => {
      document.getElementById('progressCard').style.display = 'none';
      renderResults(data.parsed, url);
      btn.disabled = false;
      document.querySelector('.btn-scan-text').textContent = 'Анализировать';
    }, 500);

  } catch (err) {
    showError('Ошибка: ' + err.message);
    document.getElementById('progressCard').style.display = 'none';
    btn.disabled = false;
    document.querySelector('.btn-scan-text').textContent = 'Анализировать';
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function renderResults(d, url) {
  if (!d) {
    document.getElementById('pane-raw').innerHTML = `<pre class="raw-pre">${escHtml(fullRawResult)}</pre>`;
    switchTab('raw', document.querySelector('.tab[data-tab="raw"]'));
    document.getElementById('resultsSection').style.display = 'block';
    return;
  }

  document.getElementById('resultSiteName').textContent = d.site_name || url;
  document.getElementById('resultMeta').textContent = url;

  const chips = [
    d.detected_niche && { label: 'Ниша', val: d.detected_niche },
    d.detected_audience && { label: 'ЦА', val: d.detected_audience },
    d.detected_tone && { label: 'Тон', val: d.detected_tone },
    d.detected_key_value && { label: 'Ценность', val: d.detected_key_value },
  ].filter(Boolean);

  document.getElementById('contextChips').innerHTML = chips.map(c =>
    `<div class="chip"><strong>${c.label}:</strong> ${escHtml(c.val)}</div>`
  ).join('');

  const score = Math.min(10, Math.max(1, parseInt(d.conversion_score) || 5));
  document.getElementById('scoreRow').innerHTML = `
    <span class="score-label">Конверсионность:</span>
    <div class="score-bars">${Array.from({length:10},(_,i)=>`<div class="score-bar${i<score?' filled':''}"></div>`).join('')}</div>
    <span class="score-num">${score}/10</span>`;

  document.getElementById('assessmentCard').textContent = d.overall_assessment || '';

  const recs = d.recommendations || [];
  document.getElementById('pane-recs').innerHTML = recs.map(r => `
    <div class="rec-card">
      <div class="rec-top">
        <span class="rec-num">#${r.id||''}</span>
        ${r.section ? `<span class="rec-section">${escHtml(r.section)}</span>` : ''}
        <span class="badge-${r.priority||'medium'}">${r.priority==='high'?'🔴 Высокий':r.priority==='medium'?'🟡 Средний':'🟢 Низкий'}</span>
      </div>
      <div class="rec-title">${escHtml(r.title||'')}</div>
      <div class="rec-action">${escHtml(r.action||'')}</div>
      ${r.copy_en?`<div class="rec-copy"><div class="rec-copy-label">Текст (American English)</div><div class="rec-copy-text">${escHtml(r.copy_en)}</div></div>`:''}
    </div>`).join('');

  const withCopy = recs.filter(r => r.copy_en);
  document.getElementById('pane-copy').innerHTML = withCopy.length
    ? withCopy.map(r=>`<div class="copy-card"><div class="copy-source">${escHtml(r.section||'')} — ${escHtml(r.title||'')}</div><div class="copy-text">${escHtml(r.copy_en)}</div></div>`).join('')
    : '<p style="color:var(--text3);font-size:13px;padding:8px 0;">Добавьте контекст о нише для точных формулировок.</p>';

  const tasks = d.tasks || [];
  const badgeClass = who => {
    if (!who) return 'who-pm';
    const w = who.toLowerCase();
    if (w.includes('designer')||w.includes('дизайн')) return 'who-designer';
    if (w.includes('developer')||w.includes('разработ')||w.includes('верст')) return 'who-developer';
    return 'who-pm';
  };
  document.getElementById('pane-tasks').innerHTML = tasks.length
    ? `<div class="tasks-list">${tasks.map(t=>`<div class="task-row"><span class="task-badge ${badgeClass(t.who)}">${escHtml(t.who||'')}</span><span class="task-text">${escHtml(t.task||'')}</span></div>`).join('')}</div>`
    : '<p style="color:var(--text3);font-size:13px;">Задачи не сформированы.</p>';

  document.getElementById('pane-raw').innerHTML = `<pre class="raw-pre">${escHtml(JSON.stringify(d,null,2))}</pre>`;
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector(`.tab[data-tab="${name}"]`)?.classList.add('active');
  document.getElementById('pane-' + name)?.classList.add('active');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function copyDoc() {
  navigator.clipboard.writeText(fullRawResult).then(() => {
    const btn = document.querySelector('.results-actions .btn-ghost');
    btn.textContent = 'Скопировано!';
    setTimeout(() => btn.textContent = 'Скопировать', 2000);
  });
}

function downloadDoc() {
  const url = document.getElementById('urlInput').value.replace(/https?:\/\//,'').replace(/[\/?.=]/g,'_');
  const blob = new Blob([fullRawResult], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `spicy_recs_${url||'site'}.txt`;
  a.click();
}

function resetForm() {
  document.getElementById('urlInput').value = '';
  document.getElementById('resultsSection').style.display = 'none';
  knowledgeBaseText = '';
  uploadZone.classList.remove('has-file');
  document.getElementById('uploadText').textContent = 'Перетащите файл или нажмите';
  document.getElementById('uploadSub').textContent = 'PDF · TXT · DOCX · MD — до 5 МБ';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
