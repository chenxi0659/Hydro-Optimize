let autopenTimer = 0;

function openScratchpadPretestWhenReady() {
  window.clearInterval(autopenTimer);
  let attempts = 0;
  let dispatched = false;
  autopenTimer = window.setInterval(() => {
    attempts += 1;
    const store = (window as any).store;
    const toolbar = document.querySelector('.scratchpad__toolbar');
    const state = store?.getState?.();

    if (toolbar && store?.dispatch && state?.ui?.pretest && !state.ui.pretest.visible) {
      store.dispatch({
        type: 'SCRATCHPAD_UI_SET_VISIBILITY',
        payload: { uiElement: 'pretest', visibility: true },
      });
      dispatched = true;
    } else if (toolbar && state?.ui?.pretest?.visible
      && document.querySelectorAll('.scratchpad__data-input').length >= 2) {
      // Redux visibility plus mounted controls prove the pane is ready.
      window.clearInterval(autopenTimer);
      autopenTimer = 0;
      return;
    }

    // Retry long enough to cover Hydro's asynchronous editor/React loading.
    if (attempts >= 200 || (dispatched && !document.body.classList.contains('mode--scratchpad'))) {
      window.clearInterval(autopenTimer);
      autopenTimer = 0;
    }
  }, 50);
}

function initialiseScratchpadPretestAutopen() {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[name="problem-sidebar__open-scratchpad"]')) return;
    // This runs in the capture phase before Hydro creates the Redux store, so
    // the reducer's initial state already requests a visible pretest pane.
    localStorage.setItem('scratchpad/pretest', 'true');
    window.setTimeout(openScratchpadPretestWhenReady, 0);
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseScratchpadPretestAutopen, { once: true });
} else {
  initialiseScratchpadPretestAutopen();
}
