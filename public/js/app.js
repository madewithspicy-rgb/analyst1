let fullRawResult = '';
let lastParsed = null;
let knowledgeBaseText = '';
let manualOpen = false;

const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('has-file'); });
uploadZone.addEventListener('dragleave', () => { if (!knowledgeBaseText) uploadZone.classList.remove('has-file'); });
uploadZone.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); });

function handleFile(e) { const f = e.target.files[0]; if (f) processFile(f); }

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
  try {
    const r = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url));
    if (!r.ok) return '';
    const data = await r.json();
    const tmp = document.createElement('div');
    tmp.innerHTML = (data.contents || '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    return (tmp.innerText || tmp.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 5000);
  } catch { return ''; }
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
    await delay(200);
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
      const e = await resp.json().catch(() => ({ error: 'HTTP ' + resp.status }));
      throw new Error(e.error || 'Ошибка сервера: ' + resp.status);
    }

    const data = await resp.json();
    fullRawResult = data.raw || '';
    lastParsed = data.parsed;

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
    document.getElementById('pane-raw').innerHTML = '<pre class="raw-pre">' + escHtml(fullRawResult) + '</pre>';
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
    '<div class="chip"><strong>' + c.label + ':</strong> ' + escHtml(c.val) + '</div>'
  ).join('');

  const score = Math.min(10, Math.max(1, parseInt(d.conversion_score) || 5));
  document.getElementById('scoreRow').innerHTML =
    '<span class="score-label">Конверсионность:</span>' +
    '<div class="score-bars">' + Array.from({length:10},(_,i)=>'<div class="score-bar'+(i<score?' filled':'')+'"></div>').join('') + '</div>' +
    '<span class="score-num">' + score + '/10</span>';

  document.getElementById('assessmentCard').textContent = d.overall_assessment || '';

  // Blocks tab
  const blocks = d.blocks || [];
  const newBlocks = d.new_blocks || [];
  let recsHtml = '';

  blocks.forEach(b => {
    const pColor = b.priority === 'high' ? '#E8401A' : b.priority === 'medium' ? '#F59E0B' : '#22C55E';
    const pLabel = b.priority === 'high' ? 'Высокий' : b.priority === 'medium' ? 'Средний' : 'Низкий';
    recsHtml += '<div class="rec-card">';
    recsHtml += '<div class="rec-top"><span class="rec-num">Блок ' + (b.number||'') + '</span>';
    recsHtml += '<span class="rec-section">' + escHtml(b.name||'') + '</span>';
    recsHtml += '<span style="font-size:11px;padding:3px 9px;border-radius:20px;background:' + pColor + '22;color:' + pColor + ';border:1px solid ' + pColor + '44;">' + pLabel + '</span></div>';
    if (b.current_problem) {
      recsHtml += '<div style="font-size:13px;color:#E8401A;margin-bottom:10px;"><strong>Проблема:</strong> ' + escHtml(b.current_problem) + '</div>';
    }
    (b.changes||[]).forEach(ch => {
      recsHtml += '<div style="margin-bottom:12px;">';
      recsHtml += '<div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:4px;">▸ ' + escHtml(ch.element||'') + '</div>';
      if (ch.action) recsHtml += '<div class="rec-action" style="margin-left:14px;">' + escHtml(ch.action) + '</div>';
      if (ch.copy_en) recsHtml += '<div class="rec-copy"><div class="rec-copy-label">EN copy</div><div class="rec-copy-text">' + escHtml(ch.copy_en) + '</div></div>';
      recsHtml += '</div>';
    });
    recsHtml += '</div>';
  });

  if (newBlocks.length) {
    recsHtml += '<div style="font-size:12px;font-weight:500;color:#22C55E;letter-spacing:.08em;text-transform:uppercase;margin:24px 0 12px;padding-top:16px;border-top:1px solid var(--border);">+ Новые блоки</div>';
    newBlocks.forEach(b => {
      recsHtml += '<div class="rec-card" style="border-color:rgba(34,197,94,0.25)">';
      recsHtml += '<div class="rec-top"><span class="rec-num">Блок ' + (b.number||'') + '</span>';
      recsHtml += '<span class="rec-section">' + escHtml(b.name||'') + '</span>';
      recsHtml += '<span style="font-size:11px;padding:3px 9px;border-radius:20px;background:rgba(34,197,94,0.1);color:#22C55E;border:1px solid rgba(34,197,94,0.2);">Добавить</span></div>';
      if (b.reason) recsHtml += '<div style="font-size:13px;color:#22C55E;margin-bottom:10px;"><strong>Зачем:</strong> ' + escHtml(b.reason) + '</div>';
      (b.content||[]).forEach(item => {
        recsHtml += '<div style="margin-bottom:10px;">';
        recsHtml += '<div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:4px;">▸ ' + escHtml(item.element||'') + '</div>';
        if (item.copy_en) recsHtml += '<div class="rec-copy"><div class="rec-copy-label" style="color:#22C55E;">EN copy</div><div class="rec-copy-text" style="background:rgba(34,197,94,0.05);">' + escHtml(item.copy_en) + '</div></div>';
        recsHtml += '</div>';
      });
      recsHtml += '</div>';
    });
  }

  document.getElementById('pane-recs').innerHTML = recsHtml;

  // Copy tab - all EN texts
  const allCopies = [];
  blocks.forEach(b => (b.changes||[]).forEach(ch => { if (ch.copy_en) allCopies.push({ section: 'Блок ' + b.number + ' — ' + b.name, element: ch.element, copy: ch.copy_en }); }));
  newBlocks.forEach(b => (b.content||[]).forEach(item => { if (item.copy_en) allCopies.push({ section: 'Новый блок ' + b.number + ' — ' + b.name, element: item.element, copy: item.copy_en }); }));
  document.getElementById('pane-copy').innerHTML = allCopies.length
    ? allCopies.map(c => '<div class="copy-card"><div class="copy-source">' + escHtml(c.section) + ' / ' + escHtml(c.element||'') + '</div><div class="copy-text">' + escHtml(c.copy) + '</div></div>').join('')
    : '<p style="color:var(--text3);font-size:13px;padding:8px 0;">Добавьте контекст о нише для точных формулировок.</p>';

  // Tasks
  const tasks = d.tasks || [];
  const bClass = w => { const wl = (w||'').toLowerCase(); if (wl.includes('designer')||wl.includes('дизайн')) return 'who-designer'; if (wl.includes('developer')||wl.includes('разработ')) return 'who-developer'; return 'who-pm'; };
  document.getElementById('pane-tasks').innerHTML = tasks.length
    ? '<div class="tasks-list">' + tasks.map(t => '<div class="task-row"><span class="task-badge ' + bClass(t.who) + '">' + escHtml(t.who||'') + '</span><span class="task-text">' + escHtml(t.task||'') + '</span></div>').join('') + '</div>'
    : '<p style="color:var(--text3);font-size:13px;">Задачи не сформированы.</p>';

  document.getElementById('pane-raw').innerHTML = '<pre class="raw-pre">' + escHtml(JSON.stringify(d, null, 2)) + '</pre>';
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector('.tab[data-tab="' + name + '"]')?.classList.add('active');
  document.getElementById('pane-' + name)?.classList.add('active');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function copyDoc() {
  navigator.clipboard.writeText(fullRawResult).then(() => {
    const b = document.querySelector('.results-actions .btn-ghost');
    const orig = b.textContent;
    b.textContent = 'Скопировано!';
    setTimeout(() => b.textContent = orig, 2000);
  });
}

async function downloadDocx() {
  if (!lastParsed) return;
  const btn = event.target;
  const orig = btn.textContent;
  btn.textContent = 'Генерируем...';
  btn.disabled = true;
  try {
    const resp = await fetch('/.netlify/functions/generate-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: lastParsed }),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!data.docx) throw new Error('No docx in response');
    const binary = atob(data.docx);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const name = (lastParsed.site_name || 'site').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
    a.download = 'spicy_recs_' + name + '.docx';
    a.click();
  } catch (err) {
    showError('Ошибка генерации docx: ' + err.message);
  }
  btn.textContent = orig;
  btn.disabled = false;
}

function downloadTxt() {
  const url = document.getElementById('urlInput').value.replace(/https?:\/\//,'').replace(/[\/?.=]/g,'_');
  const blob = new Blob([fullRawResult], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spicy_recs_' + (url || 'site') + '.txt';
  a.click();
}

function resetForm() {
  document.getElementById('urlInput').value = '';
  document.getElementById('resultsSection').style.display = 'none';
  knowledgeBaseText = ''; lastParsed = null;
  uploadZone.classList.remove('has-file');
  document.getElementById('uploadText').textContent = 'Перетащите файл или нажмите';
  document.getElementById('uploadSub').textContent = 'PDF · TXT · DOCX · MD — до 5 МБ';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
