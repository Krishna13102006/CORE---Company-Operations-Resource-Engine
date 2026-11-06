// landing.js — Interactivity and Auth state handling for CORE Landing Page

document.addEventListener('DOMContentLoaded', () => {
  initAuthButtons();
  initShowcaseTabs();
  initSmoothScroll();
});

function initAuthButtons() {
  const isAuth = typeof TokenStore !== 'undefined' && TokenStore.isAuthenticated();
  const navActions = document.getElementById('nav-actions');
  const heroCtas = document.getElementById('hero-ctas');

  if (isAuth) {
    const user = TokenStore.getUser();
    const displayName = user ? user.first_name || 'User' : 'Workspace';

    if (navActions) {
      navActions.innerHTML = `
        <a href="/dashboard/" class="btn-landing-primary">
          Go to Workspace (${displayName}) &rarr;
        </a>
      `;
    }

    if (heroCtas) {
      heroCtas.innerHTML = `
        <a href="/dashboard/" class="btn-landing-primary">
          Launch Workspace Dashboard &rarr;
        </a>
        <button id="landing-signout-btn" class="btn-landing-login">
          Sign Out
        </button>
      `;

      document.getElementById('landing-signout-btn')?.addEventListener('click', () => {
        TokenStore.clear();
        window.location.reload();
      });
    }
  }
}

function initShowcaseTabs() {
  const tabs = document.querySelectorAll('.showcase-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`pane-${targetId}`)?.classList.add('active');
    });
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}
