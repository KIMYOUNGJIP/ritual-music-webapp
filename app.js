(() => {
  'use strict';

  const STORAGE_KEY = 'ritual-music-worksheet-v1';

  const LEFT_ITEMS = [
    { id: 'jongmyo', label: '종묘제례악', color: '#c0392b' },
    { id: 'munmyo', label: '문묘제례악', color: '#1c2430' },
    { id: 'yeongsan', label: '영산재', color: '#c8963e' },
    { id: 'ssitgim', label: '씻김굿', color: '#7d4a86' },
    { id: 'daechwita', label: '대취타', color: '#1f7a86' }
  ];

  const RIGHT_ITEMS = [
    { id: 'king', label: '임금의 행차와 군대 행진' },
    { id: 'shaman', label: '죽은 이를 보내는 무속 의식' },
    { id: 'royal', label: '조선 왕과 왕비의 제사' },
    { id: 'confucius', label: '공자를 모시는 제사(석전대제)' },
    { id: 'buddha', label: '불교의 큰 재(齋)' }
  ];

  const LISTEN_TITLES = [
    { title: '종묘제례악', sub: '(왕실 제사)' },
    { title: '문묘제례악', sub: '(공자 제사)' },
    { title: '영산재 / 씻김굿 / 대취타', sub: '(택1)' },
    { title: '모차르트 「레퀴엠」', sub: '(장례 미사)' },
    { title: '「Zadok the Priest」', sub: '(대관식)' },
    { title: '가믈란', sub: '(발리 사원 의식)' }
  ];

  const form = document.getElementById('worksheetForm');
  const saveStatus = document.getElementById('saveStatus');
  const formProgress = document.getElementById('formProgress');
  const progressText = document.getElementById('progressText');

  const tabPage1 = document.getElementById('tabPage1');
  const tabPage2 = document.getElementById('tabPage2');
  const panelPage1 = document.getElementById('panelPage1');
  const panelPage2 = document.getElementById('panelPage2');
  const page1Heading = document.getElementById('page1Heading');
  const page2Heading = document.getElementById('page2Heading');
  const toPage2Btn = document.getElementById('toPage2Btn');
  const toPage1Btn = document.getElementById('toPage1Btn');

  const blanks = Array.from(document.querySelectorAll('.inline-blank'));
  const wordChips = Array.from(document.querySelectorAll('.word-chip'));
  let activeBlankIndex = 0;

  const matchBoard = document.getElementById('matchBoard');
  const matchSvg = document.getElementById('matchSvg');
  const matchStatus = document.getElementById('matchStatus');
  const clearMatchBtn = document.getElementById('clearMatchBtn');
  const matchButtons = Array.from(document.querySelectorAll('.match-item'));

  const q3Words = Array.from(document.querySelectorAll('input[name="q3_words"]'));
  const q3WordCustomCheck = document.getElementById('q3WordCustomCheck');
  const q3WordCustomText = document.getElementById('q3WordCustomText');
  const q3WordHint = document.getElementById('q3WordHint');

  const resetOpenBtn = document.getElementById('resetOpenBtn');
  const resetDialog = document.getElementById('resetDialog');
  const exportDialog = document.getElementById('exportDialog');
  const exportStage = document.getElementById('exportStage');
  const exportLoading = document.getElementById('exportLoading');
  const exportError = document.getElementById('exportError');
  const previewStage = document.getElementById('previewStage');
  const previewImage = document.getElementById('previewImage');
  const previewTabs = Array.from(document.querySelectorAll('.preview-tab'));
  const downloadCombinedBtn = document.getElementById('downloadCombinedBtn');
  const downloadPage1Btn = document.getElementById('downloadPage1Btn');
  const downloadPage2Btn = document.getElementById('downloadPage2Btn');
  const shareBtn = document.getElementById('shareBtn');

  // 상태 객체: { leftId: rightId }
  let matches = {};
  let selectedEndpoint = null; // { side: 'left'|'right', id: string }
  let saveTimer = null;
  let exportedImages = { combined: null, page1: null, page2: null };
  let activePreviewMode = 'combined';

  /* ── 유틸리티 ── */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeFilenamePart(str, fallback) {
    const cleaned = String(str || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_');
    return cleaned || fallback;
  }

  function getStudentLabel() {
    const cls = form.elements.studentClass.value.trim();
    const name = form.elements.studentName.value.trim();
    return {
      cls: cls || '',
      name: name || '',
      filePrefix: `5학년_${safeFilenamePart(cls, '0')}반_${safeFilenamePart(name, '학생')}`
    };
  }

  /* ── 페이지 탭 전환 ── */
  function switchPage(pageNum, moveFocus = false) {
    const isPage1 = pageNum === 1;
    panelPage1.hidden = !isPage1;
    panelPage2.hidden = isPage1;

    tabPage1.classList.toggle('is-active', isPage1);
    tabPage2.classList.toggle('is-active', !isPage1);

    if (isPage1) {
      tabPage1.setAttribute('aria-current', 'step');
      tabPage2.removeAttribute('aria-current');
      requestAnimationFrame(drawMatchLines);
      if (moveFocus) page1Heading.focus();
    } else {
      tabPage2.setAttribute('aria-current', 'step');
      tabPage1.removeAttribute('aria-current');
      if (moveFocus) page2Heading.focus();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabPage1.addEventListener('click', () => switchPage(1, false));
  tabPage2.addEventListener('click', () => switchPage(2, false));
  toPage2Btn.addEventListener('click', () => switchPage(2, true));
  toPage1Btn.addEventListener('click', () => switchPage(1, true));

  /* ── 문항 1: 보기 낱말 채우기 ── */
  function refreshWordChips() {
    const usedValues = new Set(blanks.map((el) => el.value.trim()).filter(Boolean));
    wordChips.forEach((chip) => {
      chip.classList.toggle('is-used', usedValues.has(chip.dataset.word));
    });
  }

  blanks.forEach((blank, idx) => {
    blank.addEventListener('focus', () => {
      activeBlankIndex = idx;
    });
    blank.addEventListener('input', () => {
      refreshWordChips();
      scheduleSave();
    });
  });

  wordChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const word = chip.dataset.word;
      let targetIdx = activeBlankIndex;
      if (blanks[targetIdx] && blanks[targetIdx].value.trim() !== '') {
        const firstEmpty = blanks.findIndex((b) => b.value.trim() === '');
        if (firstEmpty !== -1) targetIdx = firstEmpty;
      }
      const target = blanks[targetIdx] || blanks[0];
      target.value = word;
      refreshWordChips();
      scheduleSave();

      const nextEmpty = blanks.findIndex((b, i) => i > targetIdx && b.value.trim() === '');
      if (nextEmpty !== -1) {
        activeBlankIndex = nextEmpty;
        blanks[nextEmpty].focus();
      } else {
        target.focus();
      }
    });
  });

  /* ── 문항 2: 줄 잇기 ── */
  function findMatchButton(side, id) {
    return matchButtons.find((b) => b.dataset.side === side && b.dataset.id === id);
  }

  function removeMatchByEndpoint(side, id) {
    if (side === 'left') {
      delete matches[id];
    } else {
      for (const [lId, rId] of Object.entries(matches)) {
        if (rId === id) delete matches[lId];
      }
    }
  }

  function getConnectedLeftForRight(rightId) {
    return Object.keys(matches).find((lId) => matches[lId] === rightId) || null;
  }

  function announceMatch(msg) {
    matchStatus.textContent = msg;
  }

  function updateMatchUI() {
    matchButtons.forEach((btn) => {
      const { side, id } = btn.dataset;
      const isSelected = selectedEndpoint && selectedEndpoint.side === side && selectedEndpoint.id === id;
      btn.classList.toggle('is-selected', Boolean(isSelected));
      btn.setAttribute('aria-pressed', String(Boolean(isSelected)));

      let connColor = '';
      let connected = false;
      if (side === 'left' && matches[id]) {
        connected = true;
        connColor = btn.dataset.color;
      } else if (side === 'right') {
        const lId = getConnectedLeftForRight(id);
        if (lId) {
          connected = true;
          const lBtn = findMatchButton('left', lId);
          connColor = lBtn ? lBtn.dataset.color : '#123a63';
        }
      }
      btn.classList.toggle('is-connected', connected);
      if (connected) {
        btn.style.setProperty('--conn-color', connColor);
      } else {
        btn.style.removeProperty('--conn-color');
      }
    });
    drawMatchLines();
  }

  function drawMatchLines() {
    if (panelPage1.hidden) return;
    const boardRect = matchBoard.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height) return;

    matchSvg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
    matchSvg.textContent = '';

    const NS = 'http://www.w3.org/2000/svg';
    for (const [lId, rId] of Object.entries(matches)) {
      const lBtn = findMatchButton('left', lId);
      const rBtn = findMatchButton('right', rId);
      if (!lBtn || !rBtn) continue;

      const lDot = lBtn.querySelector('.match-dot').getBoundingClientRect();
      const rDot = rBtn.querySelector('.match-dot').getBoundingClientRect();

      const x1 = lDot.left + lDot.width / 2 - boardRect.left;
      const y1 = lDot.top + lDot.height / 2 - boardRect.top;
      const x2 = rDot.left + rDot.width / 2 - boardRect.left;
      const y2 = rDot.top + rDot.height / 2 - boardRect.top;
      const cx = (x2 - x1) * 0.45;

      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + cx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - cx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', lBtn.dataset.color || '#123a63');
      path.setAttribute('stroke-width', '3.5');
      path.setAttribute('stroke-linecap', 'round');
      matchSvg.appendChild(path);
    }
  }

  matchButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const { side, id } = btn.dataset;
      const label = btn.querySelector('.match-text').textContent.trim();

      if (!selectedEndpoint) {
        const alreadyConnected = side === 'left' ? Boolean(matches[id]) : Boolean(getConnectedLeftForRight(id));
        if (alreadyConnected) {
          removeMatchByEndpoint(side, id);
          updateMatchUI();
          scheduleSave();
          announceMatch(`${label} 연결이 지워졌습니다.`);
          return;
        }
        selectedEndpoint = { side, id };
        updateMatchUI();
        announceMatch(`${label} 선택됨. 이어 줄 반대쪽 항목을 누르세요.`);
        return;
      }

      if (selectedEndpoint.side === side) {
        if (selectedEndpoint.id === id) {
          selectedEndpoint = null;
          updateMatchUI();
          return;
        }
        selectedEndpoint = { side, id };
        updateMatchUI();
        announceMatch(`${label} 선택됨.`);
        return;
      }

      const leftId = side === 'left' ? id : selectedEndpoint.id;
      const rightId = side === 'right' ? id : selectedEndpoint.id;

      removeMatchByEndpoint('left', leftId);
      removeMatchByEndpoint('right', rightId);
      matches[leftId] = rightId;
      selectedEndpoint = null;
      updateMatchUI();
      scheduleSave();

      const lLabel = findMatchButton('left', leftId).querySelector('.match-text').textContent.trim();
      const rLabel = findMatchButton('right', rightId).querySelector('.match-text').textContent.trim();
      announceMatch(`${lLabel}과(와) ${rLabel}을(를) 연결했습니다.`);
    });
  });

  clearMatchBtn.addEventListener('click', () => {
    matches = {};
    selectedEndpoint = null;
    updateMatchUI();
    scheduleSave();
    announceMatch('모든 연결 선을 지웠습니다.');
  });

  if (window.ResizeObserver) {
    new ResizeObserver(drawMatchLines).observe(matchBoard);
  }
  window.addEventListener('resize', drawMatchLines);

  /* ── 문항 3: 어울리는 낱말 최대 2개 제한 ── */
  function checkedWordCount() {
    return q3Words.filter((cb) => cb.checked).length;
  }

  q3Words.forEach((cb) => {
    cb.addEventListener('change', () => {
      if (checkedWordCount() > 2) {
        cb.checked = false;
        q3WordHint.textContent = '어울리는 낱말은 두 개까지 고를 수 있어요.';
      } else {
        q3WordHint.textContent = '';
      }
      scheduleSave();
    });
  });

  q3WordCustomText.addEventListener('input', () => {
    const hasText = q3WordCustomText.value.trim().length > 0;
    if (hasText && !q3WordCustomCheck.checked) {
      if (checkedWordCount() < 2) {
        q3WordCustomCheck.checked = true;
        q3WordHint.textContent = '';
      } else {
        q3WordHint.textContent = '이미 2개를 선택했어요. 다른 낱말을 먼저 해제해 주세요.';
      }
    }
    scheduleSave();
  });

  /* ── 자동 저장 & 진행률 ── */
  function collectState() {
    const data = {
      fields: {},
      radios: {},
      checkboxes: {},
      matches: { ...matches }
    };

    const elements = Array.from(form.elements);
    for (const el of elements) {
      if (!el.name) continue;
      if (el.type === 'radio') {
        if (el.checked) data.radios[el.name] = el.value;
      } else if (el.type === 'checkbox') {
        if (!data.checkboxes[el.name]) data.checkboxes[el.name] = [];
        if (el.checked) data.checkboxes[el.name].push(el.value);
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        data.fields[el.name] = el.value;
      }
    }
    return data;
  }

  function applyState(data) {
    if (!data || typeof data !== 'object') return;
    const fields = data.fields || {};
    const radios = data.radios || {};
    const checkboxes = data.checkboxes || {};

    for (const el of Array.from(form.elements)) {
      if (!el.name) continue;
      if (el.type === 'radio') {
        el.checked = radios[el.name] === el.value;
      } else if (el.type === 'checkbox') {
        const arr = checkboxes[el.name] || [];
        el.checked = arr.includes(el.value);
      } else if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.name in fields) {
        el.value = fields[el.name];
      }
    }

    matches = data.matches && typeof data.matches === 'object' ? { ...data.matches } : {};
    refreshWordChips();
    updateMatchUI();
  }

  function updateProgress() {
    const state = collectState();
    const f = state.fields;
    let done = 0;
    const total = 15;

    if ((f.studentClass || '').trim() && (f.studentName || '').trim()) done++;
    if (blanks.some((b) => b.value.trim())) done++;
    if (blanks.every((b) => b.value.trim())) done++;
    if (Object.keys(matches).length >= 3) done++;
    if (Object.keys(matches).length === 5) done++;
    if (state.radios.q3_tempo) done++;
    if (state.radios.q3_syllable) done++;
    if ((state.checkboxes.q3_sounds || []).length > 0) done++;
    if ((state.checkboxes.q3_words || []).length > 0) done++;
    if ((f.q4_s1 || '').trim() || (f.q4_e1 || '').trim()) done++;
    if ((f.report_title || '').trim()) done++;
    if ((f.report_meaning || '').trim()) done++;
    if ((f.report_feature || '').trim()) done++;
    if ((f.report_value || '').trim()) done++;
    if ((f.class_moment || '').trim() || (f.class_start || '').trim() || (f.class_end || '').trim()) done++;

    const pct = Math.round((done / total) * 100);
    formProgress.value = pct;
    progressText.textContent = `${pct}% 작성`;
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
      saveStatus.textContent = '자동 저장됨';
    } catch (_) {
      saveStatus.textContent = '저장 공간 부족';
    }
    updateProgress();
  }

  function scheduleSave() {
    saveStatus.textContent = '저장 중…';
    updateProgress();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }

  form.addEventListener('input', (e) => {
    if (e.target.name === 'q3_word_custom') return;
    scheduleSave();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'q3_words') return;
    scheduleSave();
  });

  // IME 조합 중 Enter로 폼 제출 방지
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.isComposing) {
      e.preventDefault();
    }
  });

  /* ── 초기화 다이얼로그 ── */
  resetOpenBtn.addEventListener('click', () => {
    resetDialog.showModal();
  });

  resetDialog.addEventListener('close', () => {
    const choice = resetDialog.returnValue;
    resetDialog.returnValue = '';
    if (choice === 'confirm') {
      form.reset();
      matches = {};
      selectedEndpoint = null;
      q3WordHint.textContent = '';
      localStorage.removeItem(STORAGE_KEY);
      refreshWordChips();
      updateMatchUI();
      updateProgress();
      saveStatus.textContent = '초기화됨';
    }
  });

  /* ── closedby="any" Safari 폴백 (modern-web-guidance) ── */
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const isOutside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = isOutside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && isOutside(e, dialog)) dialog.close();
      });
    }
  }

  exportDialog.addEventListener('close', () => {
    exportDialog.returnValue = '';
  });

  /* ── A4 오프스크린 HTML 생성 (고해상도 PNG용) ── */
  function renderCheckItem(checked, label) {
    return `<span style="margin-right:10px;display:inline-flex;align-items:center;"><span class="a4-ck ${checked ? 'on' : ''}">${checked ? '✓' : ''}</span>${escapeHtml(label)}</span>`;
  }

  function renderFillSpan(text, minW = 66) {
    const val = (text || '').trim();
    return `<span class="a4-fill ${val ? '' : 'empty'}" style="min-width:${minW}px">${val ? escapeHtml(val) : '&nbsp;'}</span>`;
  }

  function buildA4Page1HTML(state) {
    const f = state.fields;
    const r = state.radios;
    const c = state.checkboxes;
    const sounds = c.q3_sounds || [];
    const words = c.q3_words || [];
    const customWord = (f.q3_word_custom || '').trim();

    return `
      <div class="a4-sheet" id="a4Sheet1">
        <div class="a4-head">
          <div>
            <div class="a4-sub">음악 5학년 · 3단원 「음악의 즐거움을 함께해요」 · 교과서 64~65쪽</div>
            <div class="a4-ttl">의식 음악 듣기 기록장</div>
          </div>
          <div class="a4-who">
            5학년 <span class="a4-u">${f.studentClass ? escapeHtml(f.studentClass) : '&nbsp;'}</span>반
            &nbsp;이름 <span class="a4-u nm">${f.studentName ? escapeHtml(f.studentName) : '&nbsp;'}</span>
          </div>
        </div>

        <!-- 1 -->
        <div class="a4-q">
          <div class="a4-qh">
            <div class="a4-qn">1</div>
            <div class="a4-qt">의식 음악이 무엇인지 채워 봅시다.</div>
            <div class="a4-qs">보기에서 골라 쓰기</div>
          </div>
          <div>
            <span class="a4-word">순서</span><span class="a4-word">감상</span><span class="a4-word">한 부분</span><span class="a4-word">특별한</span><span class="a4-word">신호</span>
          </div>
          <div class="a4-sent">
            의식이란 정해진 ${renderFillSpan(f.q1_1, 56)}대로 치르는 중요한 일이다.
            의식 음악은 그 일과 함께 붙어 있는 음악으로,
            ${renderFillSpan(f.q1_2, 56)}하려고 만든 음악이 아니라 의식의 ${renderFillSpan(f.q1_3, 72)}으로 쓰인다.<br>
            의식 음악이 하는 일은 세 가지다. 첫째, 지금부터가 ${renderFillSpan(f.q1_4, 56)} 시간이라고 알린다.
            둘째, 여러 사람의 마음과 몸을 하나로 맞춘다. 셋째, 지금이 어느 순서인지
            ${renderFillSpan(f.q1_5, 56)}를 보낸다.
          </div>
        </div>

        <!-- 2 -->
        <div class="a4-q">
          <div class="a4-qh">
            <div class="a4-qn">2</div>
            <div class="a4-qt">우리나라의 의식 음악을 알맞게 이어 봅시다.</div>
            <div class="a4-qs">선으로 잇기</div>
          </div>
          <div class="a4-match" id="a4MatchBoard">
            <div class="a4-mcol">
              ${LEFT_ITEMS.map((it) => `<div class="a4-mi" data-l="${it.id}" data-color="${it.color}" style="color:${it.color}">${escapeHtml(it.label)}<i></i></div>`).join('')}
            </div>
            <div class="a4-mgap"></div>
            <div class="a4-mcol r">
              ${RIGHT_ITEMS.map((it) => `<div class="a4-mi" data-r="${it.id}"><i></i>${escapeHtml(it.label)}</div>`).join('')}
            </div>
          </div>
        </div>

        <!-- 3 -->
        <div class="a4-q">
          <div class="a4-qh">
            <div class="a4-qn">3</div>
            <div class="a4-qt">「종묘제례악」을 들으며 표시해 봅시다.</div>
            <div class="a4-qs">들으면서 바로 체크</div>
          </div>
          <table class="a4-table">
            <tr>
              <td class="h">빠르기</td>
              <td>
                ${renderCheckItem(r.q3_tempo === '아주 느리다', '아주 느리다')}
                ${renderCheckItem(r.q3_tempo === '보통이다', '보통이다')}
                ${renderCheckItem(r.q3_tempo === '빠르다', '빠르다')}
              </td>
            </tr>
            <tr>
              <td class="h">한 글자의 길이</td>
              <td>
                ${renderCheckItem(r.q3_syllable === '아주 길게 끈다', '아주 길게 끈다')}
                ${renderCheckItem(r.q3_syllable === '보통이다', '보통이다')}
                ${renderCheckItem(r.q3_syllable === '짧게 끊는다', '짧게 끊는다')}
              </td>
            </tr>
            <tr>
              <td class="h">들리는 소리</td>
              <td>
                ${renderCheckItem(sounds.includes('쇠붙이(종)'), '쇠붙이(종)')}
                ${renderCheckItem(sounds.includes('돌(경쇠)'), '돌(경쇠)')}
                ${renderCheckItem(sounds.includes('피리·대금'), '피리·대금')}
                ${renderCheckItem(sounds.includes('북'), '북')}
                ${renderCheckItem(sounds.includes('사람 노랫소리'), '사람 노랫소리')}
                ${renderCheckItem(sounds.includes('긁는 소리'), '긁는 소리')}
              </td>
            </tr>
            <tr>
              <td class="h">어울리는 낱말<br><span style="font-weight:500;font-size:10.5px">두 개까지</span></td>
              <td>
                ${renderCheckItem(words.includes('엄숙하다'), '엄숙하다')}
                ${renderCheckItem(words.includes('웅장하다'), '웅장하다')}
                ${renderCheckItem(words.includes('신난다'), '신난다')}
                ${renderCheckItem(words.includes('낯설다'), '낯설다')}
                ${renderCheckItem(words.includes('차분하다'), '차분하다')}
                ${renderCheckItem(words.includes('지루하다'), '지루하다')}
                ${renderCheckItem(words.includes('__custom__') || Boolean(customWord), '(직접)')}
                ${renderFillSpan(customWord, 56)}
              </td>
            </tr>
            <tr>
              <td class="h">가장 인상 깊은 것</td>
              <td style="height:40px;vertical-align:top"><span class="a4-answer-inline">${escapeHtml(f.q3_impression || '')}</span></td>
            </tr>
          </table>
        </div>

        <!-- 4 -->
        <div class="a4-q" style="flex:1;min-height:0">
          <div class="a4-qh">
            <div class="a4-qn">4</div>
            <div class="a4-qt">시작과 끝을 알리는 신호를 순서대로 써 봅시다.</div>
            <div class="a4-qs">교과서 65쪽 ③번</div>
          </div>

          <div class="a4-sig-ttl" style="color:var(--teal)">시작 — 집례가 “드오!” 하고 외친 뒤</div>
          <div class="a4-sig">
            <div class="lab">시작</div>
            <div class="cell given"><b>박</b>한 번</div>
            <div class="cell">${f.q4_s1 ? `<b>${escapeHtml(f.q4_s1)}</b>` : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )'}<span>한 번</span></div>
            <div class="cell">${f.q4_s2 ? `<b>${escapeHtml(f.q4_s2)}</b>` : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )'}<span>두 번</span></div>
            <div class="cell">${f.q4_s3 ? `<b>${escapeHtml(f.q4_s3)}</b>` : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )'}<span>한 번</span></div>
            <div class="cell">${f.q4_s4 ? `<b>${escapeHtml(f.q4_s4)}</b>` : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )'}<span>한 번</span></div>
          </div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:4px">↑ 가운데 세 칸을 <b>세 번</b> 반복한다.</div>

          <div class="a4-sig-ttl" style="color:var(--plum);margin-top:10px">끝 — 집례가 “지오!” 하고 외친 뒤</div>
          <div class="a4-sig">
            <div class="lab" style="background:var(--plum)">끝</div>
            <div class="cell">${f.q4_e1 ? `<b>${escapeHtml(f.q4_e1)}</b>` : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )'}</div>
            <div class="cell">${f.q4_e2 ? `<b>${escapeHtml(f.q4_e2)}</b>` : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )'}<span style="font-size:10.5px">+ 어 딱 딱</span></div>
            <div class="cell">${f.q4_e3 ? `<b>${escapeHtml(f.q4_e3)}</b>` : '( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )'}<span style="font-size:10.5px">+ 어 드르륵</span></div>
            <div class="cell" style="color:#aaa">… 세 번 …</div>
            <div class="cell given"><b>어</b><span style="font-size:10.5px">드르륵 (마지막)</span></div>
          </div>

          <div class="a4-note">
            <b>우리 모둠이 쓸 물건</b> —
            박 → ${renderFillSpan(f.q4_item_bak, 68)}
            축 → ${renderFillSpan(f.q4_item_chuk, 68)}
            절고 → ${renderFillSpan(f.q4_item_jeolgo, 68)}
            어 → ${renderFillSpan(f.q4_item_eo, 68)}
          </div>
        </div>

        <div class="a4-foot"><div>의식 음악 (1/2)</div><div class="r">음악 5학년 64~65쪽</div></div>
      </div>
    `;
  }

  function buildA4Page2HTML(state) {
    const f = state.fields;
    const c = state.checkboxes;

    const listenRowsHtml = LISTEN_TITLES.map((item, idx) => {
      const checked = (c[`listen_ck_${idx}`] || []).length > 0;
      const note = f[`listen_note_${idx}`] || '';
      return `
        <tr>
          <td class="c" style="width:9%;height:29px">${checked ? '✓' : ''}</td>
          <td style="width:47%">${escapeHtml(item.title)} <span style="color:#888">${escapeHtml(item.sub)}</span></td>
          <td style="color:var(--navy);font-weight:700">${escapeHtml(note)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="a4-sheet" id="a4Sheet2">
        <div class="a4-head">
          <div>
            <div class="a4-sub">교과서 65쪽 ④번 — “종묘제례악”의 의미와 특징, 가치가 드러나게</div>
            <div class="a4-ttl">음악 보고서</div>
          </div>
          <div class="a4-who">
            5학년 <span class="a4-u">${f.studentClass ? escapeHtml(f.studentClass) : '&nbsp;'}</span>반
            &nbsp;이름 <span class="a4-u nm">${f.studentName ? escapeHtml(f.studentName) : '&nbsp;'}</span>
          </div>
        </div>

        <div class="a4-report-title">
          <span style="font-size:14px;font-weight:900;color:var(--navy);white-space:nowrap">보고서 제목</span>
          <span style="flex:1;border-bottom:1.5px solid #999;min-height:22px;font-size:14.5px;font-weight:900;color:var(--navy);padding:0 6px">${escapeHtml(f.report_title || '')}</span>
          <span style="font-size:11px;color:var(--muted);white-space:nowrap">예) 600년째 멈추지 않은 음악</span>
        </div>

        <div class="a4-rep">
          <div class="a4-rbox a4-r1">
            <div class="rh"><span class="rt">의미</span><span class="rd">이 음악은 무엇인가 — 누가 · 언제 · 어디서 · 무엇을 위해</span></div>
            <div class="hint">쓸 거리 : 왕과 왕비의 제사 음악 · 세종이 만들고 세조 때부터 · 노래·연주·춤이 함께 · 국가무형유산 1호 · 유네스코 등재</div>
            <div class="body">${escapeHtml(f.report_meaning || '')}</div>
          </div>

          <div class="a4-rbox a4-r2">
            <div class="rh"><span class="rt">특징</span><span class="rd">어떻게 들리고 어떻게 하는가 — 내 귀로 들은 것</span></div>
            <div class="hint">쓸 거리 : 아주 느리다 · 한 글자를 길게 끈다 · 등가와 헌가가 번갈아 · 축으로 시작 어로 끝 · 64명이 똑같이 춤춘다</div>
            <div class="body">${escapeHtml(f.report_feature || '')}</div>
          </div>

          <div class="a4-rbox a4-r3">
            <div class="rh"><span class="rt">가치</span><span class="rd">왜 소중한가 — <b>누구에게</b> · <b>왜</b> 를 꼭 넣어 쓸 것</span></div>
            <div class="hint">“좋았다·신기했다”로 끝내면 감상문이다. 「악보가 남아서 …」 「그래서 우리에게 …이다」처럼 이어 쓸 것</div>
            <div class="body">${escapeHtml(f.report_value || '')}</div>
          </div>
        </div>

        <div class="a4-bottom-split">
          <div style="flex:1.25">
            <div style="font-size:13.5px;font-weight:900;color:var(--navy);margin-bottom:6px">내가 들어 본 음악에 ✓ 하고, 한마디씩 적기</div>
            <table class="a4-table" style="font-size:12px">
              <tr><th style="width:9%">✓</th><th style="width:47%">들은 음악</th><th>한마디</th></tr>
              ${listenRowsHtml}
            </table>
          </div>

          <div style="flex:1;display:flex;flex-direction:column">
            <div style="font-size:13.5px;font-weight:900;color:var(--green);margin-bottom:6px">우리 반이 의식 음악을 만든다면</div>
            <div class="a4-class-box">
              <div class="a4-class-item">
                <div class="a4-class-lbl">어떤 순간에?</div>
                <div class="a4-class-val">${escapeHtml(f.class_moment || '')}</div>
              </div>
              <div class="a4-class-item">
                <div class="a4-class-lbl">시작 소리는?</div>
                <div class="a4-class-val">${escapeHtml(f.class_start || '')}</div>
              </div>
              <div class="a4-class-item">
                <div class="a4-class-lbl">끝 소리는?</div>
                <div class="a4-class-val">${escapeHtml(f.class_end || '')}</div>
              </div>
            </div>
            <div class="a4-note" style="font-size:11.5px;margin-top:8px">
              <b>몇 년 뒤 후배들도</b> 그 소리를 그대로 쓴다면, 그것이 우리 학교의 의식 음악이 된다.
            </div>
          </div>
        </div>

        <div class="a4-foot"><div>음악 보고서 (2/2)</div><div class="r">음악 5학년 64~65쪽</div></div>
      </div>
    `;
  }

  // A4 시트의 2번 문항 연결선을 <canvas> 오버레이로 그려 html2canvas 호환성 100% 보장
  function paintA4MatchLines(a4MatchEl, currentMatches) {
    const rect = a4MatchEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '3';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    for (const [lId, rId] of Object.entries(currentMatches)) {
      const lEl = a4MatchEl.querySelector(`[data-l="${lId}"]`);
      const rEl = a4MatchEl.querySelector(`[data-r="${rId}"]`);
      if (!lEl || !rEl) continue;

      const lDot = lEl.querySelector('i').getBoundingClientRect();
      const rDot = rEl.querySelector('i').getBoundingClientRect();
      const color = lEl.dataset.color || '#123a63';

      const x1 = lDot.left + lDot.width / 2 - rect.left;
      const y1 = lDot.top + lDot.height / 2 - rect.top;
      const x2 = rDot.left + rDot.width / 2 - rect.left;
      const y2 = rDot.top + rDot.height / 2 - rect.top;
      const cx = (x2 - x1) * 0.45;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + cx, y1, x2 - cx, y2, x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      [
        [x1, y1],
        [x2, y2]
      ].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }

    a4MatchEl.appendChild(canvas);
  }

  function stitchCanvases(c1, c2) {
    const gap = 24;
    const out = document.createElement('canvas');
    out.width = Math.max(c1.width, c2.width);
    out.height = c1.height + gap + c2.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#e7e1d4';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c1, 0, 0);
    ctx.drawImage(c2, 0, c1.height + gap);
    return out;
  }

  function showPreviewMode(mode) {
    activePreviewMode = mode;
    previewTabs.forEach((tab) => {
      const selected = tab.dataset.preview === mode;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    if (exportedImages[mode]) {
      previewImage.src = exportedImages[mode];
    }
  }

  previewTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      showPreviewMode(tab.dataset.preview);
    });
  });

  function triggerDownload(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function generateExportImages() {
    exportedImages = { combined: null, page1: null, page2: null };
    exportLoading.hidden = false;
    exportError.hidden = true;
    previewStage.hidden = true;
    downloadCombinedBtn.disabled = true;
    downloadPage1Btn.disabled = true;
    downloadPage2Btn.disabled = true;
    shareBtn.hidden = true;

    if (typeof window.html2canvas !== 'function') {
      exportLoading.hidden = true;
      exportError.hidden = false;
      exportError.textContent = '이미지 변환 도구(html2canvas)를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
      return;
    }

    try {
      saveNow();
      const state = collectState();
      exportStage.innerHTML = buildA4Page1HTML(state) + buildA4Page2HTML(state);

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const a4Match = document.getElementById('a4MatchBoard');
      if (a4Match) {
        paintA4MatchLines(a4Match, state.matches);
      }

      const sheet1 = document.getElementById('a4Sheet1');
      const sheet2 = document.getElementById('a4Sheet2');

      const opts = {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      };

      const canvas1 = await window.html2canvas(sheet1, opts);
      const canvas2 = await window.html2canvas(sheet2, opts);
      const combinedCanvas = stitchCanvases(canvas1, canvas2);

      exportedImages.page1 = canvas1.toDataURL('image/png');
      exportedImages.page2 = canvas2.toDataURL('image/png');
      exportedImages.combined = combinedCanvas.toDataURL('image/png');

      exportStage.innerHTML = '';

      exportLoading.hidden = true;
      previewStage.hidden = false;
      showPreviewMode('combined');

      downloadCombinedBtn.disabled = false;
      downloadPage1Btn.disabled = false;
      downloadPage2Btn.disabled = false;

      // Web Share API 파일 공유 지원 여부 확인
      if (navigator.canShare && typeof File === 'function') {
        try {
          const res = await fetch(exportedImages.combined);
          const blob = await res.blob();
          const { filePrefix } = getStudentLabel();
          const testFile = new File([blob], `${filePrefix}_의식음악_학습지.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [testFile] })) {
            shareBtn.hidden = false;
          }
        } catch (_) {
          shareBtn.hidden = true;
        }
      }
    } catch (err) {
      exportLoading.hidden = true;
      exportError.hidden = false;
      exportError.textContent = `이미지를 만드는 중 오류가 발생했습니다: ${err && err.message ? err.message : '알 수 없는 오류'}`;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    exportDialog.showModal();
    generateExportImages();
  });

  downloadCombinedBtn.addEventListener('click', () => {
    if (!exportedImages.combined) return;
    const { filePrefix } = getStudentLabel();
    triggerDownload(exportedImages.combined, `${filePrefix}_의식음악_학습지.png`);
  });

  downloadPage1Btn.addEventListener('click', () => {
    if (!exportedImages.page1) return;
    const { filePrefix } = getStudentLabel();
    triggerDownload(exportedImages.page1, `${filePrefix}_1면_듣기기록장.png`);
  });

  downloadPage2Btn.addEventListener('click', () => {
    if (!exportedImages.page2) return;
    const { filePrefix } = getStudentLabel();
    triggerDownload(exportedImages.page2, `${filePrefix}_2면_음악보고서.png`);
  });

  shareBtn.addEventListener('click', async () => {
    const dataUrl = exportedImages[activePreviewMode] || exportedImages.combined;
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const { filePrefix } = getStudentLabel();
      const file = new File([blob], `${filePrefix}_의식음악_학습지.png`, { type: 'image/png' });
      await navigator.share({
        title: '의식 음악 학습지',
        files: [file]
      });
    } catch (_) {
      // 사용자가 공유 창을 닫은 경우 무시
    }
  });

  /* ── 초기 복원 ── */
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      applyState(JSON.parse(saved));
      saveStatus.textContent = '이전 작성 불러옴';
    }
  } catch (_) {
    // 저장된 데이터가 손상된 경우 무시
  }
  updateProgress();
  requestAnimationFrame(drawMatchLines);
})();
