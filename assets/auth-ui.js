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

  function friendlyError(error, fallback) {
    const value = String(error?.message || '').toLowerCase();
    if (value.includes('invalid login') || value.includes('invalid credentials')) {
      return 'We could not sign you in. Check your email and password and try again.';
    }
    if (value.includes('already registered') || value.includes('already exists')) {
      return 'An account already uses this email. Sign in or reset your password.';
    }
    if (value.includes('rate limit') || value.includes('too many')) {
      return 'Too many attempts were made. Wait a moment and try again.';
    }
    if (value.includes('network') || value.includes('fetch')) {
      return 'We could not reach the account service. Check your connection and try again.';
    }
    return fallback;
  }

  async function initialize() {
    if (!auth) {
      setStatus('Sign-in is temporarily unavailable. Please try again later.', 'error');
      return;
    }
    try {
      await auth.ready;
    } catch {
      setStatus('Sign-in is temporarily unavailable. Please try again later.', 'error');
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
      setStatus('Creating your free account…');
      const { data, error } = await auth.signUp({ email, password, displayName, next: params.get('next') });
      setBusy(form, false);
      if (error) return setStatus(friendlyError(error, 'We could not create your account. Check the information entered and try again.'), 'error');
      if (data.session) {
        window.location.assign(auth.safeNext(params.get('next')));
        return;
      }
      sessionStorage.setItem('free-htl-pending-email', email);
      window.location.assign(auth.siteUrl(`account/verify-email.html?next=${encodeURIComponent(auth.safeNext(params.get('next')))}`));
    });
  }

  function setupSignIn() {
    if (params.get('deleted') === '1') {
      setStatus('Your account and saved account progress were deleted. You can still use the free lesson without an account.', 'success');
    } else if (params.get('signed_out') === '1') {
      setStatus('You have been signed out.', 'success');
    }
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
      if (error) return setStatus(friendlyError(error, 'We could not sign you in. Check your email and password and try again.'), 'error');
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
      setStatus(
        error ? friendlyError(error, 'We could not resend the verification email. Please try again.') : 'A new verification email has been sent.',
        error ? 'error' : 'success'
      );
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
      setStatus('If an account uses that email, a password-reset link has been sent.', 'success');
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
      if (error) return setStatus(friendlyError(error, 'We could not update your password. Request a new reset link and try again.'), 'error');
      setStatus('Your password was updated. Returning to account settings…', 'success');
      window.setTimeout(() => window.location.assign(auth.siteUrl('account/settings.html')), 600);
    });
  }

  async function handleCallback() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const callbackError = params.get('error_description') || hash.get('error_description');
    if (callbackError) {
      setStatus('This verification or sign-in link is no longer valid. Request a new email or sign in again.', 'error');
      return;
    }
    const { data, error } = await auth.getSession();
    if (error || !data.session) {
      setStatus('This verification or sign-in link is no longer valid. Request a new email or sign in again.', 'error');
      return;
    }
    setStatus('Your account is ready. Returning to your study page…', 'success');
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
      setStatus(
        result.error
          ? 'Your display name was updated, but we could not finish saving the change everywhere. Please try again later.'
          : 'Account settings saved.',
        result.error ? 'warning' : 'success'
      );
    });
    document.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
      await auth.signOut();
      window.location.assign(auth.siteUrl('account/sign-in.html?signed_out=1'));
    });

    const showDelete = document.querySelector('[data-show-delete-account]');
    const panel = document.querySelector('[data-delete-account-panel]');
    const confirmation = document.querySelector('[data-delete-confirmation]');
    const confirmDelete = document.querySelector('[data-confirm-delete-account]');
    const cancelDelete = document.querySelector('[data-cancel-delete-account]');

    function setDeleteBusy(busy) {
      [showDelete, confirmation, confirmDelete, cancelDelete].filter(Boolean).forEach((element) => {
        element.disabled = busy;
      });
      panel?.setAttribute('aria-busy', String(busy));
    }

    showDelete?.addEventListener('click', () => {
      panel.hidden = false;
      showDelete.hidden = true;
      confirmation.value = '';
      confirmDelete.disabled = true;
      confirmation.focus();
    });

    confirmation?.addEventListener('input', () => {
      confirmDelete.disabled = confirmation.value !== 'DELETE';
    });

    cancelDelete?.addEventListener('click', () => {
      panel.hidden = true;
      showDelete.hidden = false;
      confirmation.value = '';
      confirmDelete.disabled = true;
      showDelete.focus();
    });

    confirmDelete?.addEventListener('click', async () => {
      if (confirmation.value !== 'DELETE') {
        setStatus('Type DELETE exactly to confirm permanent account deletion.', 'error');
        confirmation.focus();
        return;
      }
      setDeleteBusy(true);
      setStatus('Deleting your account and saved progress…', 'warning');
      const result = await auth.deleteAccount();
      if (result.error) {
        setDeleteBusy(false);
        confirmDelete.disabled = confirmation.value !== 'DELETE';
        setStatus('We could not delete your account. Nothing was removed. Please try again.', 'error');
        return;
      }
      window.location.replace(auth.siteUrl('account/sign-in.html?deleted=1'));
    });
  }

  initialize();
})();
