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

const state = { data: null, query: '' };
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
const giscusCleanup = new WeakMap();

function params() {
  const p = new URLSearchParams(location.search);
  return { section: p.get('section') || 'daily', topic: Number(p.get('topic') || 0) };
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

function renderList(section) {
  topicView.dataset.open = 'false';
  topicView.hidden = true;
  listView.hidden = false;
  forumTitle.textContent = section.name;
  forumDescription.textContent = section.description;
  document.title = `${section.name} - 金钱豹AI社区`;
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
  topicBody.textContent = topic.body;
  topicBack.dataset.section = topic.section;
  document.title = `${topicDisplayTitle(topic)} - 金钱豹AI社区`;
  loadGiscus(topicComments, topicSection, topic.number);
  scrollTo({ top: 0, behavior: 'instant' });
}

function render() {
  const route = params();
  const section = sectionByKey(route.section);
  renderNav(section.key);
  if (route.topic) renderTopic(section, route.topic);
  else renderList(section);
}

function navigate(href) {
  history.pushState({}, '', href);
  state.query = '';
  forumSearch.value = '';
  render();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="forum.html?"]');
  if (!link) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});
topicBack.addEventListener('click', () => navigate(`forum.html?section=${topicBack.dataset.section || 'daily'}`));
window.addEventListener('popstate', render);
forumSearch.addEventListener('input', () => {
  state.query = forumSearch.value.trim();
  const route = params();
  if (route.topic) history.replaceState({}, '', `forum.html?section=${route.section}`);
  renderList(sectionByKey(route.section));
});

fetch('forum-data.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`forum-data ${response.status}`);
    return response.json();
  })
  .then((data) => {
    state.data = data;
    renderStats();
    render();
  })
  .catch(() => {
    topicList.replaceChildren();
    const error = document.createElement('div');
    error.className = 'error-state';
    const heading = document.createElement('strong');
    heading.textContent = '社区暂时无法加载';
    const detail = document.createElement('span');
    detail.textContent = '请检查网络后刷新页面。';
    error.append(heading, detail);
    topicList.appendChild(error);
    forumTitle.textContent = '加载失败';
    forumDescription.textContent = '稍后再试';
  });
