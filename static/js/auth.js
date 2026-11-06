// auth.js — Login and signup page logic

document.addEventListener('DOMContentLoaded', () => {
  // Redirect to dashboard if already authenticated
  if (TokenStore.isAuthenticated() && (window.location.pathname === '/login/' || window.location.pathname === '/signup/')) {
    redirectToDashboard();
    return;
  }

  const path = window.location.pathname;

  if (path.includes('/login')) initLoginPage();
  if (path.includes('/signup')) initSignupPage();
});

// === LOGIN PAGE ===

function initLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = form.querySelector('[type="submit"]');

    if (!email || !password) {
      Toast.error('Please enter your email and password.');
      return;
    }

    setButtonLoading(submitBtn, true);

    try {
      const response = await api.post('/auth/login/', { email, password }, true);

      if (!response) return;

      if (!response.ok) {
        const data = await response.json();
        Toast.error(data.detail || data.error || 'Invalid credentials.');
        return;
      }

      const data = await response.json();
      TokenStore.setTokens(data.access, data.refresh);

      // Fetch user info and store it
      const userResponse = await api.get('/auth/me/');
      if (userResponse && userResponse.ok) {
        const user = await userResponse.json();
        TokenStore.setUser(user);
      }

      redirectToDashboard();

    } catch (err) {
      Toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

// === SIGNUP PAGE ===

function initSignupPage() {
  const form = document.getElementById('signup-form');
  const roleSelect = document.getElementById('role');
  const adminFields = document.getElementById('admin-fields');
  const employeeFields = document.getElementById('employee-fields');
  const orgSelect = document.getElementById('org-slug-select');

  if (!form) return;

  // Load org list for the employee dropdown
  loadOrgList(orgSelect);

  // Show/hide conditional fields based on role selection
  roleSelect.addEventListener('change', () => {
    const role = roleSelect.value;
    if (role === 'admin') {
      adminFields.classList.add('visible');
      employeeFields.classList.remove('visible');
    } else if (role) {
      adminFields.classList.remove('visible');
      employeeFields.classList.add('visible');
    } else {
      adminFields.classList.remove('visible');
      employeeFields.classList.remove('visible');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const submitBtn = form.querySelector('[type="submit"]');
    const role = document.getElementById('role').value;

    if (!role) {
      Toast.error('Please select a role.');
      return;
    }

    const payload = {
      email:      document.getElementById('email').value.trim(),
      password:   document.getElementById('password').value,
      first_name: document.getElementById('first-name').value.trim(),
      last_name:  document.getElementById('last-name').value.trim(),
      role:       role === 'admin_join' ? 'admin' : role,
    };

    if (role === 'admin') {
      payload.new_org_name             = document.getElementById('org-name').value.trim();
      payload.new_org_slug             = document.getElementById('org-slug').value.trim().toLowerCase().replace(/\s+/g, '-');
      payload.new_org_passkey          = document.getElementById('org-passkey').value;
      payload.new_org_hr_passkey       = document.getElementById('org-hr-passkey').value;
      payload.new_org_manager_passkey  = document.getElementById('org-manager-passkey').value;
      payload.new_org_employee_passkey = document.getElementById('org-employee-passkey').value;
    } else {
      payload.org_slug = document.getElementById('org-slug-select').value;
      payload.passkey  = document.getElementById('passkey').value;
    }

    setButtonLoading(submitBtn, true);

    try {
      const response = await api.post('/auth/register/', payload, true);

      if (!response) return;

      if (!response.ok) {
        const data = await response.json();
        if (data.error) {
          const errorMsg = typeof data.error === 'object' ? JSON.stringify(data.error) : data.error;
          Toast.error(errorMsg);
        } else {
          // field-level errors
          let firstError = null;
          Object.entries(data).forEach(([field, errors]) => {
            const msg = Array.isArray(errors) ? errors[0] : errors;
            showFieldError(field, msg);
            if (!firstError) {
              firstError = `${field}: ${msg}`;
            }
          });
          if (firstError) {
            Toast.error(firstError);
          }
        }
        return;
      }

      Toast.success('Account created! Please log in.');
      setTimeout(() => { window.location.href = '/login/'; }, 1500);

    } catch (err) {
      Toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

async function loadOrgList(selectEl) {
  if (!selectEl) return;
  try {
    const response = await api.get('/tenants/public/', true);
    if (!response || !response.ok) return;
    const orgs = await response.json();

    selectEl.innerHTML = '<option value="">Select your organization</option>';
    orgs.forEach(org => {
      const option = document.createElement('option');
      option.value = org.slug;
      option.textContent = org.name;
      selectEl.appendChild(option);
    });
  } catch {
    // silently fail — user can still type the slug manually if needed
  }
}

// === UTILITIES ===

function setButtonLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Loading...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Submit';
  }
}

function clearFormErrors(form) {
  form.querySelectorAll('.form-error-text').forEach(el => el.remove());
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function showFieldError(fieldName, message) {
  const fieldId = fieldName.replace(/_/g, '-');
  const input = document.getElementById(fieldId);
  if (input) {
    input.classList.add('error');
    const errorEl = document.createElement('span');
    errorEl.className = 'form-error-text';
    errorEl.textContent = message;
    input.parentElement.appendChild(errorEl);
  }
}
