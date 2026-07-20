function openScratchpadPretestWhenReady() {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const store = (window as any).store;
    const pretestButton = document.querySelector('.scratchpad__toolbar__pretest');
    if (store?.dispatch && pretestButton) {
      store.dispatch({
        type: 'SCRATCHPAD_UI_SET_VISIBILITY',
        payload: { uiElement: 'pretest', visibility: true },
      });
      window.clearInterval(timer);
    } else if (attempts >= 100) {
      // Scratchpad did not finish loading (or this problem does not support pretest).
      window.clearInterval(timer);
    }
  }, 50);
}

function initialiseScratchpadPretestAutopen() {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[name="problem-sidebar__open-scratchpad"]')) return;
    // Hydro initializes the React store asynchronously after this click.
    window.setTimeout(openScratchpadPretestWhenReady, 0);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseScratchpadPretestAutopen, { once: true });
} else {
  initialiseScratchpadPretestAutopen();
}
