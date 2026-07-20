const shortcutHintPattern = /\s*\((?:f9|f10|alt\+q)\)/gi;

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
  proxy.disabled = disabled;
  proxy.classList.toggle('disabled', disabled);
}

function installPretestPaneHeaders() {
  const inputs = Array.from(document.querySelectorAll<HTMLElement>('.scratchpad__data-input'));
  if (inputs.length < 2) return;

  inputs.slice(0, 2).forEach((input, index) => {
    const pane = input.parentElement;
    if (!pane) return;
    pane.classList.add('hydro-optimize-pretest-pane');
    pane.classList.toggle('hydro-optimize-pretest-pane--input', index === 0);
    pane.classList.toggle('hydro-optimize-pretest-pane--output', index === 1);
  });

  const inputPane = inputs[0].parentElement;
  if (!inputPane || inputPane.querySelector('.hydro-optimize-pretest-run')) return;

  // The original button remains mounted in the React toolbar. The proxy avoids
  // moving React-owned DOM while keeping its existing click handler and state.
  const runButton = document.createElement('button');
  runButton.type = 'button';
  runButton.className = 'hydro-optimize-pretest-run';
  runButton.addEventListener('click', () => {
    const original = document.querySelector<HTMLElement>('.scratchpad__toolbar__pretest');
    if (original && !original.classList.contains('disabled')) original.click();
  });
  inputPane.append(runButton);
  syncRunPretestButton(runButton);
}

function refreshScratchpadLayout() {
  document.querySelectorAll<HTMLElement>([
    '.scratchpad__toolbar__pretest',
    '.scratchpad__toolbar__submit',
    '[name="problem-sidebar__quit-scratchpad"]',
  ].join(',')).forEach(removeShortcutHints);
  installPretestPaneHeaders();
  document.querySelectorAll<HTMLButtonElement>('.hydro-optimize-pretest-run').forEach(syncRunPretestButton);
}

function installScratchpadLayoutStyles() {
  if (document.getElementById('hydro-optimize-scratchpad-layout-style')) return;
  const style = document.createElement('style');
  style.id = 'hydro-optimize-scratchpad-layout-style';
  style.textContent = `
    .scratchpad__toolbar {
      gap: 8px;
      min-height: 48px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--hfb-border, #d8dee4);
      background: var(--hfb-surface, #fff);
    }
    .scratchpad__toolbar__pretest { display: none !important; }
    .scratchpad__toolbar__submit { order: 100; margin-left: auto; }
    .scratchpad__toolbar__button,
    .hydro-optimize-pretest-run {
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid #20242a !important;
      border-radius: 5px;
      background: #fff;
      color: #17191d !important;
      box-shadow: none;
      font: inherit;
      line-height: 30px;
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
      min-height: 32px;
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
      position: absolute;
      z-index: 2;
      top: 4px;
      right: 8px;
      min-height: 30px;
      line-height: 28px;
    }
    @media (max-width: 640px) {
      .scratchpad__toolbar { gap: 5px; padding: 5px; }
      .scratchpad__toolbar__button,
      .hydro-optimize-pretest-run { padding: 0 8px; }
    }
  `;
  document.head.append(style);
}

function initialiseScratchpadLayout() {
  installScratchpadLayoutStyles();
  refreshScratchpadLayout();
  const observer = new MutationObserver(() => refreshScratchpadLayout());
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-tooltip', 'disabled'],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseScratchpadLayout, { once: true });
} else {
  initialiseScratchpadLayout();
}
