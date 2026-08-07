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

const state = { data: null };
const sectionNav = document.getElementById('section-nav');
const forumTitle = document.getElementById('forum-title');
const forumDescription = document.getElementById('forum-description');
const topicList = document.getElementById('topic-list');
const topicView = document.getElementById('topic-view');
const listView = document.getElementById('list-view');
const topicTitle = document.getElementById('topic-title');
const topicMeta = document.getElementById('topic-meta');
const topicBody = document.getElementById('topic-body');
const topicComments = document.getElementById('topic-comments');
const boardComments = document.getElementById('board-comments');
const boardHeading = document.getElementById('board-heading');
const topicBack = document.getElementById('topic-back');

function params() {
  const p = new URLSearchParams(location.search);
  return { section: p.get('section') || 'daily', topic: Number(p.get('topic') || 0) };
}

function sectionByKey(key) {
  return state.data.sections.find((item) => item.key === key) || state.data.sections[0];
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function clearGiscus(host) {
  host.replaceChildren();
}

function loadGiscus(host, section, number) {
  clearGiscus(boardComments);
  clearGiscus(topicComments);
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
  host.appendChild(script);
}

function renderNav(activeKey) {
  sectionNav.replaceChildren();
  for (const section of state.data.sections) {
    const link = document.createElement('a');
    link.href = `forum.html?section=${section.key}`;
    link.dataset.section = section.key;
    link.className = section.key === activeKey ? 'active' : '';
    const name = document.createElement('b');
    name.textContent = section.name;
    const description = document.createElement('small');
    description.textContent = section.description;
    link.append(name, description);
    sectionNav.appendChild(link);
  }
}

function topicDisplayTitle(topic) {
  if (topic.section !== 'annotations') return topic.title;
  const parts = topic.title.split('｜');
  return parts.length >= 3 ? `批注：“${parts[2]}”` : topic.title;
}

function renderList(section) {
  topicView.dataset.open = 'false';
  topicView.hidden = true;
  listView.hidden = false;
  forumTitle.textContent = section.name;
  forumDescription.textContent = section.description;
  topicList.replaceChildren();
  const topics = state.data.topics.filter((item) => item.section === section.key);
  if (!topics.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '这个版块还没有内容，可以在下方发表第一条留言。';
    topicList.appendChild(empty);
  }
  for (const topic of topics) {
    const link = document.createElement('a');
    link.href = topic.internalUrl;
    link.dataset.topic = String(topic.number);
    link.className = 'topic-card';
    const title = document.createElement('h2');
    title.textContent = topicDisplayTitle(topic);
    const excerpt = document.createElement('p');
    excerpt.textContent = topic.body.slice(0, 150) || '打开查看主题内容与评论。';
    const meta = document.createElement('div');
    meta.className = 'topic-card-meta';
    meta.textContent = `${topic.author} · ${formatDate(topic.updatedAt)} · ${topic.comments} 条回复 · ${topic.upvotes} 赞`;
    link.append(title, excerpt, meta);
    topicList.appendChild(link);
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
  listView.hidden = true;
  topicView.hidden = false;
  topicView.dataset.open = 'true';
  topicTitle.textContent = topicDisplayTitle(topic);
  topicMeta.textContent = `${topic.category} · ${topic.author} · ${formatDate(topic.updatedAt)} · ${topic.comments} 条回复 · ${topic.upvotes} 赞`;
  topicBody.textContent = topic.body;
  topicBack.dataset.section = topic.section;
  loadGiscus(topicComments, sectionByKey(topic.section), topic.number);
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

fetch('forum-data.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`forum-data ${response.status}`);
    return response.json();
  })
  .then((data) => { state.data = data; render(); })
  .catch(() => {
    forumTitle.textContent = '暂时无法加载论坛';
    forumDescription.textContent = '请稍后刷新页面。';
  });
