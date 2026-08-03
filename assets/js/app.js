(function () {
  'use strict';

  const config = window.APP_CONFIG;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');
  let focusInterval = null;

  const routes = [
    { id: 'home', label: '首页', icon: 'home' },
    { id: 'tasks', label: '今日任务', icon: 'tasks' },
    { id: 'preview', label: '预习单', icon: 'preview' },
    { id: 'map', label: '成长地图', icon: 'map' },
    { id: 'archive', label: '成长档案', icon: 'archive' }
  ];

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const BADGE_STAGE_ORDER = { locked:0, sprout:1, growth:2, shine:3 };
  const BADGE_STAGE_LABELS = { locked:'未点亮', sprout:'萌芽', growth:'成长', shine:'闪耀' };

  function normalizeReward(reward = {}) {
    return {
      growthStars: Number(reward.growthStars ?? reward.stars ?? 0),
      exploreCoins: Number(reward.exploreCoins ?? reward.coins ?? 0),
      xp: Number(reward.xp ?? 0),
      mapEnergy: Number(reward.mapEnergy ?? 0)
    };
  }

  function defaultAbilitiesForTask(task = {}) {
    const map = {
      '数学':['math-thinker','thinking-engineer'],
      '英语':['oral-communicator','english-explorer'],
      '语文':['reader','expression-master'],
      '阅读':['reader','retell-teacher'],
      '科学':['science-experimenter','question-detective'],
      '思维':['thinking-engineer','pattern-finder'],
      '预习':['preview-explorer','question-detective']
    };
    return map[task.subject] || ['task-starter'];
  }

  function migrateLegacyState(parsed) {
    const next = clone(window.DEFAULT_APP_STATE);
    if (!parsed || typeof parsed !== 'object') return next;
    next.profile = mergeState(next.profile, parsed.profile || {});
    if (Array.isArray(parsed.tasks)) {
      next.tasks = parsed.tasks.map((task) => ({
        ...task,
        reward: normalizeReward(task.reward),
        abilities: Array.isArray(task.abilities) && task.abilities.length ? task.abilities : defaultAbilitiesForTask(task)
      }));
    }
    for (const key of ['weekly','previewLessons','mapRegions','learningCalendar','history','previewSkill','focusTimer']) {
      if (parsed[key] !== undefined) next[key] = mergeState(next[key], parsed[key]);
    }
    next.wallet.growthStars = Number(parsed.wallet?.growthStars ?? parsed.wallet?.stars ?? next.wallet.growthStars);
    next.wallet.exploreCoins = Number(parsed.wallet?.exploreCoins ?? parsed.wallet?.coins ?? next.wallet.exploreCoins);
    next.wallet.mapKeys = Number(parsed.wallet?.mapKeys ?? next.wallet.mapKeys);
    next.wallet.chestProgress = Number(parsed.wallet?.chestProgress ?? next.wallet.chestProgress);
    const oldBadgeMap = {
      'streak-7':['milestone-streak-7',7],
      'time-manager':['time-manager',3],
      'speaker':['oral-communicator',5],
      'reader':['reader',4],
      'questioner':['question-detective',5]
    };
    (parsed.badges || []).forEach((old) => {
      const mapping = oldBadgeMap[old.id];
      if (!mapping || !old.unlocked) return;
      const badge = next.badges.find((item) => item.id === mapping[0]);
      if (badge) badge.progress = Math.max(Number(badge.progress || 0), mapping[1]);
    });
    next.learningCalendar = (next.learningCalendar || []).map((item) => ({
      ...item,
      growthStars: Number(item.growthStars ?? item.stars ?? 0)
    }));
    next.version = window.DEFAULT_APP_STATE.version;
    return next;
  }

  function badgeStage(badge) {
    const value = Number(badge?.progress || 0);
    const thresholds = badge?.thresholds || {};
    if (value >= Number(thresholds.shine || Infinity)) return 'shine';
    if (value >= Number(thresholds.growth || Infinity)) return 'growth';
    if (badge?.milestone) return value >= Number(thresholds.sprout || Infinity) ? 'sprout' : 'locked';
    return value > 0 ? 'sprout' : 'locked';
  }

  function badgeStageLabel(badge) { return BADGE_STAGE_LABELS[badgeStage(badge)] || '未点亮'; }
  function badgeTarget(badge) {
    const stage = badgeStage(badge);
    const thresholds = badge.thresholds || {};
    if (stage === 'locked') return Number(thresholds.sprout || 1);
    if (stage === 'sprout') return Number(thresholds.growth || thresholds.shine || 1);
    if (stage === 'growth') return Number(thresholds.shine || thresholds.growth || 1);
    return Number(thresholds.shine || badge.progress || 1);
  }
  function badgePercent(badge) { return Math.min(100, Math.round(Number(badge.progress || 0) / Math.max(1, badgeTarget(badge)) * 100)); }
  function badgeById(id) { return state.badges.find((badge) => badge.id === id); }
  function litBadges() { return state.badges.filter((badge) => badgeStage(badge) !== 'locked'); }
  function shineBadges() { return state.badges.filter((badge) => badgeStage(badge) === 'shine'); }
  function categoryById(id) { return state.badgeCategories.find((category) => category.id === id) || state.badgeCategories[0]; }
  function stageRank(stage) { return BADGE_STAGE_ORDER[stage] ?? 0; }

  function reconcileMilestones() {
    const streak = badgeById('milestone-streak-7');
    if (streak) streak.progress = Math.max(Number(streak.progress || 0), Number(state.profile.streakDays || 0));
    const adventurer = badgeById('milestone-adventurer');
    if (adventurer) adventurer.progress = state.badges.filter((badge) => badge.id !== adventurer.id && badgeStage(badge) !== 'locked').length;
  }

  function incrementBadge(id, amount = 1, sourceTitle = '') {
    const badge = badgeById(id);
    if (!badge || !amount) return null;
    const before = badgeStage(badge);
    badge.progress = Math.max(0, Number(badge.progress || 0) + Number(amount || 0));
    const after = badgeStage(badge);
    if (stageRank(after) > stageRank(before)) {
      state.history.unshift({
        id:`badge-${Date.now()}-${id}`,
        date:todayIso(),
        type:'badge',
        title:`${badge.name}进入${BADGE_STAGE_LABELS[after]}阶段`,
        detail:sourceTitle ? `由“${sourceTitle}”推动能力升级。` : '能力证据达到新的成长阶段。'
      });
    }
    return { id, before, after, amount:Number(amount || 0) };
  }

  function addRewardLedger(entry) {
    state.rewardLedger = Array.isArray(state.rewardLedger) ? state.rewardLedger : [];
    state.rewardLedger.unshift({ id:`reward-${Date.now()}-${Math.random().toString(16).slice(2)}`, date:todayIso(), ...entry });
    state.rewardLedger = state.rewardLedger.slice(0, 120);
  }

  function mergeState(base, incoming) {
    if (Array.isArray(base)) return Array.isArray(incoming) ? clone(incoming) : clone(base);
    if (base && typeof base === 'object') {
      const source = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
      return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, mergeState(value, source[key])]));
    }
    return incoming === undefined || incoming === null ? base : incoming;
  }

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function loadState() {
    try {
      const raw = localStorage.getItem(config.storageKey);
      if (!raw) return clone(window.DEFAULT_APP_STATE);
      const parsed = JSON.parse(raw);
      if (!parsed) return clone(window.DEFAULT_APP_STATE);
      if (parsed.version === window.DEFAULT_APP_STATE.version) return mergeState(window.DEFAULT_APP_STATE, parsed);
      const migrated = migrateLegacyState(parsed);
      try { localStorage.setItem(config.storageKey, JSON.stringify(migrated)); } catch (error) { console.warn('Migrated state save failed', error); }
      return migrated;
    } catch (error) {
      console.warn('State load failed', error);
      return clone(window.DEFAULT_APP_STATE);
    }
  }

  let state = loadState();
  reconcileMilestones();
  let pendingAvatarDataUrl = null;
  window.getRuntimeAiSettings = () => state.profile.aiSettings || {};

  function localIso(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function todayIso() { return localIso(new Date()); }

  function monthKeyFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function parseMonthKey(key) {
    const [year, month] = String(key || '').split('-').map(Number);
    return new Date(year || new Date().getFullYear(), Math.max(0, (month || 1) - 1), 1);
  }

  function taskDate(task) { return task.scheduledDate || todayIso(); }
  function tasksForDate(date) { return state.tasks.filter((task) => taskDate(task) === date); }

  function calendarSummary(date) {
    const scheduled = tasksForDate(date);
    const existing = state.learningCalendar.find((item) => item.date === date) || null;
    if (scheduled.length) {
      const completed = scheduled.filter((task) => task.status === 'done').length;
      const planned = scheduled.length;
      const status = completed >= planned ? 'done' : completed > 0 ? 'partial' : 'planned';
      return {
        date, status, planned, completed,
        tasks: scheduled.map((task) => task.title),
        growthStars: scheduled.filter((task) => task.status === 'done').reduce((sum, task) => sum + normalizeReward(task.reward).growthStars, 0)
      };
    }
    return existing || { date, status:'none', planned:0, completed:0, tasks:[], growthStars:0 };
  }

  function syncCalendarDate(date) {
    if (!date) return;
    const scheduled = tasksForDate(date);
    const index = state.learningCalendar.findIndex((item) => item.date === date);
    if (!scheduled.length && date >= todayIso()) {
      if (index >= 0) state.learningCalendar.splice(index, 1);
      return;
    }
    const summary = calendarSummary(date);
    if (index >= 0) state.learningCalendar[index] = summary;
    else state.learningCalendar.push(summary);
  }

  function formatDateLabel(dateString) {
    if (!dateString) return '未安排日期';
    const date = new Date(`${dateString}T00:00:00`);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function saveState() {
    try { localStorage.setItem(config.storageKey, JSON.stringify(state)); }
    catch (error) { console.warn('State save failed', error); }
  }

  function icon(name, cls = 'svg-icon', alt = '') {
    return `<img class="${cls}" src="assets/icons/${name}.svg" alt="${escapeHtml(alt)}">`;
  }

  function mascot(pose = 'wave', cls = 'mascot-image') {
    const poseMap = { wave: 'default', clipboard: 'guide', map: 'guide', think: 'think', celebrate: 'celebrate', rest: 'rest', encourage: 'encourage' };
    const actual = poseMap[pose] || pose || 'default';
    return `<img class="${cls}" src="assets/characters/mascot-${actual}.png" alt="专属吉祥物${escapeHtml(state.profile.mascotName)}">`;
  }

  function childArt(pose = 'welcome', cls = 'child-illustration') {
    const poseMap = { welcome: 'welcome', study: 'study', think: 'think', preview: 'preview', celebrate: 'celebrate', explore: 'explore', map: 'explore', archive: 'celebrate', tasks: 'study' };
    const actual = poseMap[pose] || pose || 'welcome';
    return `<img class="${cls}" src="assets/characters/child-${actual}.png" alt="${escapeHtml(state.profile.childName)}的专属学习形象">`;
  }

  function avatar(cls = '') {
    const useUploaded = state.profile.avatarMode === 'uploaded' && state.profile.avatarDataUrl;
    const source = useUploaded ? state.profile.avatarDataUrl : 'assets/characters/avatar-xiaoming.png';
    const modeClass = useUploaded ? 'uploaded-avatar' : 'character-avatar';
    return `<img class="${cls} ${modeClass}" src="${source}" alt="${escapeHtml(state.profile.childName)}的头像">`;
  }

  function currentRoute() {
    const route = location.hash.replace('#/', '').replace('#', '') || state.ui.currentRoute || 'home';
    return routes.some((item) => item.id === route) ? route : 'home';
  }

  function routeTo(id) {
    state.ui.currentRoute = id;
    saveState();
    if (location.hash === `#/${id}`) render();
    else location.hash = `#/${id}`;
  }

  function completedTasks() { return state.tasks.filter((task) => task.status === 'done'); }
  function pendingTasks() { return state.tasks.filter((task) => task.status !== 'done'); }
  function plannedMinutes() { return state.tasks.filter((task) => task.status !== 'done').reduce((sum, task) => sum + task.minutes, 0); }
  function xpPercent() { return Math.min(100, Math.round((state.profile.xp / state.profile.xpMax) * 100)); }
  function previewLesson() { return state.previewLessons.find((item) => item.id === state.ui.selectedPreviewLessonId) || state.previewLessons[0]; }
  function apiModeLabel() { const mode = state.profile.aiSettings?.mode || 'mock'; return mode === 'proxy' ? '本地代理模式' : mode === 'compatible' ? '兼容接口模式' : '离线演示模式'; }

  function statusLabel(task) {
    if (task.status === 'done') return '已完成';
    if (task.status === 'in_progress') return '继续学习';
    if (task.route === 'preview') return '去预习';
    return task.group === 'adventure' ? '去挑战' : '去开始';
  }

  function statusClass(task) {
    if (task.status === 'done') return 'done';
    if (task.status === 'in_progress') return 'progress';
    return '';
  }

  function groupLabel(group) {
    return ({ required: '必做任务', optional: '选做挑战', adventure: '冒险任务' })[group] || '任务';
  }

  function subjectIllustration(subject) {
    if (subject === '数学') return 'hero-math.svg';
    if (subject === '英语') return 'hero-english.svg';
    return 'hero-reading.svg';
  }

  function rewardItem(type, value) {
    const names = { growthStars:'star', exploreCoins:'coin', xp:'badge', mapEnergy:'energy' };
    const labels = { growthStars:'成长星', exploreCoins:'探索币', xp:'经验', mapEnergy:'地图能量' };
    return `<span class="reward-item" title="${labels[type] || ''}">${icon(names[type] || 'star', 'svg-icon xs')}<span>${escapeHtml(value)}</span></span>`;
  }

  function difficulty(level) {
    return `<span class="difficulty" aria-label="难度${level}级">${[1,2,3].map((n) => `<i class="${n <= level ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function starRow(count, max = 3) {
    return `<span class="island-stars" aria-label="获得${count}颗星">${Array.from({ length: max }, (_, index) => icon('star', `svg-icon ${index < count ? '' : 'off'}`)).join('')}</span>`;
  }

  function topbar(route) {
    return `
      <header class="topbar">
        <button class="brand" type="button" data-action="nav" data-route="home" aria-label="返回首页">
          <span class="brand-mark" aria-hidden="true"></span>
          <span>${escapeHtml(state.profile.childName)}学习冒险基地</span>
        </button>
        <nav class="nav-list" aria-label="主导航">
          ${routes.map((item) => `
            <button class="nav-item ${route === item.id ? 'active' : ''}" type="button" data-action="nav" data-route="${item.id}">
              ${icon(item.icon, 'svg-icon', '')}<span>${item.label}</span>
            </button>`).join('')}
        </nav>
        <div class="header-tools">
          <span class="resource-chip" title="永久累计的有效学习成果">${icon('star', 'svg-icon')}<span>${state.wallet.growthStars}</span><small>成长星</small></span>
          <span class="resource-chip" title="可用于兑换伙伴配件与主题">${icon('coin', 'svg-icon')}<span>${state.wallet.exploreCoins.toLocaleString('zh-CN')}</span><small>探索币</small></span>
          <button class="icon-button" type="button" data-action="show-notice" aria-label="消息">${icon('mail', 'svg-icon')}<span class="notification-dot"></span></button>
          <button class="avatar-button" type="button" data-action="open-profile" aria-label="编辑孩子档案">${avatar()}</button>
        </div>
      </header>`;
  }

  function profileCard() {
    return `
      <section class="card profile-card">
        <div class="profile-main">
          <div class="profile-avatar">${avatar()}</div>
          <div>
            <div class="profile-name-row">
              <h2 class="profile-name">${escapeHtml(state.profile.childName)}</h2>
              <button class="profile-edit" type="button" data-action="open-profile" aria-label="编辑孩子档案">${icon('edit', 'svg-icon')}</button>
            </div>
            <div class="profile-grade">${escapeHtml(state.profile.grade)}</div>
          </div>
        </div>
        <div class="level-panel">
          <div class="level-line">
            <span>${icon('star', 'svg-icon')}<span>Lv.${state.profile.level}　${escapeHtml(state.profile.levelTitle)}</span></span>
            ${icon('gift', 'svg-icon')}
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${xpPercent()}%"></div></div>
          <div class="small muted">经验值 ${state.profile.xp} / ${state.profile.xpMax}</div>
        </div>
        <div class="profile-stats">
          <div class="profile-stat">${icon('flame', 'svg-icon')}<div><span>连续学习</span><strong>${state.profile.streakDays} 天</strong></div></div>
          <div class="profile-stat">${icon('energy', 'svg-icon')}<div><span>今日能量</span><strong>${state.profile.dailyEnergyMinutes} 分钟</strong></div></div>
        </div>
      </section>`;
  }

  function mascotMessage(route) {
    const done = completedTasks().length;
    const messages = {
      home: `${state.profile.childName}，今天有 ${tasksForDate(todayIso()).filter((task) => task.status !== 'done').length} 项待完成任务。先选最重要的一项开始吧。`,
      tasks: `每完成一项任务，都会留下学习证据，并推动成长地图前进。`,
      preview: `预习不是提前把答案学完，而是先看全貌、发现问题，再带着猜想进课堂。`,
      map: `你已经完成 ${done} 项任务。继续收集成长星，点亮更多学习区域。`,
      archive: `这里记录的是你的作品、解释和进步，不和别人比较。`
    };
    return messages[route] || messages.home;
  }

  function mascotCard(route, pose = 'wave') {
    return `
      <section class="card mascot-card">
        <div class="section-head">
          <h3>我的专属伙伴</h3>
          <button class="mascot-settings" type="button" data-action="open-profile" aria-label="设置专属吉祥物">${icon('settings', 'svg-icon')}</button>
        </div>
        <div class="mascot-bubble">${escapeHtml(mascotMessage(route))}</div>
        <div class="buddy-duo">${childArt(route === 'preview' ? 'preview' : route === 'map' ? 'explore' : route === 'archive' ? 'celebrate' : route === 'tasks' ? 'study' : 'welcome', 'sidebar-child')} ${mascot(pose, 'sidebar-mascot')}</div>
        <div class="mascot-nameplate">${escapeHtml(state.profile.childName)} × ${escapeHtml(state.profile.mascotName)}</div>
      </section>`;
  }

  function streakCard() {
    return `
      <section class="card streak-card">
        <div class="streak-main">${icon('flame', 'svg-icon')}<div><span class="small muted">今日连击</span><br><strong>${state.profile.streakDays} 连击</strong></div></div>
        <div class="streak-road">
          <div class="streak-node done">3 连击</div>
          <div class="streak-node done">5 连击</div>
          <div class="streak-node ${state.profile.streakDays >= 7 ? 'done' : ''}">7 连击</div>
        </div>
      </section>`;
  }

  function collectionCard() {
    reconcileMilestones();
    const lit = litBadges().length;
    const total = state.badges.length;
    const percent = Math.min(100, Math.round(lit / Math.max(1,total) * 100));
    return `
      <section class="card collect-card ability-collection-card">
        <div class="section-head"><div><h3 class="section-title" style="font-size:16px">我的能力成长</h3><p class="section-copy">徽章阶段与地图钥匙</p></div>${icon('badge','svg-icon sm')}</div>
        <div class="collect-row">
          ${icon('badge', 'svg-icon')}
          <div class="collect-copy"><strong>已点亮徽章 ${lit} / ${total}</strong><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div>
        </div>
        <div class="collection-mini-stats"><span>${icon('star','svg-icon xs')}闪耀 ${shineBadges().length}</span><span>${icon('key','svg-icon xs')}地图钥匙 ${state.wallet.mapKeys}</span></div>
        <button class="btn btn-secondary btn-block btn-sm" type="button" data-action="nav" data-route="archive" style="margin-top:11px">查看能力徽章墙</button>
      </section>`;
  }

  function sidebar(route, pose = 'wave', extras = '') {
    return `<aside class="sidebar-stack">${profileCard()}${mascotCard(route, pose)}${extras}</aside>`;
  }

  function summaryItem(iconName, label, value) {
    return `<div class="summary-item">${icon(iconName, 'svg-icon')}<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div></div>`;
  }


  function featuredBadges() {
    const preferred = ['question-detective','preview-explorer','time-manager'];
    const chosen = preferred.map(badgeById).filter(Boolean);
    if (chosen.length >= 3) return chosen;
    return [...state.badges]
      .filter((badge) => badgeStage(badge) !== 'shine')
      .sort((a,b) => (badgeTarget(a)-a.progress) - (badgeTarget(b)-b.progress))
      .slice(0,3);
  }

  function abilityProgressCard(badge, compact = false) {
    const stage = badgeStage(badge);
    const target = badgeTarget(badge);
    const remaining = Math.max(0, target - Number(badge.progress || 0));
    return `<article class="ability-goal-card category-${escapeHtml(badge.category)} stage-${stage} ${compact ? 'compact' : ''}">
      <div class="badge-emblem category-${escapeHtml(badge.category)} stage-${stage}">${icon(badge.icon,'svg-icon')}</div>
      <div class="ability-goal-copy"><div class="ability-card-title"><strong>${escapeHtml(badge.name)}</strong><span class="badge-stage-chip stage-${stage}">${badgeStageLabel(badge)}</span></div><p>${escapeHtml(badge.description)}</p><div class="ability-progress-line"><span>进度</span><strong>${badge.progress} / ${target}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${badgePercent(badge)}%"></div></div><small>${stage === 'shine' ? '已经进入闪耀阶段' : `再积累 ${remaining} 次有效证据即可${stage === 'locked' ? '点亮' : '升级'}`}</small></div>
    </article>`;
  }

  function todayAbilitiesCard() {
    return `<section class="card card-pad today-abilities-card"><div class="section-head"><div><h3 class="section-title" style="font-size:18px">今日可点亮能力</h3><p class="section-copy">完成真实学习行为，让能力徽章继续成长。</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="nav" data-route="archive">查看全部</button></div><div class="ability-goal-grid">${featuredBadges().map((badge) => abilityProgressCard(badge,true)).join('')}</div></section>`;
  }

  function homeMissionCard(task, theme) {
    return `
      <article class="mission-card" data-theme="${theme}">
        <h3 class="mission-title">${escapeHtml(task.subject)}任务：<br>${escapeHtml(task.title)}</h3>
        <div class="mission-visual"><img src="assets/illustrations/${subjectIllustration(task.subject)}" alt="${escapeHtml(task.subject)}任务插图"></div>
        <div class="meta-line">${icon('clock', 'svg-icon xs')}<span>预计 ${task.minutes} 分钟</span></div>
        <div class="reward-row">${rewardItem('xp', normalizeReward(task.reward).xp)}${rewardItem('exploreCoins', normalizeReward(task.reward).exploreCoins)}${normalizeReward(task.reward).growthStars ? rewardItem('growthStars', normalizeReward(task.reward).growthStars) : ''}</div>
        <button class="btn btn-block ${task.status === 'in_progress' ? 'btn-success' : 'btn-secondary'} btn-sm" type="button" data-action="open-task" data-task-id="${task.id}" style="margin-top:12px">${statusLabel(task)}</button>
      </article>`;
  }

  function aiHomeCard() {
    return `
      <section class="card ai-card">
        <span class="api-mode-chip ${(state.profile.aiSettings?.mode || 'mock') !== 'mock' ? 'live' : ''}"><i class="api-mode-dot"></i>${apiModeLabel()}</span>
        <h3>AI帮我安排今天任务</h3>
        <div class="module-character-row">${childArt('study', 'module-child')} ${mascot('guide', 'module-mascot')}</div>
        <p>输入年级、可用时间和今日重点，生成适合孩子的任务组合。未接接口时自动使用本地模板。</p>
        <button class="btn btn-primary btn-block" type="button" data-action="open-generator">一键生成任务</button>
      </section>`;
  }

  function homeTrackingCard() {
    const counts = state.weekly.taskCounts;
    const max = Math.max(...counts, 1);
    return `
      <section class="card card-pad">
        <div class="section-head"><div><h3 class="section-title" style="font-size:17px">本周任务追踪</h3><p class="section-copy">按任务和时长查看执行情况</p></div>${icon('chart', 'svg-icon sm')}</div>
        <div class="metric-row">
          <div class="metric-cell">${icon('check', 'svg-icon')}<div><span>已完成任务</span><strong>${completedTasks().length} / ${state.weekly.targetTasks}</strong></div></div>
          <div class="metric-cell">${icon('clock', 'svg-icon')}<div><span>本周学习时长</span><strong>${state.weekly.plannedMinutes} 分钟</strong></div></div>
          <div class="metric-cell">${icon('flame', 'svg-icon')}<div><span>连续学习</span><strong>${state.profile.streakDays} 天</strong></div></div>
        </div>
        <div class="week-bars">${counts.map((count, index) => `<div class="week-bar-item ${index === 3 ? 'active' : ''}"><div class="week-bar"><span style="height:${Math.max(8, Math.round(count / max * 100))}%"></span></div><div>${'一二三四五六日'[index]}</div></div>`).join('')}</div>
      </section>`;
  }

  function previewQuickCard() {
    const lesson = previewLesson();
    return `
      <section class="card preview-quick">
        <div class="section-head"><div><h3 class="section-title" style="font-size:17px">预习单快捷入口</h3><p class="section-copy">下一课</p></div>${icon('preview', 'svg-icon sm')}</div>
        <strong>${escapeHtml(lesson.title)}</strong>
        <div class="small muted" style="margin-top:4px">${escapeHtml(lesson.subject)} · ${escapeHtml(lesson.edition)} ${escapeHtml(lesson.grade)}</div>
        <div class="lesson-art"><img src="assets/illustrations/protractor.svg" alt="角的度量预习插图"></div>
        <p class="section-copy">提前建立问题意识，课堂验证更有收获。</p>
        <button class="btn btn-primary btn-block" type="button" data-action="nav" data-route="preview">去预习</button>
      </section>`;
  }

  function homeMapPreview() {
    return `
      <section class="card map-preview map-preview-v16">
        <div class="section-head"><div><h3 class="section-title" style="font-size:18px">成长地图</h3><p class="section-copy">完成任务，点亮学习岛屿，解锁新冒险。</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="nav" data-route="map">查看全部</button></div>
        <button class="map-preview-image-button" type="button" data-action="nav" data-route="map" aria-label="打开完整成长地图">
          <img src="assets/maps/growth-map-home.jpg" alt="语文岛、数学岛、科学岛和更多学习岛屿的成长地图预览">
          <span class="map-preview-cta">进入学习冒险地图 ${icon('arrow-right','svg-icon xs')}</span>
        </button>
      </section>`;
  }

  function rewardStrip() {
    const featured = ['question-detective','preview-explorer','time-manager'].map(badgeById).filter(Boolean);
    return `
      <section class="card reward-strip growth-v2-strip">
        <div class="wallet-grid">
          <div class="wallet-item">${icon('badge', 'svg-icon')}<div><span>等级经验</span><strong>${state.profile.xp} / ${state.profile.xpMax}</strong></div></div>
          <div class="wallet-item">${icon('star', 'svg-icon')}<div><span>成长星</span><strong>${state.wallet.growthStars}</strong></div></div>
          <div class="wallet-item">${icon('coin', 'svg-icon')}<div><span>探索币</span><strong>${state.wallet.exploreCoins.toLocaleString('zh-CN')}</strong></div></div>
        </div>
        <div class="badge-row">${featured.map((badge) => `<div class="badge-mini stage-${badgeStage(badge)}">${icon(badge.icon, 'svg-icon')}<div>${escapeHtml(badge.name)} · ${badgeStageLabel(badge)}</div></div>`).join('')}</div>
        <div class="goal-card"><strong>成长激励系统 V2</strong><div class="small muted" style="margin:5px 0 8px">经验升级、成长星点亮地图、探索币兑换个性奖励</div><button class="btn btn-ghost btn-sm" type="button" data-action="nav" data-route="archive">查看成长体系</button></div>
      </section>`;
  }

  function learningCalendarCard() {
    const monthDate = parseMonthKey(state.ui.calendarMonth || monthKeyFromDate(new Date()));
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstMondayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const previousMonthDays = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = firstMondayIndex - 1; i >= 0; i -= 1) cells.push(`<span class="calendar-day outside" aria-hidden="true"><span>${previousMonthDays - i}</span></span>`);
    for (let day = 1; day <= days; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const summary = calendarSummary(date);
      const taskCount = Number(summary.planned || 0);
      const completed = Number(summary.completed || 0);
      const todayClass = date === todayIso() ? 'today' : '';
      const selectedClass = date === state.ui.selectedCalendarDate ? 'selected' : '';
      cells.push(`<button class="calendar-day ${summary.status} ${todayClass} ${selectedClass}" type="button" data-action="open-calendar-day" data-date="${date}" aria-label="${date}，计划${taskCount}项，完成${completed}项"><span>${day}</span>${taskCount ? `<small>${completed}/${taskCount}</small>` : '<i class="calendar-status-dot"></i>'}</button>`);
    }
    while (cells.length % 7) {
      const nextDay = cells.length - firstMondayIndex - days + 1;
      cells.push(`<span class="calendar-day outside" aria-hidden="true"><span>${nextDay}</span></span>`);
    }
    const monthPrefix = `${year}-${String(month + 1).padStart(2,'0')}`;
    const monthItems = state.learningCalendar.filter((item) => item.date.startsWith(monthPrefix));
    const plannedDays = monthItems.filter((item) => Number(item.planned || 0) > 0).length;
    const completedDays = monthItems.filter((item) => item.status === 'done').length;
    const monthStars = monthItems.reduce((sum,item) => sum + Number(item.growthStars || 0),0);
    const todayPlan = calendarSummary(todayIso()).planned || 0;
    return `
      <section class="card card-pad learning-calendar-card learning-calendar-v16">
        <div class="section-head calendar-title-row">
          <div><h3 class="section-title" style="font-size:19px">学习日历</h3><p class="section-copy">计划与完成情况会自动同步到这里</p></div>
          <div class="calendar-month-tools"><button class="icon-button sm" type="button" data-action="calendar-prev" aria-label="上个月">‹</button><strong>${year}年${month + 1}月</strong><button class="icon-button sm" type="button" data-action="calendar-next" aria-label="下个月">›</button></div>
        </div>
        <div class="calendar-weekdays">${['一','二','三','四','五','六','日'].map((day) => `<span>${day}</span>`).join('')}</div>
        <div class="calendar-grid">${cells.join('')}</div>
        <div class="calendar-legend"><span><i class="legend-dot done"></i>全部完成</span><span><i class="legend-dot partial"></i>部分完成</span><span><i class="legend-dot planned"></i>已有计划</span><span><i class="legend-dot none"></i>无计划</span></div>
        <div class="calendar-month-summary">
          <div>${icon('clipboard','svg-icon')}<span>本月计划<strong>${plannedDays} 天</strong></span></div>
          <div>${icon('check','svg-icon')}<span>已完成<strong>${completedDays} 天</strong></span></div>
          <div>${icon('star','svg-icon')}<span>本月成长星<strong>${monthStars}</strong></span></div>
          <div>${icon('calendar','svg-icon')}<span>今日计划<strong>${todayPlan} 个任务</strong></span></div>
        </div>
      </section>`;
  }

  function homeAdventureHero(todayTasks) {
    const pending = todayTasks.filter((task) => task.status !== 'done');
    const next = pending[0] || null;
    const goalCount = Math.max(3, todayTasks.length || 3);
    const targetXp = todayTasks.reduce((sum,task) => sum + normalizeReward(task.reward).xp,0) || 60;
    const abilityCount = new Set(todayTasks.flatMap((task) => task.abilities || [])).size || 3;
    return `
      <section class="card home-adventure-card">
        <div class="home-adventure-copy">
          <span class="eyebrow">今天的学习冒险</span>
          <h2>${escapeHtml(state.profile.childName)}，今天准备完成 ${goalCount} 个冒险任务</h2>
          <div class="home-goal-label">今日目标</div>
          <div class="home-goal-list">
            <div>${icon('focus','svg-icon')}<span>完成 ${goalCount} 个任务</span></div>
            <div>${icon('badge','svg-icon')}<span>获得 ${targetXp} 点经验</span></div>
            <div>${icon('star','svg-icon')}<span>推动 ${abilityCount} 项能力成长</span></div>
          </div>
          <button class="btn btn-primary btn-block home-adventure-start" type="button" data-action="${next ? 'open-task' : 'nav'}" ${next ? `data-task-id="${next.id}"` : 'data-route="tasks"'}>开始今天冒险 ${icon('arrow-right','svg-icon xs')}</button>
        </div>
        <div class="home-adventure-characters">${childArt('celebrate','home-hero-child')} ${mascot('encourage','home-hero-mascot')}</div>
      </section>`;
  }

  function homeRecentTasksCard() {
    const items = [...state.tasks].sort((a,b) => `${a.scheduledDate || ''}${a.dueTime || ''}`.localeCompare(`${b.scheduledDate || ''}${b.dueTime || ''}`)).slice(0,3);
    return `
      <section class="card card-pad recent-tasks-card">
        <div class="section-head"><div><h3 class="section-title" style="font-size:18px">最近任务</h3></div><button class="btn btn-ghost btn-sm" type="button" data-action="nav" data-route="tasks">查看全部</button></div>
        <div class="recent-task-list">${items.map((task) => `<button type="button" class="recent-task-row" data-action="open-task" data-task-id="${task.id}">${icon(task.icon,'svg-icon')}<span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.subject)} · ${task.scheduledDate === todayIso() ? '今天' : formatDateLabel(task.scheduledDate)} ${escapeHtml(task.dueTime || '')}</small></span><i class="task-status-pill ${statusClass(task)}">${statusLabel(task)}</i></button>`).join('')}</div>
      </section>`;
  }

  function renderHome() {
    const todayTasks = tasksForDate(todayIso());
    return `
      <div class="page-wrap page-wrap-home-v16">
        <div class="page-grid with-sidebar home-layout-v16">
          ${sidebar('home', 'wave')}
          <main class="home-dashboard-v16">
            <div class="home-calendar-area">${learningCalendarCard()}</div>
            <div class="home-adventure-area">${homeAdventureHero(todayTasks)}</div>
            <div class="home-tracking-area">${homeTrackingCard()}</div>
            <div class="home-preview-area">${previewQuickCard()}</div>
            <div class="home-map-area">${homeMapPreview()}</div>
            <div class="home-recent-area">${homeRecentTasksCard()}</div>
            <div class="home-abilities-area">${todayAbilitiesCard()}</div>
          </main>
        </div>
      </div>`;
  }

  function taskAbilityBadges(task) {
    return (task.abilities || []).map(badgeById).filter(Boolean);
  }

  function taskAbilityTags(task) {
    const badges = taskAbilityBadges(task);
    return badges.length ? `<div class="task-ability-tags"><span>主要培养</span>${badges.slice(0,3).map((badge) => `<i>${escapeHtml(badge.name)}</i>`).join('')}</div>` : '';
  }

  function taskSummary() {
    const today = todayIso();
    const todayTasks = tasksForDate(today);
    const done = todayTasks.filter((task) => task.status === 'done').length;
    const minutes = todayTasks.reduce((sum, task) => sum + Number(task.minutes || 0), 0);
    return `
      <section class="card hero-summary">
        <div class="section-head">
          <div><h1 class="section-title">今日任务中心</h1><p class="section-copy">AI 可以辅助规划，家长也可以提前为今天或未来安排任务。</p></div>
          <div class="task-summary-actions"><button class="btn btn-secondary btn-sm" type="button" data-action="open-generator">${icon('thinking','svg-icon xs')}AI智能安排</button><button class="btn btn-primary btn-sm" type="button" data-action="open-manual-task">${icon('plus', 'svg-icon xs')}家长安排任务</button></div>
        </div>
        <div class="summary-grid">
          ${summaryItem('clipboard', '今日计划', `${todayTasks.length} 项`)}
          ${summaryItem('clock', '计划用时', `${minutes} 分钟`)}
          ${summaryItem('check', '今日完成', `${done} / ${todayTasks.length}`)}
          ${summaryItem('calendar', '未来计划', `${state.tasks.filter((task) => taskDate(task) > today).length} 项`)}
        </div>
      </section>`;
  }

  function taskRow(task) {
    const reward = normalizeReward(task.reward);
    return `
      <article class="task-row">
        ${icon(task.icon, 'task-subject-icon', task.subject)}
        <div class="task-copy">
          <div class="eyebrow">${escapeHtml(task.subject)} · ${escapeHtml(task.focus)} · ${escapeHtml(task.assignedBy || '学习计划')}</div>
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.description)}</p>
          <div class="task-schedule-line"><span>${icon('calendar','svg-icon xs')}${formatDateLabel(taskDate(task))}</span>${task.dueTime ? `<span>${icon('clock','svg-icon xs')}${escapeHtml(task.dueTime)}</span>` : ''}<span>完成标准：${escapeHtml(task.evidenceRule || '留下学习记录')}</span></div>
          ${taskAbilityTags(task)}
          ${task.status === 'in_progress' ? `<div class="inline-progress"><div class="progress-track"><div class="progress-fill" style="width:${task.progress}%"></div></div><span>${task.progress}%</span></div>` : ''}
        </div>
        <div class="task-meta">
          <span class="inline-icon">${icon('clock', 'svg-icon xs')}${task.minutes} 分钟</span>
          <span class="inline-icon">难度 ${difficulty(task.difficulty)}</span>
          <span class="reward-item">${icon('badge', 'svg-icon xs')}XP ${reward.xp}</span>
          <span class="reward-item">${icon('coin', 'svg-icon xs')}${reward.exploreCoins}</span>
          ${reward.growthStars ? `<span class="reward-item evidence-star">${icon('star','svg-icon xs')}${reward.growthStars}</span>` : ''}
        </div>
        <button class="btn ${task.status === 'done' ? 'btn-ghost' : 'btn-secondary'} btn-sm task-action" type="button" data-action="open-task" data-task-id="${task.id}">${statusLabel(task)}</button>
      </article>`;
  }

  function taskList() {
    const counts = {
      required: state.tasks.filter((task) => task.group === 'required').length,
      optional: state.tasks.filter((task) => task.group === 'optional').length,
      adventure: state.tasks.filter((task) => task.group === 'adventure').length
    };
    const filtered = state.tasks.filter((task) => task.group === state.ui.activeTaskFilter && (state.ui.selectedSubject === '全部学科' || task.subject === state.ui.selectedSubject));
    const subjects = ['全部学科', ...new Set(state.tasks.map((task) => task.subject))];
    return `
      <section class="card task-list-card">
        <div class="task-filter-row">
          <div class="task-tabs">
            ${['required','optional','adventure'].map((group) => `<button class="tab-button ${state.ui.activeTaskFilter === group ? 'active' : ''}" type="button" data-action="filter-task-group" data-group="${group}">${groupLabel(group)} (${counts[group]})</button>`).join('')}
          </div>
          <select class="select-control" style="width:auto;min-width:125px" data-action="filter-subject" aria-label="筛选学科">${subjects.map((subject) => `<option ${subject === state.ui.selectedSubject ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('')}</select>
        </div>
        ${filtered.length ? filtered.map(taskRow).join('') : `<div class="empty-state">${icon('clipboard', 'svg-icon')}<p>当前分类还没有任务。</p></div>`}
      </section>`;
  }

  function generatorCard() {
    return `
      <section class="card generator-card">
        <span class="api-mode-chip ${(state.profile.aiSettings?.mode || 'mock') !== 'mock' ? 'live' : ''}"><i class="api-mode-dot"></i>${apiModeLabel()}</span>
        <h3>AI一键安排任务</h3>
        <p class="section-copy">告诉${escapeHtml(state.profile.mascotName)}日期、时间和重点，生成一组可执行任务。</p>
        <form id="quick-generator-form" style="margin-top:12px">
          <div class="field"><label>计划日期</label><input class="text-control" type="date" name="scheduledDate" value="${todayIso()}"></div>
          <div class="field"><label>年级</label><select class="select-control" name="grade"><option>${escapeHtml(state.profile.grade)}</option><option>一年级</option><option>二年级</option><option>三年级</option><option>五年级</option><option>六年级</option></select></div>
          <div class="field"><label>可用时间</label><select class="select-control" name="minutes"><option value="45">45 分钟</option><option value="60">60 分钟</option><option value="90" selected>90 分钟</option><option value="120">120 分钟</option></select></div>
          <div class="field"><label>今日重点</label><div class="tag-picker">${['数学','英语','语文','科学'].map((item,index) => `<span class="tag-option"><input id="focus-${item}" type="checkbox" name="focus" value="${item}" ${index < 2 ? 'checked' : ''}><label for="focus-${item}">${item}</label></span>`).join('')}</div></div>
          <button class="btn btn-primary btn-block" type="button" data-action="generate-tasks" data-form="quick-generator-form">智能生成任务</button>
        </form>
      </section>`;
  }

  function focusCard() {
    const total = 900;
    const remaining = state.focusTimer.seconds;
    const elapsed = Math.max(0, total - remaining);
    const progress = Math.min(100, Math.round(elapsed / total * 100));
    const checkpoint = [300, 600, 900];
    return `
      <section class="card focus-card">
        <div class="section-head"><div><h3 class="section-title" style="font-size:17px">专注挑战</h3><p class="section-copy">15 分钟专注冲刺</p></div>${icon('focus', 'svg-icon sm')}</div>
        <div class="focus-ring" style="--focus-progress:${progress}%"><div class="focus-time" data-focus-time>${formatTime(remaining)}</div></div>
        <button class="btn ${state.focusTimer.running ? 'btn-warning' : 'btn-primary'} btn-block" type="button" data-action="toggle-focus">${state.focusTimer.running ? '暂停专注' : '开始专注'}</button>
        <button class="btn btn-ghost btn-block btn-sm" type="button" data-action="reset-focus" style="margin-top:7px">重新计时</button>
        <div class="checkpoint-row">${checkpoint.map((value) => `<div class="checkpoint ${elapsed >= value ? 'done' : ''}">${value / 60} 分钟</div>`).join('')}</div>
      </section>`;
  }

  function rulesCard() {
    return `
      <section class="card card-pad">
        <div class="section-head"><div><h3 class="section-title" style="font-size:17px">闯关规则</h3><p class="section-copy">完成任务并留下证据，收集成长星。</p></div>${icon('chest', 'svg-icon sm')}</div>
        <div class="rule-path">
          <div class="rule-step">${icon('check', 'svg-icon')}第1关<br>40 星</div><span class="rule-line"></span>
          <div class="rule-step">${icon('badge', 'svg-icon')}第2关<br>80 星</div><span class="rule-line"></span>
          <div class="rule-step">${icon('chest', 'svg-icon')}第3关<br>120 星</div>
        </div>
        <button class="btn btn-ghost btn-block btn-sm" type="button" data-action="nav" data-route="map" style="margin-top:12px">查看成长地图</button>
      </section>`;
  }

  function analytics() {
    const counts = state.weekly.taskCounts;
    const max = Math.max(...counts, 1);
    return `
      <section class="card analytics-card">
        <div class="section-head"><div><h3 class="section-title" style="font-size:17px">任务执行进度</h3><p class="section-copy">查看任务数量、时间分配和能力变化。</p></div></div>
        <div class="analytics-grid">
          <div class="chart-box"><div class="chart-title">本周任务完成情况</div><div class="week-bars">${counts.map((count,index) => `<div class="week-bar-item"><div class="week-bar"><span style="height:${Math.max(8, Math.round(count / max * 100))}%"></span></div><div>${'一二三四五六日'[index]}</div></div>`).join('')}</div></div>
          <div class="chart-box"><div class="chart-title">今日时间使用情况</div><div class="donut-wrap"><div class="donut"></div><div class="donut-center" style="inset:0;display:grid;place-items:center"><div><strong>45</strong><br><span class="muted">分钟</span></div></div></div></div>
          <div class="chart-box"><div class="chart-title">学科掌握雷达图</div><div class="radar-wrap">${radarChart(state.weekly.mastery)}</div></div>
        </div>
      </section>`;
  }

  function radarChart(values) {
    const labels = Object.keys(values);
    const center = 80;
    const radius = 58;
    const points = labels.map((label, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / labels.length);
      const r = radius * values[label] / 100;
      return `${(center + Math.cos(angle) * r).toFixed(1)},${(center + Math.sin(angle) * r).toFixed(1)}`;
    }).join(' ');
    const grid = [1,.75,.5,.25].map((scale) => labels.map((_, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / labels.length);
      return `${(center + Math.cos(angle) * radius * scale).toFixed(1)},${(center + Math.sin(angle) * radius * scale).toFixed(1)}`;
    }).join(' '));
    const labelNodes = labels.map((label,index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / labels.length);
      const x = center + Math.cos(angle) * (radius + 15);
      const y = center + Math.sin(angle) * (radius + 15);
      return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#60748d">${escapeHtml(label)}</text>`;
    }).join('');
    return `<svg class="radar-chart" viewBox="0 0 160 160" role="img" aria-label="学科掌握雷达图">${grid.map((poly) => `<polygon points="${poly}" fill="none" stroke="#d8e5f4"/>`).join('')}<polygon points="${points}" fill="rgba(57,127,244,.24)" stroke="#397ff4" stroke-width="2"/>${labelNodes}</svg>`;
  }

  function renderTasks() {
    return `
      <div class="page-wrap">
        <div class="page-grid task-layout">
          ${sidebar('tasks', 'wave', streakCard() + collectionCard())}
          <main class="content-stack">${taskSummary()}${taskList()}${analytics()}</main>
          <aside class="content-stack right-rail">${generatorCard()}${focusCard()}${rulesCard()}</aside>
        </div>
      </div>`;
  }

  function previewTips() {
    return `
      <section class="card card-pad">
        <div class="section-head"><div><h3 class="section-title" style="font-size:16px">${escapeHtml(state.profile.mascotName)}提示</h3><p class="section-copy">预习四个提醒</p></div>${icon('info', 'svg-icon sm')}</div>
        <ul class="small" style="color:var(--ink-2);line-height:1.9;margin:0;padding-left:18px">
          <li>先看全貌，再判断自己已经会什么。</li>
          <li>大胆提出问题，不要求一次全部弄懂。</li>
          <li>动手试一试，留下文字、图画或测量结果。</li>
          <li>把猜想带进课堂，课后再回来验证。</li>
        </ul>
      </section>`;
  }

  function previewHeader(lesson) {
    return `
      <section class="card preview-header">
        <div><h1 class="section-title">预习单</h1><p class="section-copy">课前准备越充分，课堂验证越有方向。这里已经集成了你之前上传的“六步预习单”示例内容。</p></div>
        <div class="lesson-select">${icon('book', 'svg-icon sm')}<span>即将学习：${escapeHtml(lesson.title)}</span></div>
        <div class="preview-header-art">${childArt('preview', 'module-child')} ${mascot('think', 'module-mascot')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><span class="inline-icon small muted">${icon('clock', 'svg-icon xs')}预计 ${lesson.estimatedMinutes} 分钟</span><button class="btn btn-secondary btn-sm" type="button" data-action="open-preview-generator">AI生成预习单</button></div>
      </section>`;
  }

  function knowledgeCards(lesson) {
    return `<div class="knowledge-card-row">${lesson.knowledgeCards.map((card) => `
      <article class="knowledge-card"><h4>${escapeHtml(card.title)}</h4><p><strong>核心：</strong>${escapeHtml(card.core)}</p><p><strong>关键词：</strong>${escapeHtml(card.keyword)}</p><p class="warning-text"><strong>易错点：</strong>${escapeHtml(card.pitfall)}</p><p><strong>预习问题：</strong>${escapeHtml(card.question)}</p></article>`).join('')}</div>`;
  }

  function previewStep(step, index) {
    return `
      <article class="preview-step ${step.complete ? 'complete' : ''}">
        <div class="step-top"><span class="step-number">${index + 1}</span><div><div class="eyebrow">${escapeHtml(step.title)}</div><div class="step-subtitle">${escapeHtml(step.subtitle)}</div></div>${icon(step.icon, 'svg-icon')}</div>
        <h3>${escapeHtml(step.subtitle)}</h3>
        <p>${escapeHtml(step.instruction)}</p>
        <textarea class="textarea-control" data-preview-step-input="${step.id}" placeholder="${escapeHtml(step.placeholder)}">${escapeHtml(step.value)}</textarea>
        <div class="step-footer"><span class="step-reward">${icon('star', 'svg-icon')}奖励 ${step.reward}</span><button class="btn ${step.complete ? 'btn-success' : 'btn-secondary'} btn-sm" type="button" data-action="complete-preview-step" data-step-id="${step.id}">${step.complete ? '本步已完成' : '完成本步'}</button></div>
      </article>`;
  }

  function trafficText(status) {
    if (status === 'green') return '绿灯：已经建立初步理解，可以带着问题进入课堂。';
    if (status === 'yellow') return '黄灯：已经有部分理解，建议再补充一次解释或应用。';
    if (status === 'red') return '红灯：基础概念还不稳定，先回到知识卡或向家长求助。';
    return '完成认一认、说一说、用一用后生成预习反馈。';
  }

  function previewChallenges(lesson) {
    const c = lesson.challenges;
    return `
      <section class="card challenge-panel">
        <div class="section-head"><div><h3 class="section-title" style="font-size:17px">三阶挑战与课堂验证</h3><p class="section-copy">认一认 → 说一说 → 用一用</p></div>${icon('trophy', 'svg-icon sm')}</div>
        <div class="challenge-grid">
          <div class="challenge-item"><div class="challenge-head">${icon('check', 'svg-icon')}<div><strong>${c.recognize.label}</strong><div class="small muted">${escapeHtml(c.recognize.question)}</div></div></div><div class="option-row">${c.recognize.options.map((option,index) => `<label class="option-label"><input type="radio" name="recognize" data-action="preview-recognize" value="${index}" ${c.recognize.selected === index ? 'checked' : ''}><span>${escapeHtml(option)}</span></label>`).join('')}</div></div>
          <div class="challenge-item"><div class="challenge-head">${icon('reading', 'svg-icon')}<div><strong>${c.explain.label}</strong><div class="small muted">${escapeHtml(c.explain.prompt)}</div></div></div><textarea class="textarea-control" data-preview-challenge="explain" placeholder="用自己的话解释，不要求照抄课本。">${escapeHtml(c.explain.value)}</textarea></div>
          <div class="challenge-item"><div class="challenge-head">${icon('science', 'svg-icon')}<div><strong>${c.apply.label}</strong><div class="small muted">${escapeHtml(c.apply.prompt)}</div></div></div><textarea class="textarea-control" data-preview-challenge="apply" placeholder="写下生活例子、估计和理由。">${escapeHtml(c.apply.value)}</textarea></div>
        </div>
        <div class="traffic-light ${lesson.trafficLight}"><span class="light-dot"></span><div><strong>预习反馈</strong><div class="small muted">${trafficText(lesson.trafficLight)}</div></div></div>
        <button class="btn btn-primary btn-block" type="button" data-action="evaluate-preview" style="margin-top:11px">生成预习反馈</button>
      </section>`;
  }

  function discoveryPanel(lesson) {
    const completed = lesson.steps.filter((step) => step.complete);
    return `
      <section class="card discovery-panel">
        <div class="section-head"><div><h3 class="section-title" style="font-size:17px">预习成果记录</h3><p class="section-copy">我的发现与问题会自动保存在当前浏览器。</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="export-preview">${icon('download', 'svg-icon xs')}导出记录</button></div>
        <div class="discovery-tabs"><span class="discovery-tab">知识卡片</span><span class="discovery-tab">我的问题</span><span class="discovery-tab">我的实验</span><span class="discovery-tab">我的猜想</span></div>
        ${completed.length ? `<div class="archive-list">${completed.map((step) => `<div class="history-item">${icon(step.icon,'svg-icon')}<div><h4>${escapeHtml(step.title)} · ${escapeHtml(step.subtitle)}</h4><p>${escapeHtml(step.value || '本步已完成')}</p></div><time>已保存</time></div>`).join('')}</div>` : `<div class="discovery-empty">${icon('archive', 'svg-icon')}<div>还没有成果记录。完成上面的步骤后，发现会自动汇总到这里。</div></div>`}
        ${state.ui.parentMode ? `<div class="challenge-item" style="margin-top:12px"><strong>家长复核</strong><textarea class="textarea-control" data-parent-review-note placeholder="只记录观察和陪伴建议，不替孩子完成。">${escapeHtml(lesson.parentReview.note)}</textarea><label class="option-label" style="margin-top:8px"><input type="checkbox" data-action="parent-reviewed" ${lesson.parentReview.reviewed ? 'checked' : ''}><span>已抽样核对教材页码、图示与答案</span></label></div>` : ''}
      </section>`;
  }

  function renderPreview() {
    return `
      <div class="page-wrap">
        <div class="page-grid with-sidebar">
          ${sidebar('preview', 'think', previewTips())}
          <main class="content-stack">
            <six-step-preview child-name="${escapeHtml(state.profile.childName)}" mascot-name="${escapeHtml(state.profile.mascotName)}"></six-step-preview>
          </main>
        </div>
      </div>`;
  }

  function mapSummary() {
    reconcileMilestones();
    const unlocked = state.mapRegions.filter((region) => region.unlocked).length;
    const completion = Math.round(state.mapRegions.reduce((sum, region) => sum + region.progress, 0) / state.mapRegions.length);
    return `
      <section class="card map-top">
        <h1 class="section-title">我的学习冒险地图</h1>
        <div class="map-metric">${icon('map', 'svg-icon')}<div><span>已探索区域</span><strong>${unlocked} / ${state.mapRegions.length}</strong></div></div>
        <div class="map-metric">${icon('star', 'svg-icon')}<div><span>获得成长星</span><strong>${state.wallet.growthStars}</strong></div></div>
        <div class="map-metric">${icon('badge', 'svg-icon')}<div><span>已点亮能力</span><strong>${litBadges().length} / ${state.badges.length}</strong></div></div>
        <div class="map-metric">${icon('chart', 'svg-icon')}<div><span>地图完成度</span><strong>${completion}%</strong></div></div>
      </section>`;
  }

  function mapRoutes() {
    return `<svg class="map-routes" viewBox="0 0 1000 630" preserveAspectRatio="none" aria-hidden="true"><path d="M180 145 C300 105 360 100 480 90 S690 100 800 140" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="3 22"/><path d="M800 170 C840 270 820 350 760 395" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="3 22"/><path d="M695 440 C590 500 510 490 435 430" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="3 22"/><path d="M350 410 C255 425 200 395 155 360" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="3 22"/></svg>`;
  }

  function mapIsland(region) {
    const badgeCount = (region.abilityIds || []).map(badgeById).filter((badge) => badge && badgeStage(badge) !== 'locked').length;
    return `
      <button class="map-hotspot ${region.unlocked ? 'unlocked' : 'locked'}" type="button" data-action="open-region" data-region-id="${region.id}" style="left:${region.x}%;top:${region.y}%" aria-label="${escapeHtml(region.name)}，进度${region.progress}%">
        <span class="visually-hidden">${escapeHtml(region.name)} · ${region.unlocked ? `${region.progress}% · 已点亮${badgeCount}项能力` : `${region.unlockAtStars}成长星解锁`}</span>
      </button>`;
  }

  function mapMissionCard() {
    const target = state.mapRegions.find((region) => region.id === 'reading-castle');
    return `
      <section class="card card-pad">
        <div class="section-head"><div><h3 class="section-title" style="font-size:16px">本周探索任务</h3><p class="section-copy">下一目标：提升阅读城堡进度</p></div>${icon('trophy','svg-icon sm')}</div>
        <strong>完成 2 项阅读任务</strong><div class="small muted" style="margin:5px 0 8px">当前进度 ${target.progress}%</div><div class="progress-track"><div class="progress-fill" style="width:${target.progress}%"></div></div>
        <button class="btn btn-primary btn-block btn-sm" type="button" data-action="nav" data-route="tasks" style="margin-top:11px">去完成任务</button>
      </section>`;
  }

  function mapBottom() {
    const lit = litBadges().length;
    return `
      <div class="map-bottom">
        <section class="card flow-card"><div class="section-head"><h3 class="section-title" style="font-size:16px">成长激励路径</h3></div><div class="flow-row"><div class="flow-node">${icon('clipboard','svg-icon')}完成学习行为</div><span class="flow-arrow"></span><div class="flow-node">${icon('badge','svg-icon')}推动能力徽章</div><span class="flow-arrow"></span><div class="flow-node">${icon('star','svg-icon')}积累成长星</div><span class="flow-arrow"></span><div class="flow-node">${icon('map','svg-icon')}解锁地图</div></div></section>
        <section class="card collection-card"><div class="section-head"><h3 class="section-title" style="font-size:16px">我的成长资源</h3><button class="btn btn-ghost btn-sm" type="button" data-action="nav" data-route="archive">查看全部</button></div><div class="collection-row"><div class="collection-item">${icon('badge','svg-icon')}<span>已点亮徽章<br><strong>${lit}</strong></span></div><div class="collection-item">${icon('star','svg-icon')}<span>成长星<br><strong>${state.wallet.growthStars}</strong></span></div><div class="collection-item">${icon('coin','svg-icon')}<span>探索币<br><strong>${state.wallet.exploreCoins}</strong></span></div><div class="collection-item">${icon('key','svg-icon')}<span>地图钥匙<br><strong>${state.wallet.mapKeys}</strong></span></div></div></section>
        <section class="card reward-callout">${icon('gift','svg-icon')}<div><strong>探索币奖励商店</strong><p class="section-copy">兑换 Dino 配件、地图主题和家庭自定义奖励。</p><button class="btn btn-warning btn-sm" type="button" data-action="show-rewards">查看奖励</button></div></section>
      </div>`;
  }

  function renderMap() {
    return `
      <div class="page-wrap page-wrap-map-v16">
        <div class="page-grid with-sidebar">
          ${sidebar('map', 'map', mapMissionCard())}
          <main class="content-stack">
            <section class="card map-shell-v16">
              ${mapSummary()}
              <div class="map-stage map-stage-v16">
                <img class="map-art-image" src="assets/maps/growth-map-full.jpg" alt="包含知识森林、数学峰谷、英语海湾、科学火山、阅读城堡和编程迷宫的成长地图">
                ${state.mapRegions.map(mapIsland).join('')}
                <div class="map-state-legend"><span>${icon('lock','svg-icon xs')}锁定</span><span>${icon('check','svg-icon xs')}可进入</span><span>${icon('map','svg-icon xs')}进行中</span><span>${icon('star','svg-icon xs')}满星完成</span></div>
              </div>
            </section>
            ${mapBottom()}
          </main>
        </div>
      </div>`;
  }

  function archiveReport() {
    reconcileMilestones();
    const lit = litBadges();
    const latest = state.history.find((item) => item.type === 'badge');
    const recentMonth = state.history.filter((item) => item.type === 'badge' && String(item.date || '').slice(0,7) === todayIso().slice(0,7)).length || 2;
    return `
      <section class="card ability-overview-card">
        <div class="section-head"><div><h1 class="section-title">我的能力徽章</h1><p class="section-copy">每一次努力，都会留下能力证据，点亮成长的光芒。</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="export-data">${icon('download','svg-icon xs')}导出成长数据</button></div>
        <div class="ability-overview-grid">
          <div class="ability-metric blue">${icon('badge','svg-icon')}<span>已点亮徽章<strong>${lit.length}</strong><small>共 ${state.badges.length} 个</small></span></div>
          <div class="ability-metric amber">${icon('star','svg-icon')}<span>闪耀徽章<strong>${shineBadges().length}</strong><small>表现稳定优秀</small></span></div>
          <div class="ability-metric green">${icon('energy','svg-icon')}<span>本月新点亮<strong>${recentMonth}</strong><small>持续成长中</small></span></div>
          <div class="ability-metric purple">${icon('trophy','svg-icon')}<span>最近升级<strong>1</strong><small>${escapeHtml(latest?.title || '时间小管家')}</small></span></div>
        </div>
      </section>`;
  }

  function historyPanel() {
    const iconByType = { task: 'check', preview: 'preview', badge: 'badge' };
    return `<section class="card card-pad"><div class="section-head"><div><h3 class="section-title" style="font-size:18px">学习记录</h3><p class="section-copy">作品、问题与完成证据</p></div>${icon('archive','svg-icon sm')}</div><div class="archive-list">${state.history.map((item) => `<article class="history-item">${icon(iconByType[item.type] || 'archive','svg-icon')}<div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)}</p></div><time>${escapeHtml(item.date)}</time></article>`).join('')}</div></section>`;
  }

  function badgeWallCard(badge) {
    const stage = badgeStage(badge);
    const target = badgeTarget(badge);
    return `<article class="badge-wall-card category-${escapeHtml(badge.category)} stage-${stage}">
      <div class="badge-emblem category-${escapeHtml(badge.category)} stage-${stage}">${icon(stage === 'locked' ? 'lock' : badge.icon,'svg-icon')}</div>
      <div class="badge-wall-copy"><div class="ability-card-title"><strong>${escapeHtml(badge.name)}</strong><span class="badge-stage-chip stage-${stage}">${badgeStageLabel(badge)}</span></div><p>${escapeHtml(badge.description)}</p><div class="ability-progress-line"><span>能力证据</span><strong>${badge.progress} / ${target}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${badgePercent(badge)}%"></div></div></div>
    </article>`;
  }

  function recentBadgesPanel() {
    const recentHistory = state.history.filter((item) => item.type === 'badge').slice(0,4);
    const fallback = featuredBadges().map((badge,index) => ({title:`${badge.name} · ${badgeStageLabel(badge)}`,detail:badge.description,date:index===0?'今天':`${index+1}天前`}));
    const items = recentHistory.length ? recentHistory : fallback;
    return `<section class="card card-pad recent-badges-panel"><div class="section-head"><div><h3 class="section-title" style="font-size:18px">最近点亮</h3><p class="section-copy">能力升级与重要里程碑</p></div>${icon('star','svg-icon sm')}</div><div class="badge-timeline">${items.map((item) => `<article><i></i><div class="badge-emblem tiny category-thinking stage-growth">${icon('badge','svg-icon xs')}</div><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail || '')}</p><time>${escapeHtml(item.date || '')}</time></div></article>`).join('')}</div></section>`;
  }

  function regionAchievementsPanel() {
    return `<section class="card card-pad region-achievement-panel"><div class="section-head"><div><h3 class="section-title" style="font-size:18px">区域成就</h3><p class="section-copy">在成长地图中探索，解锁对应能力。</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="nav" data-route="map">查看地图</button></div><div class="region-achievement-grid">${state.mapRegions.slice(0,4).map((region) => {const badges=(region.abilityIds||[]).map(badgeById).filter(Boolean);const lit=badges.filter((b)=>badgeStage(b)!=='locked').length;return `<button type="button" data-action="open-region" data-region-id="${region.id}" class="region-achievement-card"><span class="region-mini-art region-${region.color}">${icon(region.icon,'svg-icon')}</span><strong>${escapeHtml(region.name)}</strong><small>能力 ${lit}/${badges.length}</small></button>`;}).join('')}</div></section>`;
  }

  function rewardLedgerPanel() {
    const items=(state.rewardLedger||[]).slice(0,5);
    return `<section class="card card-pad reward-ledger-panel"><div class="section-head"><div><h3 class="section-title" style="font-size:18px">成长奖励流水</h3><p class="section-copy">记录经验、成长星、探索币与能力证据。</p></div>${icon('chart','svg-icon sm')}</div><div class="reward-ledger-list">${items.map((entry)=>`<article><div><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.date)}</span></div><p>${entry.xp?`XP +${entry.xp}　`:''}${entry.growthStars?`成长星 +${entry.growthStars}　`:''}${entry.exploreCoins?`探索币 +${entry.exploreCoins}`:''}</p></article>`).join('') || '<div class="empty-state">暂无奖励记录</div>'}</div></section>`;
  }

  function badgesPanel() {
    const active = state.ui.activeBadgeCategory || 'habit';
    const categories = state.badgeCategories || [];
    const filtered = state.badges.filter((badge) => badge.category === active);
    return `<section class="card card-pad badge-system-panel">
      <div class="section-head"><div><h3 class="section-title" style="font-size:19px">能力徽章墙</h3><p class="section-copy">萌芽 → 成长 → 闪耀，用真实行为证据记录能力积累。</p></div>${icon('badge','svg-icon sm')}</div>
      <div class="badge-category-tabs">${categories.map((category) => `<button class="${active===category.id?'active':''}" type="button" data-action="filter-badge-category" data-category="${category.id}">${icon(category.icon,'svg-icon xs')}${escapeHtml(category.name)}</button>`).join('')}</div>
      <div class="badge-wall-grid">${filtered.map(badgeWallCard).join('')}</div>
    </section>`;
  }

  function apiSettingsPanel() {
    const settings = state.profile.aiSettings || {};
    const statusClass = settings.lastTestStatus === '连接成功' ? 'success' : settings.lastTestStatus === '连接失败' ? 'danger' : '';
    return `
      <section class="card parent-panel ai-settings-panel">
        <div class="section-head"><div><h3 class="section-title" style="font-size:18px">AI 服务设置</h3><p class="section-copy">由家长配置；孩子端不显示密钥内容。</p></div>${icon('settings','svg-icon sm')}</div>
        <form id="api-settings-form">
          <div class="form-grid">
            <div class="field"><label>运行模式</label><select class="select-control" name="mode"><option value="mock" ${settings.mode === 'mock' ? 'selected' : ''}>离线演示模式</option><option value="proxy" ${settings.mode === 'proxy' ? 'selected' : ''}>本地代理模式（推荐）</option><option value="compatible" ${settings.mode === 'compatible' ? 'selected' : ''}>兼容接口模式（仅本地演示）</option></select></div>
            <div class="field"><label>模型名称</label><input class="text-control" name="model" value="${escapeHtml(settings.model || '')}" placeholder="例如：轻量模型名称"></div>
          </div>
          <div class="field"><label>API / 代理地址</label><input class="text-control" name="baseUrl" value="${escapeHtml(settings.baseUrl || '')}" placeholder="例如：本地代理地址或兼容接口地址"></div>
          <div class="field"><label>API Key</label><input class="text-control" type="password" name="apiKey" autocomplete="off" value="${escapeHtml(settings.apiKey || '')}" placeholder="仅保存到当前浏览器"><span class="field-hint">安全提示：正式上线不要把密钥保存在浏览器，请使用服务端代理。本字段仅用于本地演示。</span></div>
          <div class="api-status-row"><span class="api-test-status ${statusClass}">${icon('info','svg-icon xs')}${escapeHtml(settings.lastTestStatus || '未测试')}${settings.lastTestAt ? ` · ${escapeHtml(settings.lastTestAt)}` : ''}</span><div class="data-actions"><button class="btn btn-ghost btn-sm" type="button" data-action="test-api-settings">测试连接</button><button class="btn btn-primary btn-sm" type="button" data-action="save-api-settings">保存设置</button></div></div>
        </form>
      </section>`;
  }

  function parentPanel() {
    return `
      <section class="card parent-panel">
        <div class="section-head"><div><h3 class="section-title" style="font-size:18px">家长中心</h3><p class="section-copy">安排计划、复核内容和管理本地数据</p></div>${icon('parent','svg-icon sm')}</div>
        <ul><li>可以提前安排今天或未来日期的学习任务。</li><li>预习时用问题帮助孩子表达，不提前讲完整答案。</li><li>抽样核对教材页码、图形、公式和参考答案。</li><li>所有演示数据默认保存在当前浏览器。</li></ul>
        <div class="data-actions"><button class="btn btn-primary btn-sm" type="button" data-action="open-manual-task">安排新任务</button><button class="btn btn-secondary btn-sm" type="button" data-action="toggle-parent-mode">${state.ui.parentMode ? '退出家长模式' : '进入家长模式'}</button><button class="btn btn-ghost btn-sm" type="button" data-action="export-data">导出本地数据</button><button class="btn btn-danger btn-sm" type="button" data-action="open-reset">重置演示数据</button></div>
      </section>`;
  }

  function renderArchive() {
    return `
      <div class="page-wrap page-wrap-archive-v2">
        <div class="page-grid with-sidebar archive-layout-v2">
          ${sidebar('archive', 'celebrate', collectionCard())}
          <main class="archive-main-v2">
            ${archiveReport()}
            <section class="card card-pad featured-abilities-section"><div class="section-head"><div><h3 class="section-title" style="font-size:18px">今日可点亮能力</h3><p class="section-copy">选择离升级最近的目标，让今天的任务更有方向。</p></div>${icon('energy','svg-icon sm')}</div><div class="ability-goal-grid">${featuredBadges().map((badge)=>abilityProgressCard(badge)).join('')}</div></section>
            ${badgesPanel()}
          </main>
          <aside class="archive-right-v2">${recentBadgesPanel()}${regionAchievementsPanel()}</aside>
        </div>
        <div class="archive-bottom-v2">${historyPanel()}${rewardLedgerPanel()}${parentPanel()}${apiSettingsPanel()}</div>
      </div>`;
  }

  function render() {
    const route = currentRoute();
    state.ui.currentRoute = route;
    saveState();
    const pages = { home: renderHome, tasks: renderTasks, preview: renderPreview, map: renderMap, archive: renderArchive };
    app.innerHTML = `${topbar(route)}${pages[route]()}`;
    document.title = `${routes.find((item) => item.id === route).label}｜${state.profile.childName}学习冒险基地`;
    updateFocusTimerDom();
  }

  function showToast(message, type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    toastRoot.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function showModal(content, wide = false) {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">${content}</section></div>`;
  }

  function closeModal() { modalRoot.innerHTML = ''; }

  function modalShell(title, body, footer = '') {
    return `<div class="modal-head"><div><h2>${escapeHtml(title)}</h2></div><button class="close-button" type="button" data-action="close-modal" aria-label="关闭">×</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}`;
  }

  function resizeAvatarFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('请选择图片文件。'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('图片请控制在 5MB 以内。'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('图片读取失败。'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('图片解析失败。'));
        image.onload = () => {
          const size = 320;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(size / image.width, size / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          ctx.clearRect(0,0,size,size);
          ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function updateAvatarPreview(source) {
    const image = document.querySelector('[data-avatar-preview]');
    if (image) image.src = source || 'assets/characters/avatar-xiaoming.png';
  }

  function openProfile() {
    pendingAvatarDataUrl = null;
    const currentAvatar = state.profile.avatarMode === 'uploaded' && state.profile.avatarDataUrl ? state.profile.avatarDataUrl : 'assets/characters/avatar-xiaoming.png';
    const body = `
      <form id="profile-form">
        <section class="avatar-upload-panel">
          <div class="avatar-preview-shell"><img data-avatar-preview src="${currentAvatar}" alt="头像预览"></div>
          <div class="avatar-upload-copy"><strong>孩子头像</strong><p class="section-copy">默认使用由小明完整人物形象裁切出的专属头像，也可以上传一张家庭自选头像。</p>
            <div class="avatar-mode-row"><label class="option-label"><input type="radio" name="avatarMode" value="ai" ${state.profile.avatarMode !== 'uploaded' ? 'checked' : ''}><span>使用小明人物形象头像</span></label><label class="option-label"><input type="radio" name="avatarMode" value="uploaded" ${state.profile.avatarMode === 'uploaded' ? 'checked' : ''}><span>使用上传头像</span></label></div>
            <div class="avatar-upload-actions"><label class="btn btn-secondary btn-sm file-button">${icon('upload','svg-icon xs')}选择图片<input type="file" accept="image/png,image/jpeg,image/webp" data-action="avatar-file" hidden></label><button class="btn btn-ghost btn-sm" type="button" data-action="remove-avatar">移除上传头像</button></div>
            <span class="field-hint">图片会压缩为 320×320 并仅保存到当前浏览器。</span>
          </div>
        </section>
        <div class="form-grid"><div class="field"><label>孩子昵称</label><input class="text-control" name="childName" maxlength="12" value="${escapeHtml(state.profile.childName)}"></div><div class="field"><label>年级</label><select class="select-control" name="grade">${['一年级','二年级','三年级','四年级','五年级','六年级'].map((grade) => `<option ${grade === state.profile.grade ? 'selected' : ''}>${grade}</option>`).join('')}</select></div><div class="field"><label>专属吉祥物名字</label><input class="text-control" name="mascotName" maxlength="16" value="${escapeHtml(state.profile.mascotName)}"><span class="field-hint">名字会出现在所有页面的专属伙伴区域。</span></div><div class="field"><label>每日可用时间</label><input class="number-control" type="number" min="15" max="240" step="5" name="dailyEnergyMinutes" value="${state.profile.dailyEnergyMinutes}"></div></div>
      </form>`;
    showModal(modalShell('孩子个人信息', body, `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="button" data-action="save-profile">保存设置</button>`), true);
  }

  function openGenerator() {
    const body = `<form id="modal-generator-form"><div class="form-grid"><div class="field"><label>计划日期</label><input class="text-control" type="date" name="scheduledDate" value="${todayIso()}"></div><div class="field"><label>年级</label><select class="select-control" name="grade">${['一年级','二年级','三年级','四年级','五年级','六年级'].map((grade) => `<option ${grade === state.profile.grade ? 'selected' : ''}>${grade}</option>`).join('')}</select></div><div class="field"><label>可用时间</label><select class="select-control" name="minutes"><option value="30">30 分钟</option><option value="45">45 分钟</option><option value="60">60 分钟</option><option value="90" selected>90 分钟</option><option value="120">120 分钟</option></select></div><div class="field"><label>开始时间</label><input class="text-control" type="time" name="startTime" value="18:30"></div></div><div class="field"><label>今日重点</label><div class="tag-picker">${['数学','英语','语文','科学','阅读','思维'].map((item,index) => `<span class="tag-option"><input id="modal-focus-${index}" type="checkbox" name="focus" value="${item}" ${index < 2 ? 'checked' : ''}><label for="modal-focus-${index}">${item}</label></span>`).join('')}</div></div><div class="field"><label>补充目标</label><textarea class="textarea-control" name="goal" placeholder="例如：数学重点练习分数应用题，英语以开口表达为主。"></textarea></div><div class="challenge-item"><strong>接口说明</strong><p class="section-copy">当前为 ${apiModeLabel()}。可以在“成长档案 → AI 服务设置”中保存接口信息；不可用时自动回退到本地模板。</p></div></form>`;
    showModal(modalShell('AI安排学习任务', body, `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="button" data-action="generate-tasks" data-form="modal-generator-form">生成任务</button>`), true);
  }

  function openManualTask(defaultDate = '') {
    const scheduledDate = defaultDate || state.ui.selectedCalendarDate || todayIso();
    const abilityOptions = state.badges.filter((badge) => !badge.milestone).map((badge) => `<option value="${badge.id}">${escapeHtml(categoryById(badge.category).name)} · ${escapeHtml(badge.name)}</option>`).join('');
    const body = `
      <form id="manual-task-form">
        <div class="form-grid"><div class="field"><label>任务日期</label><input class="text-control" type="date" name="scheduledDate" value="${escapeHtml(scheduledDate)}"></div><div class="field"><label>开始时间</label><input class="text-control" type="time" name="dueTime" value="18:30"></div><div class="field"><label>学科</label><select class="select-control" name="subject"><option>数学</option><option>语文</option><option>英语</option><option>科学</option><option>阅读</option><option>思维</option><option>预习</option></select></div><div class="field"><label>任务类型</label><select class="select-control" name="group"><option value="required">必做任务</option><option value="optional">选做挑战</option><option value="adventure">冒险任务</option></select></div></div>
        <div class="field"><label>任务名称</label><input class="text-control" name="title" maxlength="48" placeholder="例如：完成数学练习册第15—16页"></div>
        <div class="form-grid"><div class="field"><label>预计时间（分钟）</label><input class="number-control" type="number" name="minutes" min="5" max="180" value="20"></div><div class="field"><label>主要培养能力</label><select class="select-control" name="primaryAbility"><option value="">按学科自动匹配</option>${abilityOptions}</select></div></div>
        <div class="field"><label>任务说明</label><textarea class="textarea-control" name="description" placeholder="告诉孩子要完成什么，可以写页码、范围或具体步骤。"></textarea></div>
        <div class="field"><label>完成标准</label><input class="text-control" name="evidenceRule" maxlength="100" placeholder="例如：完成练习，并用自己的话讲清一道题"></div>
        <div class="challenge-item"><strong>V2 奖励规则</strong><p class="section-copy">奖励由系统按任务时长与学习证据自动计算：获得经验和探索币；提交有效证据后获得成长星，并推动所选能力徽章。</p></div>
      </form>`;
    showModal(modalShell('家长安排学习任务', body, `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="button" data-action="save-manual-task">保存任务计划</button>`), true);
  }

  function openTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (task.route === 'preview' && task.status !== 'done') { routeTo('preview'); return; }
    const reward = normalizeReward(task.reward);
    const abilities = taskAbilityBadges(task);
    const abilityHtml = abilities.length ? `<div class="task-detail-abilities"><strong>本任务主要培养</strong><div>${abilities.map((badge) => `<span>${icon(badge.icon,'svg-icon xs')}${escapeHtml(badge.name)}</span>`).join('')}</div></div>` : '';
    const body = `<div class="task-detail-hero">${icon(task.icon,'svg-icon')}<div><div class="eyebrow">${escapeHtml(task.subject)} · ${escapeHtml(task.focus)} · ${escapeHtml(task.assignedBy || '学习计划')}</div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description)}</p><div class="task-schedule-line"><span>${icon('calendar','svg-icon xs')}${formatDateLabel(taskDate(task))}</span>${task.dueTime ? `<span>${icon('clock','svg-icon xs')}${escapeHtml(task.dueTime)}</span>` : ''}</div></div></div><div class="summary-grid reward-summary-v2" style="margin-top:16px;grid-template-columns:repeat(4,1fr)">${summaryItem('clock','预计用时',`${task.minutes} 分钟`)}${summaryItem('badge','经验值',`+${reward.xp}`)}${summaryItem('coin','探索币',`+${reward.exploreCoins}`)}${summaryItem('star','有效证据成长星',`+${reward.growthStars}`)}</div>${abilityHtml}<form id="task-progress-form" style="margin-top:16px"><input type="hidden" name="taskId" value="${task.id}"><div class="field"><label>完成进度</label><input style="width:100%" type="range" min="0" max="100" step="10" name="progress" value="${task.progress}"><span class="field-hint">当前 ${task.progress}%</span></div><div class="field"><label>完成证据或学习记录</label><textarea class="textarea-control" name="evidence" placeholder="${escapeHtml(task.evidenceRule || '写下完成了什么、遇到什么问题，或者用自己的话总结。')}">${escapeHtml(task.evidence)}</textarea><span class="field-hint">成长星和能力进度只在提交真实学习证据后发放。</span></div></form>`;
    const footer = `<button class="btn btn-danger" type="button" data-action="delete-task" data-task-id="${task.id}">删除</button><span style="flex:1"></span><button class="btn btn-ghost" type="button" data-action="save-task-progress">保存进度</button><button class="btn btn-primary" type="button" data-action="complete-task" data-task-id="${task.id}" ${task.status === 'done' ? 'disabled' : ''}>${task.status === 'done' ? '已经完成' : '完成并记录成长'}</button>`;
    showModal(modalShell('任务详情', body, footer), true);
  }

  function openPreviewGenerator() {
    const body = `<form id="preview-generator-form"><div class="form-grid"><div class="field"><label>年级</label><input class="text-control" name="grade" value="${escapeHtml(state.profile.grade)}"></div><div class="field"><label>学科</label><select class="select-control" name="subject"><option>数学</option><option>语文</option><option>英语</option><option>科学</option></select></div><div class="field"><label>教材版本</label><input class="text-control" name="edition" value="人教版"></div><div class="field"><label>课题</label><input class="text-control" name="title" value="角的度量（2）"></div></div><div class="field"><label>教材内容或本课要点</label><textarea class="textarea-control" name="sourceText" placeholder="粘贴教材目录、知识点、课文摘要或教师提供的本课目标。"></textarea><span class="field-hint">不上传图片也能生成。后续可扩展教材文件解析，但必须保留人工复核。</span></div><div class="challenge-item"><strong>生成结构</strong><p class="section-copy">知识卡 + 看全貌、测基础、想明白、验理解、练迁移、定重点 + 认一认、说一说、用一用 + 家长复核字段。</p></div></form>`;
    showModal(modalShell('生成一张新的预习单', body, `<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="button" data-action="generate-preview">生成预习单</button>`), true);
  }

  function openRegion(regionId) {
    const region = state.mapRegions.find((item) => item.id === regionId);
    if (!region) return;
    const regionBadges = (region.abilityIds || []).map(badgeById).filter(Boolean);
    const requiredBadge = region.requiredBadgeId ? badgeById(region.requiredBadgeId) : null;
    const abilityHtml = regionBadges.length ? `<div class="region-ability-list">${regionBadges.map((badge) => `<span class="stage-${badgeStage(badge)}">${icon(badge.icon,'svg-icon xs')}${escapeHtml(badge.name)} · ${badgeStageLabel(badge)}</span>`).join('')}</div>` : '';
    const unlockText = requiredBadge ? `需要 ${region.unlockAtStars} 颗成长星，并点亮“${requiredBadge.name}·${BADGE_STAGE_LABELS[region.requiredStage || 'sprout']}”` : `需要 ${region.unlockAtStars} 颗成长星`;
    const body = `<div class="task-detail-hero">${icon(region.unlocked ? region.icon : 'lock','svg-icon')}<div><div class="eyebrow">${escapeHtml(region.subject)}区域</div><h3>${escapeHtml(region.name)}</h3><p>${escapeHtml(region.description)}</p></div></div><div class="summary-grid" style="margin-top:16px;grid-template-columns:repeat(3,1fr)">${summaryItem('chart','区域进度',`${region.progress}%`)}${summaryItem('badge','区域能力',`${regionBadges.filter((badge) => badgeStage(badge) !== 'locked').length}/${regionBadges.length}`)}${summaryItem(region.unlocked ? 'key':'lock','状态',region.unlocked ? '已解锁':'未解锁')}</div><div class="challenge-item" style="margin-top:14px"><strong>${region.unlocked ? '区域能力徽章' : '解锁条件'}</strong>${region.unlocked ? abilityHtml : `<p class="section-copy">${escapeHtml(unlockText)}。当前：${state.wallet.growthStars} 颗成长星。</p>${abilityHtml}`}</div>`;
    showModal(modalShell(region.name, body, `<button class="btn btn-ghost" type="button" data-action="close-modal">关闭</button>${region.unlocked ? `<button class="btn btn-primary" type="button" data-action="nav" data-route="tasks">去做任务</button>` : ''}`));
  }

  function openCalendarDay(date) {
    const summary = calendarSummary(date);
    state.ui.selectedCalendarDate = date;
    saveState();
    const scheduled = tasksForDate(date);
    const taskListHtml = scheduled.length ? scheduled.map((task) => `<article class="calendar-task-item ${task.status === 'done' ? 'done' : ''}">${icon(task.icon,'svg-icon')}<div><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(task.subject)} · ${task.dueTime ? `${escapeHtml(task.dueTime)} · ` : ''}${task.minutes} 分钟 · ${escapeHtml(task.assignedBy || '学习计划')}</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="open-task" data-task-id="${task.id}">${task.status === 'done' ? '查看记录' : '打开任务'}</button></article>`).join('') : (summary.tasks || []).length ? (summary.tasks || []).map((title) => `<article class="calendar-task-item historical">${icon('check','svg-icon')}<div><strong>${escapeHtml(title)}</strong><p>历史学习记录</p></div></article>`).join('') : `<div class="empty-state">${icon('calendar','svg-icon')}<p>这一天还没有安排任务。</p></div>`;
    const body = `<div class="calendar-day-overview"><div><span class="eyebrow">${escapeHtml(date)}</span><h3>${formatDateLabel(date)}学习计划</h3><p class="section-copy">计划 ${summary.planned || 0} 项，完成 ${summary.completed || 0} 项，获得 ${summary.growthStars || 0} 颗成长星。</p></div><div class="calendar-day-score ${summary.status}"><strong>${summary.completed || 0}/${summary.planned || 0}</strong><span>${summary.status === 'done' ? '全部完成' : summary.status === 'partial' ? '部分完成' : summary.status === 'planned' ? '等待开始' : '暂无计划'}</span></div></div><div class="calendar-task-list">${taskListHtml}</div>`;
    showModal(modalShell(formatDateLabel(date), body, `<button class="btn btn-ghost" type="button" data-action="close-modal">关闭</button><button class="btn btn-primary" type="button" data-action="open-manual-task-date" data-date="${date}">为这一天安排任务</button>`), true);
  }

  function shiftCalendarMonth(offset) {
    const date = parseMonthKey(state.ui.calendarMonth || monthKeyFromDate(new Date()));
    date.setMonth(date.getMonth() + offset);
    state.ui.calendarMonth = monthKeyFromDate(date);
    state.ui.selectedCalendarDate = `${state.ui.calendarMonth}-01`;
    saveState();
    render();
  }

  function saveApiSettings(showMessage = true) {
    const data = formDataObject('api-settings-form');
    if (!data) return false;
    state.profile.aiSettings = {
      ...state.profile.aiSettings,
      mode: data.mode || 'mock',
      baseUrl: String(data.baseUrl || '').trim(),
      apiKey: String(data.apiKey || '').trim(),
      model: String(data.model || '').trim()
    };
    saveState();
    if (showMessage) showToast('AI 服务设置已保存在当前浏览器。', 'success');
    return true;
  }

  async function testApiSettings() {
    if (!saveApiSettings(false)) return;
    const settings = state.profile.aiSettings;
    try {
      if (settings.mode === 'mock') {
        settings.lastTestStatus = '连接成功';
      } else if (settings.mode === 'proxy') {
        const base = (settings.baseUrl || location.origin).replace(/\/$/, '');
        if (location.protocol === 'file:' && !settings.baseUrl) throw new Error('请填写本地服务地址，或使用 start.bat / start.sh 启动。');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${base}/api/health`, { signal:controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`健康检查失败：${response.status}`);
        settings.lastTestStatus = '连接成功';
      } else {
        if (!settings.baseUrl || !settings.model || !settings.apiKey) throw new Error('请完整填写接口地址、模型名称和 API Key。');
        settings.lastTestStatus = '配置完整';
      }
      settings.lastTestAt = new Date().toLocaleString('zh-CN', { hour12:false });
      saveState(); render(); showToast(settings.mode === 'compatible' ? '配置字段已校验；正式调用仍建议使用服务端代理。' : '连接测试成功。', 'success');
    } catch (error) {
      settings.lastTestStatus = '连接失败';
      settings.lastTestAt = new Date().toLocaleString('zh-CN', { hour12:false });
      saveState(); render(); showToast(error.message || '连接测试失败。', 'warning');
    }
  }

  function formDataObject(formId) {
    const form = document.getElementById(formId);
    if (!form) return null;
    const data = new FormData(form);
    const object = Object.fromEntries(data.entries());
    object.focus = data.getAll('focus');
    return object;
  }

  function mockTasks(payload) {
    const requested = Array.isArray(payload.focus) ? payload.focus.filter(Boolean) : [];
    const minutes = Math.max(15, Math.min(180, Number(payload.minutes || 60)));
    const count = Math.max(3, Math.min(5, Math.ceil(minutes / 25)));
    const subjects = [...requested, '数学', '阅读', '预习', '英语', '语文', '科学', '思维']
      .filter((item, index, list) => list.indexOf(item) === index)
      .slice(0, count);
    const perTask = Math.max(10, Math.min(30, Math.floor(minutes / subjects.length / 5) * 5));
    const templates = {
      '数学': ['核心概念回顾与一道解释题','先复习一个核心概念，再完成一道基础题和一道迁移题。','math','理解概念'],
      '英语': ['主题口语与朗读练习','完成5分钟跟读，再围绕一个生活主题说出5句话。','english','开口表达'],
      '语文': ['课文阅读与问题记录','阅读一段课文，圈出关键词，并写下一个想带进课堂的问题。','reading','提取信息'],
      '科学': ['生活现象观察任务','观察一个生活现象，记录现象、猜想和可能的解释。','science','观察证据'],
      '阅读': ['整本书阅读与一句概括','专注阅读后写下一句话概括和一个值得讨论的问题。','book','概括提问'],
      '思维': ['逻辑推理小挑战','完成一组推理题，并用自己的话说出排除过程。','thinking','解释理由'],
      '预习': ['六步课前预习','完成看全貌、测基础、想明白、验理解、练迁移和定重点。','preview','问题意识']
    };
    return subjects.map((subject,index) => {
      const t = templates[subject] || templates['阅读'];
      return { id:`ai-task-${Date.now()}-${index}`, subject, icon:t[2], group:index < 2 ? 'required' : index === subjects.length - 1 ? 'adventure' : 'optional', title:t[0], description:t[1], minutes:perTask, difficulty:Math.min(3,index + 1), reward:{growthStars:1 + (index === subjects.length - 1 ? 1 : 0),exploreCoins:8 + index * 3,xp:18 + index * 4,mapEnergy:8 + index * 2}, status:'todo', progress:0, evidence:'', focus:t[3], scheduledDate:payload.scheduledDate || todayIso(), dueTime:payload.startTime || '', assignedBy:'AI规划', evidenceRule:'完成任务并用自己的话留下学习记录。', abilities:defaultAbilitiesForTask({subject}) };
    });
  }

  function normalizeApiTask(task, index) {
    const iconMap = { '数学':'math','英语':'english','语文':'reading','科学':'science','阅读':'book','思维':'thinking','预习':'preview' };
    return {
      id: task.id || `api-task-${Date.now()}-${index}`,
      subject: task.subject || '阅读',
      icon: task.icon || iconMap[task.subject] || 'book',
      group: ['required','optional','adventure'].includes(task.group) ? task.group : (index < 2 ? 'required' : 'optional'),
      title: task.title || '新的学习任务',
      description: task.description || '完成任务并写下学习记录。',
      minutes: Math.max(5, Math.min(120, Number(task.minutes || 20))),
      difficulty: Math.max(1, Math.min(3, Number(task.difficulty || 1))),
      reward: normalizeReward(task.reward || { growthStars:1, exploreCoins:8, xp:20, mapEnergy:8 }),
      status:'todo', progress:0, evidence:'', focus:task.focus || '持续学习', scheduledDate:task.scheduledDate || todayIso(), dueTime:task.dueTime || '', assignedBy:task.assignedBy || 'AI规划', evidenceRule:task.evidenceRule || '完成任务并留下学习记录。'
    };
  }

  async function generateTasks(formId) {
    const payload = formDataObject(formId);
    if (!payload) return;
    const button = document.querySelector(`[data-action="generate-tasks"][data-form="${formId}"]`);
    if (button) { button.disabled = true; button.textContent = '正在生成…'; }
    try {
      let tasks;
      try {
        const response = await window.ApiClient.generateTasks({ ...payload, childProfile: state.profile });
        tasks = (response.tasks || []).map(normalizeApiTask);
        if (!tasks.length) throw new Error('EMPTY_API_RESULT');
        showToast('已通过API生成今日任务。', 'success');
      } catch (error) {
        tasks = mockTasks(payload);
        showToast('已使用本地模板生成任务；配置API后会由模型生成。', 'warning');
      }
      state.tasks = [...tasks, ...state.tasks];
      tasks.forEach((task) => syncCalendarDate(taskDate(task)));
      state.ui.activeTaskFilter = 'required';
      saveState();
      closeModal();
      routeTo('tasks');
    } finally {
      if (button) { button.disabled = false; button.textContent = '智能生成任务'; }
    }
  }

  function mockPreview(payload) {
    const id = `preview-${Date.now()}`;
    const title = payload.title || '新的预习课题';
    const subject = payload.subject || '数学';
    return {
      id, subject, grade:payload.grade || state.profile.grade, edition:payload.edition || '自定义', title, textbookPages:'待家长核对', estimatedMinutes:25,
      goal:`先了解《${title}》的全貌，发现自己已经会什么、还想知道什么。`,
      sourceNote:'由本地模板生成，请家长或教师核对教材内容。',
      knowledgeCards:[
        {title:'本课核心概念',core:`用一句话找出《${title}》最重要的概念。`,keyword:'核心概念',pitfall:'只记结论，不理解条件。',question:'这个概念在生活中有什么例子？'},
        {title:'本课关键方法',core:'先观察例子，再用自己的话概括方法。',keyword:'观察与概括',pitfall:'照抄步骤，不解释为什么。',question:'方法中哪一步最容易出错？'},
        {title:'本课课堂问题',core:'带着一个具体问题进入课堂。',keyword:'问题意识',pitfall:'把“我不会”当成唯一问题。',question:'你最想让老师验证什么猜想？'}
      ],
      steps:[
        {id:'overview',title:'看全貌',subtitle:'我已经知道什么',instruction:`回忆和《${title}》有关的知识或生活经验。`,placeholder:'我已经知道……',icon:'book',reward:8,value:'',complete:false},
        {id:'baseline',title:'测基础',subtitle:'快速试一试',instruction:'写下自己最确定的一点和最不确定的一点。',placeholder:'我确定……我不确定……',icon:'clipboard',reward:8,value:'',complete:false},
        {id:'understand',title:'想明白',subtitle:'本课我先观察',instruction:'观察教材例子、图示或关键词，写下一条发现。',placeholder:'我观察到……',icon:'thinking',reward:10,value:'',complete:false},
        {id:'verify',title:'验理解',subtitle:'用自己的话说',instruction:'不用照抄课本，尝试解释本课核心概念。',placeholder:'我的解释是……',icon:'reading',reward:10,value:'',complete:false},
        {id:'transfer',title:'练迁移',subtitle:'动手试一试',instruction:'找一个新例子、完成一个小实验或做一道简单迁移题。',placeholder:'我的尝试是……',icon:'science',reward:12,value:'',complete:false},
        {id:'focus',title:'定重点',subtitle:'我的问题与课堂验证',instruction:'写下最重要的问题和你目前的猜想。',placeholder:'我想在课堂上验证……',icon:'preview',reward:12,value:'',complete:false}
      ],
      challenges:{recognize:{label:'认一认',question:'本课最重要的核心概念是哪一个？',options:['我能指出核心概念','我只能找到例子','我还没有找到'],answer:0,selected:null},explain:{label:'说一说',prompt:'用自己的话解释一个核心知识。',value:''},apply:{label:'用一用',prompt:'写下一个生活例子或简单应用。',value:''}},
      parentReview:{reviewed:false,note:''}, trafficLight:'pending'
    };
  }

  function normalizePreviewLesson(lesson, payload) {
    const fallback = mockPreview(payload);
    return {
      ...fallback,
      ...lesson,
      id: lesson.id || fallback.id,
      steps: Array.isArray(lesson.steps) && lesson.steps.length ? lesson.steps.map((step,index) => ({ ...fallback.steps[index % fallback.steps.length], ...step, complete:false, value:'' })) : fallback.steps,
      knowledgeCards: Array.isArray(lesson.knowledgeCards) && lesson.knowledgeCards.length ? lesson.knowledgeCards : fallback.knowledgeCards,
      challenges: { ...fallback.challenges, ...(lesson.challenges || {}) },
      parentReview:{reviewed:false,note:''}, trafficLight:'pending'
    };
  }

  async function generatePreview() {
    const payload = formDataObject('preview-generator-form');
    if (!payload) return;
    const button = document.querySelector('[data-action="generate-preview"]');
    if (button) { button.disabled = true; button.textContent = '正在生成…'; }
    try {
      let lesson;
      try {
        const response = await window.ApiClient.generatePreview({ ...payload, workflow:['看全貌','测基础','想明白','验理解','练迁移','定重点'] });
        lesson = normalizePreviewLesson(response.lesson || response, payload);
        showToast('已通过API生成新的预习单。', 'success');
      } catch (error) {
        lesson = mockPreview(payload);
        showToast('已使用本地模板生成预习单；配置API后可根据教材内容生成。', 'warning');
      }
      state.previewLessons.unshift(lesson);
      state.ui.selectedPreviewLessonId = lesson.id;
      saveState();
      closeModal();
      routeTo('preview');
    } finally {
      if (button) { button.disabled = false; button.textContent = '生成预习单'; }
    }
  }

  function applyReward(reward, title, abilities = [], source = 'task', claimId = '') {
    const normalized = normalizeReward(reward);
    state.rewardLedger = Array.isArray(state.rewardLedger) ? state.rewardLedger : [];
    if (claimId && state.rewardLedger.some((entry) => entry.claimId === claimId)) return false;
    state.wallet.growthStars += normalized.growthStars;
    state.wallet.exploreCoins += normalized.exploreCoins;
    state.wallet.chestProgress = Math.min(100, state.wallet.chestProgress + normalized.growthStars * 10 + Math.min(5, normalized.exploreCoins));
    state.profile.xp += normalized.xp;
    while (state.profile.xp >= state.profile.xpMax) {
      state.profile.xp -= state.profile.xpMax;
      state.profile.level += 1;
      state.profile.xpMax = Math.round(state.profile.xpMax * 1.15);
    }
    const badgeDeltas = {};
    (abilities || []).forEach((id) => { const result = incrementBadge(id, 1, title); if (result) badgeDeltas[id] = (badgeDeltas[id] || 0) + 1; });
    reconcileMilestones();
    addRewardLedger({ claimId, source, title, xp:normalized.xp, growthStars:normalized.growthStars, exploreCoins:normalized.exploreCoins, badgeDeltas });
    state.history.unshift({ id:`history-${Date.now()}`, date:todayIso(), type:source === 'preview' ? 'preview' : 'task', title, detail:`经验 +${normalized.xp}，成长星 +${normalized.growthStars}，探索币 +${normalized.exploreCoins}${Object.keys(badgeDeltas).length ? `；推动 ${Object.keys(badgeDeltas).length} 项能力成长` : ''}。` });
    unlockRegions();
    return true;
  }

  function unlockRegions() {
    state.mapRegions.forEach((region) => {
      if (region.unlocked) return;
      const enoughStars = state.wallet.growthStars >= Number(region.unlockAtStars || Infinity);
      const required = region.requiredBadgeId ? badgeById(region.requiredBadgeId) : null;
      const enoughAbility = !required || stageRank(badgeStage(required)) >= stageRank(region.requiredStage || 'sprout');
      if (enoughStars && enoughAbility) {
        region.unlocked = true;
        region.progress = Math.max(5, Number(region.progress || 0));
        state.wallet.mapKeys += 1;
        state.history.unshift({id:`region-${Date.now()}-${region.id}`,date:todayIso(),type:'badge',title:`解锁${region.name}`,detail:'成长星与区域能力条件均已达成。'});
        showToast(`${region.name} 已解锁。`, 'success');
      }
    });
  }

  function saveTaskProgress(complete = false, taskIdOverride = '') {
    const form = document.getElementById('task-progress-form');
    if (!form) return;
    const data = new FormData(form);
    const taskId = taskIdOverride || data.get('taskId');
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    task.progress = Number(data.get('progress') || task.progress);
    task.evidence = String(data.get('evidence') || '').trim();
    if (complete) {
      if (task.evidence.length < 2) { showToast('请先留下一句完成记录，再领取奖励。', 'warning'); return; }
      if (task.status !== 'done') {
        task.status = 'done';
        task.progress = 100;
        applyReward(task.reward, `完成${task.title}`, task.abilities || [], 'task', `task:${task.id}`);
        const region = state.mapRegions.find((item) => item.subject === task.subject || (task.subject === '语文' && item.subject === '语文'));
        if (region) region.progress = Math.min(100, region.progress + Number(task.reward.mapEnergy || 8));
      }
      showToast('任务完成：经验、探索币和能力证据已记录；成长星由有效学习证据产生。', 'success');
    } else {
      task.status = task.progress > 0 && task.progress < 100 ? 'in_progress' : task.status;
      showToast('任务进度已保存。', 'success');
    }
    syncCalendarDate(taskDate(task));
    saveState();
    closeModal();
    render();
  }

  function deleteTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    state.tasks = state.tasks.filter((item) => item.id !== taskId);
    if (task) syncCalendarDate(taskDate(task));
    saveState();
    closeModal();
    render();
    showToast('任务已删除。');
  }

  function completePreviewStep(stepId) {
    const lesson = previewLesson();
    const step = lesson.steps.find((item) => item.id === stepId);
    if (!step) return;
    if (step.complete) { showToast('本步已经完成，奖励不会重复发放。'); return; }
    const input = document.querySelector(`[data-preview-step-input="${stepId}"]`);
    step.value = input ? input.value.trim() : step.value;
    if (step.value.length < 2) { showToast('请先写下一条真实记录，再完成本步。', 'warning'); return; }
    step.complete = true;
    applyReward({xp:Number(step.reward || 5),growthStars:0,exploreCoins:2,mapEnergy:0}, `完成预习步骤：${step.title}`, [], 'preview', `preview-step:${lesson.id}:${step.id}`);
    if (lesson.steps.every((item) => item.complete) && !lesson.v2RewardGranted) {
      lesson.v2RewardGranted = true;
      applyReward({xp:20,growthStars:3,exploreCoins:20,mapEnergy:12}, `完成${lesson.title}六步预习`, ['preview-explorer','question-detective','thinking-engineer','pattern-finder','math-thinker'], 'preview', `preview-full:${lesson.id}`);
    }
    saveState();
    render();
    showToast('本步已完成，预习成果和能力证据已保存。', 'success');
  }

  function evaluatePreview() {
    const lesson = previewLesson();
    let score = 0;
    if (lesson.challenges.recognize.selected === lesson.challenges.recognize.answer) score += 1;
    if ((lesson.challenges.explain.value || '').trim().length >= 12) score += 1;
    if ((lesson.challenges.apply.value || '').trim().length >= 8) score += 1;
    lesson.trafficLight = score === 3 ? 'green' : score === 2 ? 'yellow' : 'red';
    if (score >= 2 && !lesson.challengeRewardGranted) {
      lesson.challengeRewardGranted = true;
      applyReward({xp:10,growthStars:score === 3 ? 1 : 0,exploreCoins:5,mapEnergy:3}, `完成${lesson.title}三阶挑战`, ['thinking-engineer','resourceful-learner'], 'preview', `preview-challenge:${lesson.id}`);
    }
    saveState();
    render();
    showToast(trafficText(lesson.trafficLight), lesson.trafficLight === 'green' ? 'success' : 'warning');
  }

  function formatTime(seconds) {
    const min = Math.floor(Math.max(0, seconds) / 60).toString().padStart(2,'0');
    const sec = Math.floor(Math.max(0, seconds) % 60).toString().padStart(2,'0');
    return `${min}:${sec}`;
  }

  function syncTimerFromLastTick() {
    if (!state.focusTimer.running || !state.focusTimer.lastTick) return;
    const elapsed = Math.floor((Date.now() - state.focusTimer.lastTick) / 1000);
    if (elapsed <= 0) return;
    state.focusTimer.seconds = Math.max(0, state.focusTimer.seconds - elapsed);
    state.focusTimer.lastTick = Date.now();
    if (state.focusTimer.seconds === 0) finishFocus();
    saveState();
  }

  function updateFocusTimerDom() {
    const timeNode = document.querySelector('[data-focus-time]');
    if (timeNode) timeNode.textContent = formatTime(state.focusTimer.seconds);
    const ring = document.querySelector('.focus-ring');
    if (ring) ring.style.setProperty('--focus-progress', `${Math.min(100, Math.round((900 - state.focusTimer.seconds) / 900 * 100))}%`);
  }

  function startFocusInterval() {
    clearInterval(focusInterval);
    if (!state.focusTimer.running) return;
    focusInterval = setInterval(() => {
      state.focusTimer.seconds = Math.max(0, state.focusTimer.seconds - 1);
      state.focusTimer.lastTick = Date.now();
      updateFocusTimerDom();
      if (state.focusTimer.seconds % 10 === 0) saveState();
      if (state.focusTimer.seconds === 0) finishFocus();
    }, 1000);
  }

  function finishFocus() {
    clearInterval(focusInterval);
    state.focusTimer.running = false;
    state.focusTimer.lastTick = null;
    state.focusTimer.completedCount += 1;
    state.dailyRewardCounters = state.dailyRewardCounters || {};
    const key = `${todayIso()}:focus`;
    const count = Number(state.dailyRewardCounters[key] || 0);
    if (count < 4) {
      state.dailyRewardCounters[key] = count + 1;
      applyReward({xp:10,growthStars:0,exploreCoins:5,mapEnergy:0}, '完成15分钟专注挑战', ['time-manager'], 'focus', `focus:${Date.now()}`);
      showToast('专注挑战完成：经验 +10、探索币 +5，时间小管家进度 +1。', 'success');
    } else {
      showToast('今天的专注奖励已达上限，专注记录仍已保存。', 'warning');
    }
    saveState();
    render();
  }

  function toggleFocus() {
    if (state.focusTimer.seconds === 0) state.focusTimer.seconds = 900;
    state.focusTimer.running = !state.focusTimer.running;
    state.focusTimer.lastTick = state.focusTimer.running ? Date.now() : null;
    saveState();
    render();
    startFocusInterval();
  }

  function resetFocus() {
    state.focusTimer.seconds = 900;
    state.focusTimer.running = false;
    state.focusTimer.lastTick = null;
    saveState();
    clearInterval(focusInterval);
    render();
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type:'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showRewardShop() {
    const items = state.rewardsCatalog || [];
    const body = `<div class="reward-shop-balance">${icon('coin','svg-icon')}<div><span>可用探索币</span><strong>${state.wallet.exploreCoins.toLocaleString('zh-CN')}</strong></div></div><div class="reward-shop-grid">${items.map((item) => {const owned=(state.redeemedRewards||[]).includes(item.id);const enough=state.wallet.exploreCoins>=item.cost;return `<article class="reward-shop-item ${owned?'owned':''}"><div class="reward-shop-icon">${icon(item.icon,'svg-icon')}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><strong>${item.cost} 探索币</strong><button class="btn ${owned?'btn-ghost':enough?'btn-primary':'btn-secondary'} btn-sm" type="button" data-action="redeem-reward" data-reward-id="${item.id}" ${owned||!enough?'disabled':''}>${owned?'已兑换':enough?'立即兑换':'探索币不足'}</button></article>`;}).join('')}</div><div class="challenge-item" style="margin-top:14px"><strong>家长确认</strong><p class="section-copy">探索币只用于个性化和家庭约定奖励，不兑换学习答案或跳过学习过程。</p></div>`;
    showModal(modalShell('探索币奖励商店', body, `<button class="btn btn-ghost" type="button" data-action="close-modal">关闭</button>`), true);
  }

  function redeemReward(rewardId) {
    const item = (state.rewardsCatalog || []).find((reward) => reward.id === rewardId);
    if (!item) return;
    state.redeemedRewards = state.redeemedRewards || [];
    if (state.redeemedRewards.includes(item.id)) return showToast('这个奖励已经兑换。');
    if (state.wallet.exploreCoins < item.cost) return showToast('探索币不足。', 'warning');
    state.wallet.exploreCoins -= item.cost;
    state.redeemedRewards.push(item.id);
    addRewardLedger({source:'redeem',title:`兑换：${item.name}`,xp:0,growthStars:0,exploreCoins:-item.cost,badgeDeltas:{}});
    state.history.unshift({id:`redeem-${Date.now()}`,date:todayIso(),type:'badge',title:`兑换${item.name}`,detail:`使用 ${item.cost} 枚探索币。`});
    saveState();
    showRewardShop();
    showToast('奖励兑换成功，请由家长确认使用。', 'success');
  }

  function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'nav') { closeModal(); routeTo(target.dataset.route); return; }
    if (action === 'open-profile') return openProfile();
    if (action === 'close-modal') return closeModal();
    if (action === 'close-modal-backdrop' && event.target === target) return closeModal();
    if (action === 'show-notice') return showToast('演示版暂未接入通知中心。');
    if (action === 'open-generator') return openGenerator();
    if (action === 'open-manual-task') return openManualTask();
    if (action === 'open-manual-task-date') { closeModal(); return openManualTask(target.dataset.date); }
    if (action === 'open-calendar-day') return openCalendarDay(target.dataset.date);
    if (action === 'calendar-prev') return shiftCalendarMonth(-1);
    if (action === 'calendar-next') return shiftCalendarMonth(1);
    if (action === 'save-api-settings') return saveApiSettings(true);
    if (action === 'test-api-settings') return testApiSettings();
    if (action === 'remove-avatar') { pendingAvatarDataUrl = ''; updateAvatarPreview('assets/characters/avatar-xiaoming.png'); const aiMode = document.querySelector('input[name="avatarMode"][value="ai"]'); if (aiMode) aiMode.checked = true; return; }
    if (action === 'generate-tasks') return generateTasks(target.dataset.form);
    if (action === 'open-task') return openTask(target.dataset.taskId);
    if (action === 'save-task-progress') return saveTaskProgress(false);
    if (action === 'complete-task') return saveTaskProgress(true, target.dataset.taskId);
    if (action === 'delete-task') return deleteTask(target.dataset.taskId);
    if (action === 'filter-task-group') { state.ui.activeTaskFilter = target.dataset.group; saveState(); return render(); }
    if (action === 'filter-badge-category') { state.ui.activeBadgeCategory = target.dataset.category || 'habit'; saveState(); return render(); }
    if (action === 'toggle-focus') return toggleFocus();
    if (action === 'reset-focus') return resetFocus();
    if (action === 'complete-preview-step') return completePreviewStep(target.dataset.stepId);
    if (action === 'evaluate-preview') return evaluatePreview();
    if (action === 'open-preview-generator') return openPreviewGenerator();
    if (action === 'generate-preview') return generatePreview();
    if (action === 'open-region') return openRegion(target.dataset.regionId);
    if (action === 'toggle-parent-mode') { state.ui.parentMode = !state.ui.parentMode; saveState(); return render(); }
    if (action === 'export-data') { downloadJson(`${state.profile.childName}学习冒险基地-成长数据.json`, state); return showToast('成长数据已导出。', 'success'); }
    if (action === 'export-preview') { downloadJson(`${previewLesson().title}-预习记录.json`, previewLesson()); return showToast('预习记录已导出。', 'success'); }
    if (action === 'open-reset') return showModal(modalShell('重置演示数据', '<p>这会删除当前浏览器中的任务进度、预习记录和奖励数据，并恢复为初始演示状态。</p>', '<button class="btn btn-ghost" type="button" data-action="close-modal">取消</button><button class="btn btn-danger" type="button" data-action="confirm-reset">确认重置</button>'));
    if (action === 'confirm-reset') { state = clone(window.DEFAULT_APP_STATE); saveState(); closeModal(); render(); return showToast('演示数据已重置。'); }
    if (action === 'show-rewards') return showRewardShop();
    if (action === 'redeem-reward') return redeemReward(target.dataset.rewardId);
    if (action === 'save-profile') {
      const data = formDataObject('profile-form');
      if (!data) return;
      state.profile.childName = String(data.childName || '小明').trim().slice(0,12) || '小明';
      state.profile.grade = data.grade || '四年级';
      state.profile.mascotName = String(data.mascotName || '探索龙 Dino').trim().slice(0,16) || '探索龙 Dino';
      state.profile.dailyEnergyMinutes = Math.max(15, Math.min(240, Number(data.dailyEnergyMinutes || 120)));
      if (pendingAvatarDataUrl !== null) state.profile.avatarDataUrl = pendingAvatarDataUrl;
      state.profile.avatarMode = data.avatarMode === 'uploaded' && state.profile.avatarDataUrl ? 'uploaded' : 'ai';
      pendingAvatarDataUrl = null;
      saveState(); closeModal(); render(); return showToast('孩子个人信息已保存。', 'success');
    }
    if (action === 'save-manual-task') {
      const data = formDataObject('manual-task-form');
      if (!data || !String(data.title || '').trim()) return showToast('请填写任务名称。', 'warning');
      const scheduledDate = String(data.scheduledDate || todayIso());
      const iconMap = {'数学':'math','语文':'reading','英语':'english','科学':'science','阅读':'book','思维':'thinking','预习':'preview'};
      const minutes = Math.max(5, Math.min(180, Number(data.minutes || 20)));
      const baseXp = Math.max(10, Math.round(minutes * 0.8));
      const abilities = data.primaryAbility ? [String(data.primaryAbility)] : defaultAbilitiesForTask({subject:data.subject});
      state.tasks.unshift({ id:`manual-${Date.now()}`, subject:data.subject, icon:iconMap[data.subject] || 'book', group:['required','optional','adventure'].includes(data.group) ? data.group : 'required', title:String(data.title).trim(), description:String(data.description || data.evidenceRule || '完成家庭安排的学习任务。').trim(), minutes, difficulty:1, reward:{growthStars:1,exploreCoins:Math.max(5,Math.round(minutes * .4)),xp:baseXp,mapEnergy:8}, abilities, status:'todo', progress:0, evidence:'', focus:'家庭安排', scheduledDate, dueTime:String(data.dueTime || ''), assignedBy:'家长安排', evidenceRule:String(data.evidenceRule || '完成任务并留下学习记录。').trim() });
      syncCalendarDate(scheduledDate);
      state.ui.selectedCalendarDate = scheduledDate;
      state.ui.calendarMonth = scheduledDate.slice(0,7);
      saveState(); closeModal(); render(); return showToast('任务计划已保存，并同步到学习日历。', 'success');
    }
  }

  async function handleChange(event) {
    const target = event.target;
    if (target.matches('[data-action="avatar-file"]')) {
      const file = target.files && target.files[0];
      if (!file) return;
      try {
        pendingAvatarDataUrl = await resizeAvatarFile(file);
        updateAvatarPreview(pendingAvatarDataUrl);
        const uploadedMode = document.querySelector('input[name="avatarMode"][value="uploaded"]');
        if (uploadedMode) uploadedMode.checked = true;
        showToast('头像已处理，点击保存后生效。', 'success');
      } catch (error) { showToast(error.message || '头像处理失败。', 'warning'); }
      return;
    }
    if (target.matches('input[name="avatarMode"]')) {
      const source = target.value === 'uploaded' ? (pendingAvatarDataUrl || state.profile.avatarDataUrl) : 'assets/characters/avatar-xiaoming.png';
      updateAvatarPreview(source || 'assets/characters/avatar-xiaoming.png');
      return;
    }
    if (target.matches('[data-action="filter-subject"]')) {
      state.ui.selectedSubject = target.value;
      saveState();
      render();
      return;
    }
    if (target.matches('[data-action="preview-recognize"]')) {
      previewLesson().challenges.recognize.selected = Number(target.value);
      saveState();
      return;
    }
    if (target.matches('[data-action="parent-reviewed"]')) {
      previewLesson().parentReview.reviewed = target.checked;
      saveState();
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches('[data-preview-step-input]')) {
      const step = previewLesson().steps.find((item) => item.id === target.dataset.previewStepInput);
      if (step) { step.value = target.value; saveState(); }
      return;
    }
    if (target.matches('[data-preview-challenge]')) {
      const key = target.dataset.previewChallenge;
      if (previewLesson().challenges[key]) { previewLesson().challenges[key].value = target.value; saveState(); }
      return;
    }
    if (target.matches('[data-parent-review-note]')) {
      previewLesson().parentReview.note = target.value;
      saveState();
    }
  }

  document.addEventListener('sixstep-progress', (event) => {
    const detail = event.detail || {};
    const wasFinished = Boolean(state.previewSkill?.finished);
    state.previewSkill = { ...state.previewSkill, ...detail };
    if (detail.finished && !wasFinished && !state.previewSkill.rewardGranted) {
      state.previewSkill.rewardGranted = true;
      applyReward({xp:40,growthStars:3,exploreCoins:20,mapEnergy:12}, '完成分数意义六步预习', ['preview-explorer','question-detective','thinking-engineer','pattern-finder','math-thinker'], 'preview', `preview-skill:${detail.unitId || 'unit'}`);
      showToast('六步预习完成：推动5项能力成长，并获得成长奖励。', 'success');
    }
    saveState();
  });

  window.addEventListener('hashchange', render);
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('input', handleInput);

  syncTimerFromLastTick();
  render();
  startFocusInterval();
})();
