(() => {
  'use strict';

  const script = [...document.scripts].find((item) => /\/auth-service\.js(?:\?|$)/.test(item.src));
  const config = window.FreeHTLSupabaseConfig;
  const rootUrl = script ? new URL('../', script.src) : new URL('./', window.location.href);
  const CLOUD_DECISION_KEY = 'free-htl-cloud-sync-v1';
  const CLOUD_PENDING_PREFIX = 'free-htl-cloud-pending-v1:';
  const CLOUD_CACHE_PREFIX = 'free-htl-cloud-cache-v1:';
  const PROGRESS_STORAGE_KEY = 'free-htl-progress-v1';

  function siteUrl(path) {
    return new URL(path.replace(/^\//, ''), rootUrl).href;
  }

  function safeNext(value, fallback = 'my-progress.html') {
    if (!value) return siteUrl(fallback);
    try {
      const candidate = new URL(value, window.location.href);
      if (candidate.origin !== rootUrl.origin) return siteUrl(fallback);
      if (!candidate.pathname.startsWith(rootUrl.pathname)) return siteUrl(fallback);
      return candidate.href;
    } catch {
      return siteUrl(fallback);
    }
  }

  function requireClient() {
    if (!config?.projectUrl || !config?.publishableKey) {
      throw new Error('Supabase development configuration is unavailable.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('The authentication library could not be loaded.');
    }
    return window.supabase.createClient(config.projectUrl, config.publishableKey, {
      auth: {
        storageKey: config.storageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
  }

  let client;
  let initializationError = null;
  try {
    client = requireClient();
  } catch (error) {
    initializationError = error;
  }

  const ready = initializationError
    ? Promise.reject(initializationError)
    : client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      return data.session || null;
    });
  ready.catch(() => {});

  async function signUp({ email, password, displayName, next }) {
    const redirect = siteUrl(`account/auth-callback.html?next=${encodeURIComponent(safeNext(next))}`);
    return client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirect,
        data: { display_name: displayName }
      }
    });
  }

  async function signIn({ email, password }) {
    return client.auth.signInWithPassword({ email, password });
  }

  async function requestPasswordReset(email) {
    return client.auth.resetPasswordForEmail(email, {
      redirectTo: siteUrl('account/reset-password.html')
    });
  }

  async function resendConfirmation(email, next) {
    const redirect = siteUrl(`account/auth-callback.html?next=${encodeURIComponent(safeNext(next))}`);
    return client.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirect }
    });
  }

  async function updatePassword(password) {
    return client.auth.updateUser({ password });
  }

  async function updateDisplayName(displayName) {
    const { data, error } = await client.auth.updateUser({ data: { display_name: displayName } });
    if (error) return { data, error };
    const userId = data.user?.id;
    if (!userId) return { data, error: null };
    const profile = await client.from('profiles').update({ display_name: displayName }).eq('user_id', userId);
    return { data, error: profile.error || null };
  }

  function clearAccountBrowserState(userId) {
    try {
      const decision = JSON.parse(localStorage.getItem(CLOUD_DECISION_KEY) || 'null');
      if (!decision || decision.userId === userId) localStorage.removeItem(CLOUD_DECISION_KEY);
    } catch {
      localStorage.removeItem(CLOUD_DECISION_KEY);
    }
    if (userId) {
      localStorage.removeItem(`${CLOUD_PENDING_PREFIX}${userId}`);
      localStorage.removeItem(`${CLOUD_CACHE_PREFIX}${userId}`);
    }
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    sessionStorage.removeItem('free-htl-pending-email');
  }

  async function deleteAccount() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session?.user?.id) {
      return {
        data: null,
        error: sessionError || new Error('A verified account session is required.')
      };
    }

    const userId = sessionData.session.user.id;
    const result = await client.functions.invoke('delete-account', {
      body: { confirm: 'DELETE MY ACCOUNT' }
    });
    if (result.error) return result;

    clearAccountBrowserState(userId);
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      // The deleted account may no longer support a server sign-out; browser state is already cleared.
    }
    return { data: result.data || { deleted: true }, error: null };
  }

  window.FreeHTLAuth = Object.freeze({
    client,
    ready,
    initializationError,
    rootUrl,
    siteUrl,
    safeNext,
    signUp,
    signIn,
    signOut: () => client.auth.signOut(),
    getSession: () => client.auth.getSession(),
    getUser: () => client.auth.getUser(),
    onAuthStateChange: (callback) => client.auth.onAuthStateChange(callback),
    requestPasswordReset,
    resendConfirmation,
    updatePassword,
    updateDisplayName,
    deleteAccount,
    clearAccountBrowserState
  });
})();