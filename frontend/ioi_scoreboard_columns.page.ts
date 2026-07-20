function installIoiScoreboardColumnStyles() {
  if (document.getElementById('hydro-optimize-ioi-scoreboard-columns')) return;
  const style = document.createElement('style');
  style.id = 'hydro-optimize-ioi-scoreboard-columns';
  style.textContent = `
    .page--contest_scoreboard .scoreboard--ioi .overflow-hidden-horizontal {
      overflow-x: auto !important;
    }
    .page--contest_scoreboard .scoreboard--ioi .data-table {
      width: max-content;
      min-width: 100%;
    }
    .page--contest_scoreboard .scoreboard--ioi .col--problem {
      width: 160px !important;
      min-width: 160px !important;
      overflow: visible;
      text-overflow: clip;
      white-space: nowrap;
    }
  `;
  document.head.append(style);
}

function initialiseIoiScoreboardColumnStyles() {
  if (document.documentElement.dataset.page !== 'contest_scoreboard') return;
  installIoiScoreboardColumnStyles();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseIoiScoreboardColumnStyles, { once: true });
} else {
  initialiseIoiScoreboardColumnStyles();
}
