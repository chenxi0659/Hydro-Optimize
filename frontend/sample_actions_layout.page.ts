function directChildWithClass(parent: HTMLElement, className: string): HTMLElement | null {
  return Array.from(parent.children).find((child) => child.classList.contains(className)) as HTMLElement || null;
}

function moveSampleActions(sample: HTMLElement) {
  if (sample.dataset.hydroOptimizeSampleActions === 'true') return;

  const title = directChildWithClass(sample, 'sample-title') || sample.querySelector<HTMLElement>(':scope > h2');
  const toolbar = directChildWithClass(sample, 'toolbar');
  if (!title || !toolbar) return;

  const header = document.createElement('div');
  header.className = 'hydro-optimize-sample-header';
  const actions = document.createElement('div');
  actions.className = 'hydro-optimize-sample-actions';

  sample.insertBefore(header, sample.firstChild);
  header.append(title);
  actions.append(toolbar);
  header.append(actions);
  sample.dataset.hydroOptimizeSampleActions = 'true';
}

function arrangeSampleActions(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.sample').forEach(moveSampleActions);
}

function installSampleActionStyles() {
  if (document.getElementById('hydro-optimize-sample-actions-style')) return;
  const style = document.createElement('style');
  style.id = 'hydro-optimize-sample-actions-style';
  style.textContent = `
    .sample > .hydro-optimize-sample-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 8px;
    }
    .sample > .hydro-optimize-sample-header > h2 {
      margin: 0;
    }
    .hydro-optimize-sample-actions {
      display: flex;
      flex: 0 0 auto;
      align-items: baseline;
      min-width: 0;
    }
    .hydro-optimize-sample-actions .toolbar {
      position: static !important;
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 0 !important;
      background: transparent !important;
      font: inherit !important;
    }
    .hydro-optimize-sample-actions .toolbar-item {
      margin: 0 !important;
    }
    .hydro-optimize-sample-actions .toolbar-item a {
      font-size: inherit !important;
      line-height: inherit;
    }
    @media (max-width: 640px) {
      .sample > .hydro-optimize-sample-header {
        flex-wrap: wrap;
      }
      .hydro-optimize-sample-actions {
        width: 100%;
      }
    }
  `;
  document.head.append(style);
}

function initialiseSampleActionLayout() {
  installSampleActionStyles();
  arrangeSampleActions();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('.sample')) moveSampleActions(node);
        arrangeSampleActions(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseSampleActionLayout, { once: true });
} else {
  initialiseSampleActionLayout();
}
