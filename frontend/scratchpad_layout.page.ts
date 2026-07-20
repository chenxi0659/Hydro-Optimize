const shortcutHintPattern = /\s*\((?:f9|f10|alt\+q)\)/gi;
let toolbarObserver: MutationObserver | null = null;
let pretestPaneObserver: ResizeObserver | null = null;
let observedPretestPane: HTMLElement | null = null;
let refreshFrame = 0;

function removeShortcutHints(button: HTMLElement) {
  const tooltip = button.getAttribute('data-tooltip');
  if (tooltip) {
    const nextTooltip = tooltip.replace(shortcutHintPattern, '').trim();
    // Attribute mutations are observed below. Avoid writing an identical value,
    // otherwise a toolbar refresh would schedule itself forever.
    if (nextTooltip !== tooltip) button.setAttribute('data-tooltip', nextTooltip);
  }

  const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const nextValue = node.data.replace(shortcutHintPattern, '');
    if (nextValue !== node.data) node.data = nextValue;
  });
}

function getPlainButtonLabel(button: HTMLElement): string {
  return (button.textContent || '').replace(shortcutHintPattern, '').replace(/\s+/g, ' ').trim();
}

function syncRunPretestButton(proxy: HTMLButtonElement) {
  const original = document.querySelector<HTMLElement>('.scratchpad__toolbar__pretest');
  if (!original) return;

  removeShortcutHints(original);
  const label = getPlainButtonLabel(original);
  if (label && proxy.textContent !== label) proxy.textContent = label;
  const disabled = original.classList.contains('disabled') || (original as HTMLButtonElement).disabled;
  if (proxy.disabled !== disabled) proxy.disabled = disabled;
  if (proxy.classList.contains('disabled') !== disabled) proxy.classList.toggle('disabled', disabled);
}

function removePretestProxy() {
  pretestPaneObserver?.disconnect();
  observedPretestPane = null;
  document.querySelector('.hydro-optimize-pretest-run')?.remove();
  document.body.classList.remove('hydro-optimize-pretest-proxy-ready');
}

function positionPretestProxy(): boolean {
  const proxy = document.querySelector<HTMLButtonElement>('.hydro-optimize-pretest-run');
  if (!proxy || !observedPretestPane?.isConnected) return false;
  const rect = observedPretestPane.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    proxy.hidden = true;
    document.body.classList.remove('hydro-optimize-pretest-proxy-ready');
    return false;
  }

  proxy.hidden = false;
  const left = Math.max(rect.left + 64, rect.right - proxy.offsetWidth - 8);
  proxy.style.left = `${Math.round(left)}px`;
  proxy.style.top = `${Math.round(rect.top + 4)}px`;
  document.body.classList.add('hydro-optimize-pretest-proxy-ready');
  return true;
}

function installPretestPaneHeaders() {
  const inputs = Array.from(document.querySelectorAll<HTMLElement>('.scratchpad__data-input'));
  if (inputs.length < 2) {
    removePretestProxy();
    return;
  }

  inputs.slice(0, 2).forEach((input, index) => {
    const pane = input.parentElement;
    if (!pane) return;
    if (!pane.classList.contains('hydro-optimize-pretest-pane')) {
      pane.classList.add('hydro-optimize-pretest-pane');
    }
    const isInput = index === 0;
    if (pane.classList.contains('hydro-optimize-pretest-pane--input') !== isInput) {
      pane.classList.toggle('hydro-optimize-pretest-pane--input', isInput);
    }
    if (pane.classList.contains('hydro-optimize-pretest-pane--output') === isInput) {
      pane.classList.toggle('hydro-optimize-pretest-pane--output', !isInput);
    }
  });

  const inputPane = inputs[0].parentElement;
  if (!inputPane) {
    removePretestProxy();
    return;
  }

  let runButton = document.querySelector<HTMLButtonElement>('.hydro-optimize-pretest-run');
  if (!runButton) {
    // Keep the proxy outside React-owned nodes. It forwards clicks to Hydro's
    // original button, so submit/pretest behavior remains controlled by Hydro.
    runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'hydro-optimize-pretest-run';
    runButton.addEventListener('click', () => {
      const original = document.querySelector<HTMLElement>('.scratchpad__toolbar__pretest');
      if (original && !original.classList.contains('disabled')) original.click();
    });
    document.body.append(runButton);
  }
  syncRunPretestButton(runButton);

  if (observedPretestPane !== inputPane) {
    pretestPaneObserver?.disconnect();
    observedPretestPane = inputPane;
    if (typeof ResizeObserver !== 'undefined') {
      pretestPaneObserver ||= new ResizeObserver(() => positionPretestProxy());
      pretestPaneObserver.observe(inputPane);
    }
  }
  positionPretestProxy();
}

function refreshScratchpadLayout() {
  // Updates below intentionally change toolbar text and attributes. Pause the
  // focused observer so those writes cannot recursively schedule themselves.
  toolbarObserver?.disconnect();
  document.querySelectorAll<HTMLElement>([
    '.scratchpad__toolbar__pretest',
    '.scratchpad__toolbar__submit',
    '[name="problem-sidebar__quit-scratchpad"]',
  ].join(',')).forEach(removeShortcutHints);
  installPretestPaneHeaders();
  document.querySelectorAll<HTMLButtonElement>('.hydro-optimize-pretest-run').forEach(syncRunPretestButton);
  observeScratchpadToolbar();
}

function scheduleScratchpadRefresh() {
  if (refreshFrame) return;
  refreshFrame = window.requestAnimationFrame(() => {
    refreshFrame = 0;
    refreshScratchpadLayout();
  });
}

function observeScratchpadToolbar() {
  const toolbar = document.querySelector<HTMLElement>('.scratchpad__toolbar');
  if (!toolbar) return;
  if (!toolbarObserver) toolbarObserver = new MutationObserver(scheduleScratchpadRefresh);
  toolbarObserver.observe(toolbar, {
    attributes: true,
    attributeFilter: ['class', 'data-tooltip', 'disabled'],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function mutationContainsScratchpad(mutation: MutationRecord): boolean {
  const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
  return nodes.some((node) => {
    if (!(node instanceof Element)) return false;
    return node.matches('.scratchpad__toolbar, .scratchpad__data-input, .hydro-optimize-pretest-run')
      || !!node.querySelector('.scratchpad__toolbar, .scratchpad__data-input, .hydro-optimize-pretest-run');
  });
}

function installScratchpadLayoutStyles() {
  if (document.getElementById('hydro-optimize-scratchpad-layout-style')) return;
  const style = document.createElement('style');
  style.id = 'hydro-optimize-scratchpad-layout-style';
  style.textContent = `
    body.mode--scratchpad #scratchpad {
      top: var(--hfb-nav-height, 45px);
    }
    .scratchpad__toolbar {
      box-sizing: border-box;
      min-width: 0;
      padding: 7px 8px;
      border-bottom: 1px solid var(--hfb-border, #d8dee4);
      background: var(--hfb-surface, #fff);
      overflow-x: auto;
      overflow-y: hidden;
      white-space: nowrap;
    }
    .scratchpad__toolbar__item { flex: 0 0 auto; }
    body.hydro-optimize-pretest-proxy-ready .scratchpad__toolbar__pretest {
      display: none !important;
    }
    .scratchpad__toolbar__submit {
      order: 100;
      margin-left: auto;
      margin-right: 0;
    }
    .scratchpad__toolbar__button,
    .hydro-optimize-pretest-run {
      box-sizing: border-box;
      padding: 5px 9px;
      border: 1px solid #20242a !important;
      border-radius: 5px;
      background: #fff;
      color: #17191d !important;
      box-shadow: none;
      cursor: pointer;
      transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
    }
    .scratchpad__toolbar__button > div { display: flex; align-items: center; gap: 4px; }
    .scratchpad__toolbar__button.enabled:hover,
    .scratchpad__toolbar__button.activated,
    .hydro-optimize-pretest-run:hover:not(:disabled) {
      background: #20242a;
      color: #fff !important;
    }
    .scratchpad__toolbar__submit {
      background: #20242a;
      color: #fff !important;
    }
    .scratchpad__toolbar__button.disabled,
    .hydro-optimize-pretest-run:disabled {
      opacity: .48;
      cursor: not-allowed;
    }
    .scratchpad__toolbar .select {
      width: auto;
      min-width: 108px;
      height: 29px;
      min-height: 29px;
      border: 1px solid #20242a;
      border-radius: 5px;
      background: #fff;
      color: #17191d;
    }
    .hydro-optimize-pretest-pane {
      position: relative !important;
      box-sizing: border-box;
      padding-top: 38px;
      background: var(--hfb-surface, #fff);
    }
    .hydro-optimize-pretest-pane::before {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 38px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      box-sizing: border-box;
      border-bottom: 1px solid #c9d0d8;
      color: #17191d;
      font-weight: 600;
      background: #f8fafc;
    }
    .hydro-optimize-pretest-pane--input::before { content: '输入'; }
    .hydro-optimize-pretest-pane--output::before { content: '输出'; }
    .hydro-optimize-pretest-pane .scratchpad__data-input {
      position: absolute !important;
      inset: 38px 0 0 !important;
      width: 100% !important;
      height: auto !important;
      box-sizing: border-box;
      margin: 0;
      border: 0;
      border-radius: 0;
      background: #fff;
    }
    .hydro-optimize-pretest-pane .scratchpad__data-input:focus {
      outline: 2px solid #20242a;
      outline-offset: -2px;
    }
    .hydro-optimize-pretest-run {
      position: fixed;
      z-index: 1200;
      min-height: 29px;
      line-height: 17px;
    }
    @media (max-width: 640px) {
      .scratchpad__toolbar { padding: 5px; }
      .scratchpad__toolbar__button,
      .hydro-optimize-pretest-run { padding: 0 8px; }
    }
  `;
  document.head.append(style);
}

function initialiseScratchpadLayout() {
  installScratchpadLayoutStyles();
  refreshScratchpadLayout();
  // The document observer only discovers Scratchpad mount/unmount events.
  // Toolbar state changes are handled by the focused observer above.
  const mountObserver = new MutationObserver((mutations) => {
    if (mutations.some(mutationContainsScratchpad)) scheduleScratchpadRefresh();
  });
  mountObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('resize', scheduleScratchpadRefresh);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseScratchpadLayout, { once: true });
} else {
  initialiseScratchpadLayout();
}
