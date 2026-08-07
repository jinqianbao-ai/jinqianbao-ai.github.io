const API_BASE = 'https://jinqianbao-forum-api.jinqianbao-forum-worker.workers.dev';
const SESSION_KEY = 'jinqianbao_forum_session';
const COMPOSER_SECTION_OPTIONS = [
  ['share', '分享交流'],
  ['qa', '问答求助'],
  ['polls', '投票调查'],
  ['general', '综合讨论'],
];
const COMPOSER_SECTIONS = new Set(COMPOSER_SECTION_OPTIONS.map(([key]) => key));
const REPO = 'jinqianbao-ai/jinqianbao-ai.github.io';
const REPO_ID = 'R_kgDOTwz2XA';
const CATEGORY_IDS = {
  daily: ['Announcements', 'DIC_kwDOTwz2XM4DC2H3'],
  share: ['Show and tell', 'DIC_kwDOTwz2XM4DC2H7'],
  qa: ['Q&A', 'DIC_kwDOTwz2XM4DC2H5'],
  annotations: ['Ideas', 'DIC_kwDOTwz2XM4DC2H6'],
  polls: ['Polls', 'DIC_kwDOTwz2XM4DC2H8'],
  general: ['General', 'DIC_kwDOTwz2XM4DC2H4'],
};

const state = { data: null, query: '', session: localStorage.getItem(SESSION_KEY) || '', user: null, authConfigured: null, authError: '', activeTopic: null, composeHandled: false };
const sectionNav = document.getElementById('section-nav');
const forumTitle = document.getElementById('forum-title');
const forumDescription = document.getElementById('forum-description');
const topicList = document.getElementById('topic-list');
const topicView = document.getElementById('topic-view');
const listView = document.getElementById('list-view');
const topicTitle = document.getElementById('topic-title');
const topicMeta = document.getElementById('topic-meta');
const topicBody = document.getElementById('topic-body');
const topicSectionName = document.getElementById('topic-section-name');
const topicComments = document.getElementById('topic-comments');
const boardComments = document.getElementById('board-comments');
const boardHeading = document.getElementById('board-heading');
const topicBack = document.getElementById('topic-back');
const forumSearch = document.getElementById('forum-search');
const topicTotal = document.getElementById('topic-total');
const replyTotal = document.getElementById('reply-total');
const dashboardView = document.getElementById('dashboard-view');
const sectionDirectory = document.getElementById('section-directory');
const recentTopicList = document.getElementById('recent-topic-list');
const recentTitle = document.getElementById('recent-title');
const recentDescription = document.getElementById('recent-description');
const mastheadAction = document.getElementById('masthead-action');
const authStatus = document.getElementById('auth-status');
const authButton = document.getElementById('auth-button');
const createTopicButton = document.getElementById('create-topic-button');
const shareSystem = document.getElementById('share-system');
const shareCopy = document.getElementById('share-copy');
const shareForum = document.getElementById('share-forum');
const shareStatus = document.getElementById('share-status');
const composeLink = document.querySelector('.compose-link');
const giscusCleanup = new WeakMap();

function params() {
  const p = new URLSearchParams(location.search);
  return {
    section: p.get('section'),
    topic: Number(p.get('topic') || 0),
    compose: p.get('compose'),
    composeTitle: p.get('title') || '',
    composeUrl: p.get('url') || '',
  };
}

function consumeSessionFromHash() {
  if (!location.hash) return;
  const hashParams = new URLSearchParams(location.hash.slice(1));
  const session = hashParams.get('forum_session');
  if (!session) return;
  state.session = session;
  localStorage.setItem(SESSION_KEY, session);
  hashParams.delete('forum_session');
  const nextHash = hashParams.toString();
  history.replaceState({}, '', `${location.pathname}${location.search}${nextHash ? `#${nextHash}` : ''}`);
}

function currentReturnUrl() {
  const url = new URL(location.href);
  const hashParams = new URLSearchParams(url.hash.slice(1));
  hashParams.delete('forum_session');
  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : '';
  return url.href;
}

function updateLoginHref() {
  if (!state.authConfigured) {
    authButton.href = '#login';
    return;
  }
  authButton.href = `${API_BASE}/auth/github?return=${encodeURIComponent(currentReturnUrl())}`;
}

function renderAuthStatus(message) {
  updateLoginHref();
  if (state.authConfigured === false) {
    authStatus.textContent = state.authError || '登录服务配置中';
    authButton.textContent = state.authError ? '登录服务暂不可用' : '登录服务配置中';
    authButton.setAttribute('aria-disabled', 'true');
    authButton.removeAttribute('href');
    return;
  }
  authButton.removeAttribute('aria-disabled');
  if (state.user) {
    const name = state.user.name || state.user.login || '已登录用户';
    authStatus.textContent = `已登录：${name}`;
    authButton.textContent = '切换账号';
    authButton.hidden = false;
    return;
  }
  authStatus.textContent = message || (state.session ? '正在确认登录状态…' : '未登录');
  authButton.textContent = state.authConfigured === null ? '正在检查…' : '登录';
  authButton.hidden = false;
}

async function loadCurrentUser() {
  consumeSessionFromHash();
  renderAuthStatus();
  try {
    const authResponse = await fetch(`${API_BASE}/auth/status`, { cache: 'no-store' });
    if (!authResponse.ok) throw new Error(`登录服务状态读取失败（${authResponse.status}）`);
    const authData = await authResponse.json();
    state.authConfigured = Boolean(
      authData.configured
      ?? authData.enabled
      ?? authData.githubConfigured
      ?? authData.oauthConfigured
      ?? authData.github?.configured
      ?? false
    );
    state.authError = '';
    renderAuthStatus();
    if (!state.authConfigured || !state.session) return;
    const response = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${state.session}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`登录状态验证失败（${response.status}）`);
    const data = await response.json();
    state.user = data.user || data;
    renderAuthStatus();
  } catch (error) {
    if (state.authConfigured === null) {
      state.authConfigured = false;
      state.authError = error.message || '登录服务暂时不可用';
      renderAuthStatus();
      return;
    }
    state.user = null;
    state.session = '';
    localStorage.removeItem(SESSION_KEY);
    renderAuthStatus(error.message || '登录状态已失效，请重新登录');
  }
}

function sectionByKey(key) {
  return state.data.sections.find((item) => item.key === key) || state.data.sections[0];
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function clearGiscus(host) {
  const cleanup = giscusCleanup.get(host);
  if (cleanup) cleanup();
  giscusCleanup.delete(host);
  host.replaceChildren();
}

function showGiscusError(host, section, number) {
  clearGiscus(host);
  const error = document.createElement('div');
  error.className = 'comment-error';
  const content = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = '评论暂时无法加载';
  const detail = document.createElement('p');
  detail.textContent = '请检查网络后重试，正文内容不受影响。';
  const retry = document.createElement('button');
  retry.className = 'comment-retry';
  retry.type = 'button';
  retry.textContent = '重新加载评论';
  retry.addEventListener('click', () => loadGiscus(host, section, number));
  content.append(title, detail, retry);
  error.appendChild(content);
  host.appendChild(error);
}

function loadGiscus(host, section, number) {
  clearGiscus(boardComments);
  clearGiscus(topicComments);
  const loading = document.createElement('div');
  loading.className = 'comment-loading';
  loading.textContent = '正在加载评论…';
  host.appendChild(loading);
  const [category, categoryId] = CATEGORY_IDS[section.key];
  const script = document.createElement('script');
  const attrs = {
    src: 'https://giscus.app/client.js',
    'data-repo': REPO,
    'data-repo-id': REPO_ID,
    'data-category': category,
    'data-category-id': categoryId,
    'data-mapping': 'number',
    'data-term': String(number),
    'data-strict': '0',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'top',
    'data-theme': 'preferred_color_scheme',
    'data-lang': 'zh-CN',
    'data-loading': 'lazy',
    crossorigin: 'anonymous',
  };
  Object.entries(attrs).forEach(([key, value]) => script.setAttribute(key, value));
  script.async = true;
  let finished = false;
  let timer;
  const observer = new MutationObserver(() => {
    if (!host.querySelector('iframe.giscus-frame')) return;
    finished = true;
    loading.remove();
    clearTimeout(timer);
    observer.disconnect();
    giscusCleanup.delete(host);
  });
  const cleanup = () => {
    clearTimeout(timer);
    observer.disconnect();
  };
  giscusCleanup.set(host, cleanup);
  observer.observe(host, { childList: true, subtree: true });
  script.addEventListener('error', () => {
    if (finished) return;
    finished = true;
    cleanup();
    showGiscusError(host, section, number);
  }, { once: true });
  timer = setTimeout(() => {
    if (finished || host.querySelector('iframe.giscus-frame')) return;
    finished = true;
    cleanup();
    showGiscusError(host, section, number);
  }, 12000);
  host.appendChild(script);
}

function topicCounts() {
  return Object.fromEntries(state.data.sections.map((section) => [section.key, state.data.topics.filter((topic) => topic.section === section.key).length]));
}

function renderNav(activeKey) {
  sectionNav.replaceChildren();
  const counts = topicCounts();
  for (const section of state.data.sections) {
    const link = document.createElement('a');
    link.href = `forum.html?section=${section.key}`;
    link.dataset.section = section.key;
    link.className = section.key === activeKey ? 'active' : '';
    if (section.key === activeKey) link.setAttribute('aria-current', 'page');
    const text = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = section.name;
    const description = document.createElement('small');
    description.textContent = section.description;
    const count = document.createElement('span');
    count.className = 'section-count';
    count.textContent = String(counts[section.key] || 0);
    text.append(name, description);
    link.append(text, count);
    sectionNav.appendChild(link);
  }
}

function topicDisplayTitle(topic) {
  if (topic.section !== 'annotations') return topic.title;
  const parts = topic.title.split('｜');
  return parts.length >= 3 ? `批注：“${parts[2]}”` : topic.title;
}

function authorInitial(author) {
  const text = displayAuthor(author);
  return /[\u3400-\u9fff]/.test(text) ? text.slice(0, 1) : text.slice(0, 2).toUpperCase();
}

function displayAuthor(author) {
  if (author === 'nguyminhdung519-web') return '金钱豹AI编辑部';
  return String(author || '社区成员').trim();
}

function createMeta(values, className = 'topic-meta') {
  const meta = document.createElement('div');
  meta.className = className;
  values.filter(Boolean).forEach((value) => {
    const span = document.createElement('span');
    span.textContent = value;
    meta.appendChild(span);
  });
  return meta;
}

const composer = createComposer();

function appendLabeledControl(parent, labelText, control, hintText) {
  const label = document.createElement('label');
  label.className = 'composer-field';
  const text = document.createElement('span');
  text.textContent = labelText;
  label.append(text, control);
  if (hintText) {
    const hint = document.createElement('small');
    hint.textContent = hintText;
    label.appendChild(hint);
  }
  parent.appendChild(label);
}

function createComposer() {
  const dialog = document.createElement('dialog');
  dialog.id = 'composer-dialog';
  dialog.className = 'composer-dialog';
  const form = document.createElement('form');
  form.className = 'composer-form';
  form.method = 'dialog';

  const head = document.createElement('div');
  head.className = 'composer-head';
  const headCopy = document.createElement('div');
  const heading = document.createElement('h2');
  heading.id = 'composer-heading';
  heading.textContent = '发起讨论';
  const lead = document.createElement('p');
  lead.textContent = '内容会发布到论坛站内主题，评论仍在当前页面继续。';
  headCopy.append(heading, lead);
  const cancelTop = document.createElement('button');
  cancelTop.type = 'button';
  cancelTop.className = 'composer-cancel';
  cancelTop.textContent = '关闭';
  head.append(headCopy, cancelTop);

  const grid = document.createElement('div');
  grid.className = 'composer-grid';
  const type = document.createElement('select');
  type.id = 'composer-type';
  [['post', '普通帖子'], ['article', '长文章']].forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    type.appendChild(option);
  });
  const section = document.createElement('select');
  section.id = 'composer-section';
  appendLabeledControl(grid, '内容类型', type);
  appendLabeledControl(grid, '版块', section);

  const title = document.createElement('input');
  title.id = 'composer-title';
  title.required = true;
  title.maxLength = 120;
  title.placeholder = '用一句话说明主题';
  appendLabeledControl(form, '标题', title);

  const body = document.createElement('textarea');
  body.id = 'composer-body';
  body.required = true;
  body.placeholder = '写下背景、链接、步骤或你的观点。';
  appendLabeledControl(form, '正文', body, '普通帖子建议提供必要背景和可复现信息。');
  const bodyHint = form.querySelector('.composer-field small');
  bodyHint.id = 'composer-body-hint';

  const status = document.createElement('div');
  status.id = 'composer-status';
  status.className = 'composer-status';
  status.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  actions.className = 'composer-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'composer-cancel';
  cancel.textContent = '取消';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.id = 'composer-submit';
  submit.className = 'composer-submit';
  submit.textContent = '发布';
  actions.append(cancel, submit);

  form.prepend(head, grid);
  form.append(status, actions);
  dialog.appendChild(form);
  document.body.appendChild(dialog);

  const close = () => dialog.close();
  cancel.addEventListener('click', close);
  cancelTop.addEventListener('click', close);
  type.addEventListener('change', () => updateComposerHint());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitComposer();
  });
  return { dialog, form, heading, type, section, title, body, bodyHint, status, submit };
}

function updateComposerSections() {
  const current = composer.section.value;
  composer.section.replaceChildren();
  const options = state.data
    ? state.data.sections.filter((section) => COMPOSER_SECTIONS.has(section.key)).map((section) => [section.key, section.name])
    : COMPOSER_SECTION_OPTIONS;
  for (const [key, name] of options) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = name;
    composer.section.appendChild(option);
  }
  if (current && COMPOSER_SECTIONS.has(current)) composer.section.value = current;
}

function updateComposerHint() {
  if (composer.type.value === 'article') {
    composer.body.placeholder = '适合长文章：先写摘要，再展开背景、步骤、案例、结论和参考链接。';
    composer.bodyHint.textContent = '长文章可以写得更完整：建议包含小标题、来源和可执行步骤。';
    return;
  }
  composer.body.placeholder = '写下背景、链接、步骤或你的观点。';
  composer.bodyHint.textContent = '普通帖子建议提供必要背景和可复现信息。';
}

function openComposer({ section = 'general', title = '', body = '', type = 'post', mode = 'compose' } = {}) {
  updateComposerSections();
  composer.heading.textContent = mode === 'share' ? '分享到论坛' : '发起讨论';
  composer.type.value = type;
  composer.section.value = COMPOSER_SECTIONS.has(section) ? section : 'general';
  composer.title.value = title;
  composer.body.value = body;
  composer.status.textContent = '';
  composer.status.className = 'composer-status';
  composer.submit.disabled = false;
  updateComposerHint();
  if (typeof composer.dialog.showModal === 'function') composer.dialog.showModal();
  else composer.dialog.setAttribute('open', '');
  composer.title.focus();
}

function showComposerError(message) {
  composer.status.textContent = message;
  composer.status.className = 'composer-status error';
  renderAuthStatus();
}

function normalizeTopic(topic) {
  const section = topic.section || composer.section.value || 'general';
  const number = Number(topic.number || topic.id || Date.now());
  return {
    number,
    title: String(topic.title || composer.title.value || '未命名主题'),
    body: String(topic.body || composer.body.value || ''),
    bodyMarkdown: topic.bodyMarkdown || topic.body || composer.body.value || '',
    section,
    author: topic.author || state.user?.login || state.user?.name || '社区成员',
    comments: Number(topic.comments || 0),
    upvotes: Number(topic.upvotes || 0),
    updatedAt: topic.updatedAt || new Date().toISOString(),
    internalUrl: topic.internalUrl || `forum.html?section=${section}&topic=${number}`,
  };
}

async function apiErrorMessage(response, fallback) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data.error || data.message || `${fallback}（${response.status}）`;
    }
    const text = (await response.text()).trim();
    return text || `${fallback}（${response.status}）`;
  } catch (error) {
    return `${fallback}（${response.status}）`;
  }
}

async function submitComposer() {
  const title = composer.title.value.trim();
  const body = composer.body.value.trim();
  const section = composer.section.value;
  if (!title || !body) {
    showComposerError('请填写标题和正文后再发布。');
    return;
  }
  if (!state.session) {
    showComposerError('请先登录论坛后再发布，未登录不会创建主题。');
    return;
  }
  composer.submit.disabled = true;
  composer.status.textContent = '正在发布…';
  composer.status.className = 'composer-status';
  try {
    const response = await fetch(`${API_BASE}/api/topics`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.session}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ section, title, body }),
    });
    if (response.status === 401 || response.status === 403) throw new Error('请重新登录后再发布。');
    if (!response.ok) throw new Error(await apiErrorMessage(response, '发布失败，请稍后重试'));
    const data = await response.json();
    const topic = normalizeTopic(data.topic || data);
    state.data.topics = state.data.topics.filter((item) => item.number !== topic.number);
    state.data.topics.unshift(topic);
    composer.dialog.close();
    renderNav(topic.section);
    renderStats();
    navigate(topic.internalUrl);
  } catch (error) {
    composer.submit.disabled = false;
    showComposerError(error.message || '发布失败，请稍后重试。');
  }
}

function appendInlineLinks(parent, text) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    const link = document.createElement('a');
    link.href = match[2] || match[3];
    link.textContent = match[1] || match[3];
    link.className = 'archive-link';
    parent.appendChild(link);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parent.appendChild(document.createTextNode(text.slice(cursor)));
}

function renderTopicBody(markdown, fallback) {
  topicBody.replaceChildren();
  const source = String(markdown || fallback || '').replace(/\r\n?/g, '\n');
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const heading = document.createElement('h2');
      appendInlineLinks(heading, headingMatch[1]);
      topicBody.appendChild(heading);
      continue;
    }
    const paragraph = document.createElement('p');
    const boldMatch = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (boldMatch) {
      const strong = document.createElement('strong');
      strong.textContent = boldMatch[1];
      paragraph.appendChild(strong);
      if (boldMatch[2]) {
        paragraph.appendChild(document.createTextNode(' '));
        appendInlineLinks(paragraph, boldMatch[2]);
      }
    } else {
      appendInlineLinks(paragraph, line.replace(/\*\*/g, ''));
    }
    topicBody.appendChild(paragraph);
  }
}

function createTopicRow(topic, section) {
  const link = document.createElement('a');
  link.href = topic.internalUrl;
  link.dataset.topic = String(topic.number);
  link.className = 'topic-row';

  const avatar = document.createElement('span');
  avatar.className = 'topic-avatar';
  avatar.textContent = authorInitial(topic.author);
  avatar.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('div');
  copy.className = 'topic-copy';
  const title = document.createElement('h3');
  title.textContent = topicDisplayTitle(topic);
  const excerpt = document.createElement('p');
  excerpt.textContent = topic.body.slice(0, 170) || '打开主题查看正文和讨论。';
  const meta = createMeta([displayAuthor(topic.author), formatDate(topic.updatedAt), section.name]);
  copy.append(title, excerpt, meta);

  const replies = document.createElement('span');
  replies.className = 'reply-count';
  const replyNumber = document.createElement('strong');
  replyNumber.textContent = String(topic.comments || 0);
  const replyLabel = document.createElement('span');
  replyLabel.textContent = '回复';
  replies.append(replyNumber, replyLabel);

  link.append(avatar, copy, replies);
  return link;
}

function renderStats() {
  topicTotal.textContent = String(state.data.topics.length);
  replyTotal.textContent = String(state.data.topics.reduce((sum, topic) => sum + Number(topic.comments || 0), 0));
}

function renderDashboard() {
  dashboardView.hidden = false;
  state.activeTopic = null;
  listView.hidden = true;
  topicView.hidden = true;
  topicView.dataset.open = 'false';
  mastheadAction.href = 'forum.html?section=general#board';
  document.title = '金钱豹AI论坛';
  clearGiscus(boardComments);
  clearGiscus(topicComments);

  sectionDirectory.replaceChildren();
  for (const section of state.data.sections) {
    const sectionTopics = state.data.topics.filter((topic) => topic.section === section.key);
    const latest = [...sectionTopics].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
    const link = document.createElement('a');
    link.className = 'section-entry';
    link.href = `forum.html?section=${section.key}`;
    link.dataset.dashboardSection = section.key;
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = section.name;
    const description = document.createElement('p');
    description.textContent = section.description;
    const latestText = document.createElement('span');
    latestText.className = 'section-latest';
    latestText.textContent = latest ? `最新：${topicDisplayTitle(latest)}` : '暂时还没有主题';
    copy.append(title, description, latestText);
    const count = document.createElement('span');
    count.className = 'section-entry-count';
    const value = document.createElement('strong');
    value.textContent = String(sectionTopics.length);
    const label = document.createElement('span');
    label.textContent = '主题';
    count.append(value, label);
    link.append(copy, count);
    sectionDirectory.appendChild(link);
  }

  const needle = state.query.toLocaleLowerCase('zh-CN');
  const topics = [...state.data.topics]
    .filter((topic) => !needle || `${topic.title}\n${topic.body}\n${topic.author}`.toLocaleLowerCase('zh-CN').includes(needle))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  recentTitle.textContent = state.query ? '全论坛搜索结果' : '最新主题';
  recentDescription.textContent = state.query ? `正在搜索“${state.query}”` : '来自论坛各版块的最近更新';
  recentTopicList.replaceChildren();
  if (!topics.length) {
    const empty = document.createElement('div');
    empty.className = 'dashboard-empty search-empty';
    empty.textContent = '没有找到匹配主题，请换一个关键词。';
    recentTopicList.appendChild(empty);
  } else {
    topics.slice(0, 8).forEach((topic) => recentTopicList.appendChild(createTopicRow(topic, sectionByKey(topic.section))));
  }
}

function renderList(section) {
  dashboardView.hidden = true;
  state.activeTopic = null;
  topicView.dataset.open = 'false';
  topicView.hidden = true;
  listView.hidden = false;
  mastheadAction.href = '#board';
  forumTitle.textContent = section.name;
  forumDescription.textContent = section.description;
  document.title = `${section.name} - 金钱豹AI论坛`;
  topicList.replaceChildren();

  const needle = state.query.toLocaleLowerCase('zh-CN');
  const sectionTopics = state.data.topics.filter((item) => item.section === section.key);
  const topics = sectionTopics.filter((topic) => {
    if (!needle) return true;
    return `${topic.title}\n${topic.body}\n${topic.author}`.toLocaleLowerCase('zh-CN').includes(needle);
  });

  if (!topics.length) {
    const empty = document.createElement('div');
    empty.className = state.query ? 'search-empty' : 'empty';
    const heading = document.createElement('strong');
    heading.textContent = state.query ? '没有找到匹配主题' : '这个版块还没有主题';
    const detail = document.createElement('span');
    detail.textContent = state.query ? '换一个关键词，或清除搜索后查看全部内容。' : '可以在下方发表第一条内容。';
    empty.append(heading, detail);
    topicList.appendChild(empty);
  } else {
    topics.forEach((topic) => topicList.appendChild(createTopicRow(topic, section)));
  }

  boardHeading.textContent = `在“${section.name}”版块发言`;
  loadGiscus(boardComments, section, section.boardTopic);
}

function renderTopic(section, number) {
  const topic = state.data.topics.find((item) => item.number === number);
  if (!topic) {
    history.replaceState({}, '', `forum.html?section=${section.key}`);
    renderList(section);
    return;
  }
  const topicSection = sectionByKey(topic.section);
  state.activeTopic = topic;
  dashboardView.hidden = true;
  listView.hidden = true;
  topicView.hidden = false;
  topicView.dataset.open = 'true';
  topicTitle.textContent = topicDisplayTitle(topic);
  topicSectionName.textContent = topicSection.name;
  topicMeta.replaceChildren(...createMeta([
    displayAuthor(topic.author),
    formatDate(topic.updatedAt),
    `${topic.comments || 0} 条回复`,
    `${topic.upvotes || 0} 赞`,
  ], 'topic-detail-meta').childNodes);
  renderTopicBody(topic.bodyMarkdown, topic.body);
  topicBack.dataset.section = topic.section;
  document.title = `${topicDisplayTitle(topic)} - 金钱豹AI论坛`;
  loadGiscus(topicComments, topicSection, topic.number);
  scrollTo({ top: 0, behavior: 'instant' });
}

function render() {
  const route = params();
  if (!route.section) {
    renderNav(null);
    renderDashboard();
    return;
  }
  const section = sectionByKey(route.section);
  renderNav(section.key);
  if (route.topic) renderTopic(section, route.topic);
  else renderList(section);
}

function navigate(href) {
  history.pushState({}, '', href);
  state.query = '';
  forumSearch.value = '';
  updateLoginHref();
  render();
  if (location.hash === '#board') {
    requestAnimationFrame(() => document.getElementById('board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

function routeSectionKey() {
  const route = params();
  return route.section || 'general';
}

function openRouteComposer() {
  const section = routeSectionKey();
  openComposer({ section: COMPOSER_SECTIONS.has(section) ? section : 'general' });
}

function openRequestedComposer() {
  if (state.composeHandled) return;
  const route = params();
  if (route.compose !== 'share') return;
  state.composeHandled = true;
  openComposer({
    section: 'share',
    title: route.composeTitle,
    body: route.composeUrl ? `分享链接：\n${route.composeUrl}\n\n推荐理由：` : '',
    mode: 'share',
  });
}

function topicSharePayload() {
  const topic = state.activeTopic;
  return {
    title: topic ? topicDisplayTitle(topic) : document.title,
    text: topic ? `${topicDisplayTitle(topic)} - 金钱豹AI论坛` : '金钱豹AI论坛',
    url: location.href,
  };
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

shareSystem.addEventListener('click', async () => {
  const payload = topicSharePayload();
  shareStatus.textContent = '';
  try {
    if (navigator.share) {
      await navigator.share(payload);
      shareStatus.textContent = '已打开系统分享';
      return;
    }
    await copyText(payload.url);
    shareStatus.textContent = '已复制链接';
  } catch (error) {
    try {
      await copyText(payload.url);
      shareStatus.textContent = '系统分享不可用，已复制链接';
    } catch (copyError) {
      shareStatus.textContent = '分享失败，请手动复制地址栏链接';
    }
  }
});

shareCopy.addEventListener('click', async () => {
  try {
    await copyText(location.href);
    shareStatus.textContent = '链接已复制';
  } catch (error) {
    shareStatus.textContent = '复制失败，请手动复制地址栏链接';
  }
});

shareForum.addEventListener('click', () => {
  const payload = topicSharePayload();
  openComposer({
    section: 'share',
    title: payload.title,
    body: `分享一个论坛主题：\n${payload.url}\n\n推荐理由：`,
    mode: 'share',
  });
});

mastheadAction.addEventListener('click', (event) => {
  event.preventDefault();
  openRouteComposer();
});

composeLink.addEventListener('click', (event) => {
  event.preventDefault();
  openRouteComposer();
});

createTopicButton.addEventListener('click', openRouteComposer);
authButton.addEventListener('click', (event) => {
  if (state.authConfigured) return;
  event.preventDefault();
});

document.addEventListener('click', (event) => {
  if (event.defaultPrevented) return;
  const link = event.target.closest('a[href="forum.html"], a[href^="forum.html?"]');
  if (!link) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});
topicBack.addEventListener('click', () => navigate(`forum.html?section=${topicBack.dataset.section || 'daily'}`));
window.addEventListener('popstate', () => {
  updateLoginHref();
  render();
});
forumSearch.addEventListener('input', () => {
  state.query = forumSearch.value.trim();
  const route = params();
  if (route.topic) history.replaceState({}, '', `forum.html?section=${route.section}`);
  if (route.section) renderList(sectionByKey(route.section));
  else renderDashboard();
});

loadCurrentUser();

fetch('forum-data.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`forum-data ${response.status}`);
    return response.json();
  })
  .then((data) => {
    state.data = data;
    updateComposerSections();
    renderStats();
    render();
    openRequestedComposer();
  })
  .catch(() => {
    topicList.replaceChildren();
    const error = document.createElement('div');
    error.className = 'error-state';
    const heading = document.createElement('strong');
    heading.textContent = '论坛暂时无法加载';
    const detail = document.createElement('span');
    detail.textContent = '请检查网络后刷新页面。';
    error.append(heading, detail);
    topicList.appendChild(error);
    forumTitle.textContent = '加载失败';
    forumDescription.textContent = '稍后再试';
  });
