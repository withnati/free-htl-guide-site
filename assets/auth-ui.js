(() => {
  'use strict';

  const auth = window.FreeHTLAuth;
  const page = document.body.dataset.authPage;
  const status = document.querySelector('[data-auth-status]');
  const params = new URLSearchParams(window.location.search);

  function setStatus(message, type = 'info') {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = type;
    status.hidden = !message;
    status.focus({ preventScroll: true });
  }

  function setBusy(form, busy) {
    form?.querySelectorAll('button, input').forEach((element) => {
      if (element.type !== 'hidden') element.disabled = busy;
    });
    form?.setAttribute('aria-busy', String(busy));
  }

  function passwordIssue(password) {
    if (password.length < 10) return 'Use at least 10 characters.';
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return 'Include uppercase, lowercase, and a number.';
    }
    return '';
  }

  function errorMessage(error, fallback) {
    return error?.message || fallback;
  }

  async function initialize() {
    if (!auth) {
      setStatus('Authentication is not available in this preview.', 'error');
      return;
    }
    try {
      await auth.ready;
    } catch (error) {
      setStatus(errorMessage(error, 'Authentication could not be initialized.'), 'error');
      return;
    }

    if (page === 'sign-up') setupSignUp();
    if (page === 'sign-in') setupSignIn();
    if (page === 'verify-email') setupVerification();
    if (page === 'forgot-password') setupForgotPassword();
    if (page === 'reset-password') setupResetPassword();
    if (page === 'auth-callback') await handleCallback();
    if (page === 'settings') await setupSettings();
  }

  function setupSignUp() {
    const form = document.querySelector('[data-sign-up-form]');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const displayName = String(values.get('display_name') || '').trim();
      const email = String(values.get('email') || '').trim();
      const password = String(values.get('password') || '');
      const confirmation = String(values.get('password_confirmation') || '');
      const issue = passwordIssue(password);
      if (issue) return setStatus(issue, 'error');
      if (password !== confirmation) return setStatus('Passwords do not match.', 'error');
      setBusy(form, true);
      setStatus('Creating your account…');
      const { data, error } = await auth.signUp({ email, password, displayName, next: params.get('next') });
      setBusy(form, false);
      if (error) return setStatus(errorMessage(error, 'Account creation failed.'), 'error');
      if (data.session) {
        window.location.assign(auth.safeNext(params.get('next')));
        return;
      }
      sessionStorage.setItem('free-htl-pending-email', email);
      window.location.assign(auth.siteUrl(`account/verify-email.html?next=${encodeURIComponent(auth.safeNext(params.get('next')))}`));
    });
  }

  function setupSignIn() {
    const form = document.querySelector('[data-sign-in-form]');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      setBusy(form, true);
      setStatus('Signing you in…');
      const { error } = await auth.signIn({
        email: String(values.get('email') || '').trim(),
        password: String(values.get('password') || '')
      });
      setBusy(form, false);
      if (error) return setStatus(errorMessage(error, 'Sign in failed.'), 'error');
      window.location.assign(auth.safeNext(params.get('next')));
    });
  }

  function setupVerification() {
    const email = sessionStorage.getItem('free-htl-pending-email') || '';
    const emailNode = document.querySelector('[data-pending-email]');
    if (emailNode) emailNode.textContent = email || 'your email address';
    const form = document.querySelector('[data-resend-form]');
    const input = form?.querySelector('input[name="email"]');
    if (input && email) input.value = email;
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = String(new FormData(form).get('email') || '').trim();
      setBusy(form, true);
      const { error } = await auth.resendConfirmation(value, params.get('next'));
      setBusy(form, false);
      setStatus(error ? errorMessage(error, 'The email could not be resent.') : 'A new verification email has been sent.', error ? 'error' : 'success');
    });
  }

  function setupForgotPassword() {
    const form = document.querySelector('[data-forgot-form]');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = String(new FormData(form).get('email') || '').trim();
      setBusy(form, true);
      await auth.requestPasswordReset(email);
      setBusy(form, false);
      setStatus('If an account exists for that email, a password-reset link has been sent.', 'success');
    });
  }

  function setupResetPassword() {
    const form = document.querySelector('[data-reset-form]');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const password = String(values.get('password') || '');
      const confirmation = String(values.get('password_confirmation') || '');
      const issue = passwordIssue(password);
      if (issue) return setStatus(issue, 'error');
      if (password !== confirmation) return setStatus('Passwords do not match.', 'error');
      setBusy(form, true);
      const { error } = await auth.updatePassword(password);
      setBusy(form, false);
      if (error) return setStatus(errorMessage(error, 'Password update failed.'), 'error');
      setStatus('Your password has been updated. Redirecting to account settings…', 'success');
      window.setTimeout(() => window.location.assign(auth.siteUrl('account/settings.html')), 600);
    });
  }

  async function handleCallback() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const callbackError = params.get('error_description') || hash.get('error_description');
    if (callbackError) {
      setStatus(callbackError, 'error');
      return;
    }
    const { data, error } = await auth.getSession();
    if (error || !data.session) {
      setStatus('The sign-in link is invalid or expired. Request a new link or sign in again.', 'error');
      return;
    }
    setStatus('Your account is verified. Redirecting…', 'success');
    window.setTimeout(() => window.location.assign(auth.safeNext(params.get('next'))), 400);
  }

  async function setupSettings() {
    const { data, error } = await auth.getUser();
    if (error || !data.user) {
      window.location.replace(auth.siteUrl(`account/sign-in.html?next=${encodeURIComponent(window.location.href)}`));
      return;
    }
    const user = data.user;
    const emailNode = document.querySelector('[data-account-email]');
    if (emailNode) emailNode.textContent = user.email || 'Unavailable';
    const form = document.querySelector('[data-profile-form]');
    const nameInput = form?.querySelector('input[name="display_name"]');
    if (nameInput) nameInput.value = user.user_metadata?.display_name || '';
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const displayName = String(new FormData(form).get('display_name') || '').trim();
      if (!displayName) return setStatus('Enter a display name.', 'error');
      setBusy(form, true);
      const result = await auth.updateDisplayName(displayName);
      setBusy(form, false);
      setStatus(result.error ? 'Your account name was updated, but the profile record could not be synchronized yet.' : 'Account settings saved.', result.error ? 'warning' : 'success');
    });
    document.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
      await auth.signOut();
      window.location.assign(auth.siteUrl('account/sign-in.html?signed_out=1'));
    });
  }

  initialize();
})();
