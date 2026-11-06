// toast.js — Toast notification utility
// Usage: Toast.success('Saved successfully')  Toast.error('Something went wrong')

const Toast = (() => {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✓',
      error:   '✕',
      info:    'ℹ'
    };

    toast.innerHTML = `
      <span style="font-size:16px;font-weight:700;">${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;

    getContainer().appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    info:    (msg) => show(msg, 'info'),
  };
})();
