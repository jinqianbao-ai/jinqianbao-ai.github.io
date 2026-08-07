import { normalizeText, stableHash, makeAnnotationTerm } from './annotation-core.mjs';

const REPO = 'jinqianbao-ai/jinqianbao-ai.github.io';
const REPO_ID = 'R_kgDOTwz2XA';
const CATEGORY = 'Ideas';
const CATEGORY_ID = 'DIC_kwDOTwz2XM4DC2H6';
const root = document.querySelector('.inner') || document.querySelector('#main') || document.querySelector('main');
const pageKey = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
const trigger = document.getElementById('annotation-trigger');
const panel = document.getElementById('annotation-panel');
const quoteBox = document.getElementById('annotation-quote');
const closeButton = document.getElementById('annotation-close');
const giscusHost = document.getElementById('annotation-giscus');
const tip = document.getElementById('annotation-tip');
let active = null;
let timer = null;

function annotationBlocks() {
  if (!root) return [];
  return [...root.querySelectorAll('p,li,h2,h3,h4,blockquote')].filter((node) => {
    if (node.closest('.site-actions,.annotation-panel')) return false;
    return normalizeText(node.textContent).length >= 8;
  });
}

function assignBlocks() {
  for (const block of annotationBlocks()) {
    block.dataset.annotationBlock = stableHash(block.textContent);
  }
}

function closestBlock(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.('[data-annotation-block]') || null;
}

function offsetWithin(block, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(block);
  range.setEnd(node, offset);
  return range.toString().length;
}

function rangeFromOffsets(block, start, end) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node;
  let cursor = 0;
  let started = false;
  while ((node = walker.nextNode())) {
    const next = cursor + node.textContent.length;
    if (!started && start >= cursor && start <= next) {
      range.setStart(node, Math.max(0, start - cursor));
      started = true;
    }
    if (started && end >= cursor && end <= next) {
      range.setEnd(node, Math.max(0, end - cursor));
      return range;
    }
    cursor = next;
  }
  return null;
}

function markRange(range, className, term, comments = 0) {
  if (!range || range.collapsed) return null;
  const mark = document.createElement('mark');
  mark.className = className;
  mark.dataset.annotationTerm = term;
  mark.dataset.comments = String(comments || 0);
  mark.title = comments ? `${comments} 条批注` : '文内批注';
  try {
    range.surroundContents(mark);
    return mark;
  } catch (_) {
    return null;
  }
}

function readSelection() {
  const selection = getSelection();
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const startBlock = closestBlock(range.startContainer);
  const endBlock = closestBlock(range.endContainer);
  if (!startBlock || startBlock !== endBlock) return null;
  const quote = normalizeText(range.toString());
  if (quote.length < 2 || quote.length > 500) return null;
  const start = offsetWithin(startBlock, range.startContainer, range.startOffset);
  const end = offsetWithin(startBlock, range.endContainer, range.endOffset);
  const blockHash = startBlock.dataset.annotationBlock;
  return {
    range: range.cloneRange(), block: startBlock, blockHash, start, end, quote,
    term: makeAnnotationTerm({ pageKey, blockHash, start, end, quote }),
  };
}

function hideTrigger() {
  if (trigger) trigger.hidden = true;
}

function showTrigger() {
  active = readSelection();
  if (!active || !trigger) return hideTrigger();
  const rect = active.range.getBoundingClientRect();
  trigger.hidden = false;
  const left = Math.min(innerWidth - trigger.offsetWidth - 10, Math.max(10, rect.right - trigger.offsetWidth));
  const top = Math.min(innerHeight - trigger.offsetHeight - 76, Math.max(10, rect.bottom + 8));
  trigger.style.left = `${left}px`;
  trigger.style.top = `${top}px`;
}

function loadGiscus(annotation) {
  giscusHost.replaceChildren();
  const script = document.createElement('script');
  const attrs = {
    src: 'https://giscus.app/client.js',
    'data-repo': REPO,
    'data-repo-id': REPO_ID,
    'data-category': CATEGORY,
    'data-category-id': CATEGORY_ID,
    'data-mapping': annotation.number ? 'number' : 'specific',
    'data-term': annotation.number ? String(annotation.number) : annotation.term,
    'data-strict': annotation.number ? '0' : '1',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'top',
    'data-theme': 'preferred_color_scheme',
    'data-lang': 'zh-CN',
    'data-loading': 'lazy',
    crossorigin: 'anonymous',
  };
  for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
  script.async = true;
  giscusHost.appendChild(script);
}

function openPanel(annotation, existingMark = null) {
  if (!annotation || !panel) return;
  active = annotation;
  quoteBox.textContent = `“${annotation.quote}”`;
  panel.dataset.open = 'true';
  panel.hidden = false;
  document.body.classList.add('annotation-open');
  hideTrigger();
  if (!existingMark) {
    const mark = markRange(annotation.range, 'annotation-pending', annotation.term);
    if (mark) mark.addEventListener('click', () => openPanel(annotation, mark));
  }
  loadGiscus(annotation);
}

function closePanel() {
  panel.dataset.open = 'false';
  panel.hidden = true;
  document.body.classList.remove('annotation-open');
}

async function loadExistingAnnotations() {
  try {
    const response = await fetch('../../annotations.json', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const annotations = (data.annotations || []).filter((item) => item.pageKey === pageKey);
    const groups = new Map();
    for (const item of annotations) {
      if (!groups.has(item.blockHash)) groups.set(item.blockHash, []);
      groups.get(item.blockHash).push(item);
    }
    for (const [blockHash, items] of groups) {
      const block = document.querySelector(`[data-annotation-block="${CSS.escape(blockHash)}"]`);
      if (!block) continue;
      items.sort((a, b) => b.start - a.start);
      for (const item of items) {
        const range = rangeFromOffsets(block, item.start, item.end);
        const mark = markRange(range, 'annotation-existing', item.term, item.comments);
        if (!mark) continue;
        mark.addEventListener('click', () => openPanel({ ...item, range, block }, mark));
      }
    }
  } catch (_) {
    // Annotation index is optional; selection comments still work without it.
  }
}

assignBlocks();
loadExistingAnnotations();
document.addEventListener('selectionchange', () => {
  clearTimeout(timer);
  timer = setTimeout(showTrigger, 120);
});
document.addEventListener('mouseup', showTrigger);
document.addEventListener('touchend', () => setTimeout(showTrigger, 180));
trigger?.addEventListener('click', () => {
  const current = readSelection() || active;
  if (current) openPanel(current);
});
closeButton?.addEventListener('click', closePanel);
panel?.addEventListener('click', (event) => {
  if (event.target === panel) closePanel();
});
document.querySelector('#annotation-help')?.addEventListener('click', () => {
  if (tip) {
    tip.hidden = false;
    setTimeout(() => { tip.hidden = true; }, 2600);
  }
});
