(() => {
  'use strict';

  const form = document.querySelector('form[action*="formspree.io/f/"]');
  if (!(form instanceof HTMLFormElement)) return;

  const emailInput = form.querySelector('input[type="email"][name="email"]');
  const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
  if (!(emailInput instanceof HTMLInputElement) || !submitButton) return;

  form.id = form.id || 'emailSignupForm';
  emailInput.autocomplete = 'email';
  emailInput.inputMode = 'email';
  emailInput.setAttribute('aria-describedby', 'emailSignupHelp emailSignupStatus');

  const addHiddenField = (name, value) => {
    if (form.elements.namedItem(name)) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  addHiddenField('_subject', 'New Free HTL Guide email subscriber');
  addHiddenField('source', window.location.pathname || '/');
  addHiddenField('subscription_type', 'Free HTL Guide updates');

  if (!form.querySelector('input[name="consent"]')) {
    const consentLabel = document.createElement('label');
    consentLabel.className = 'small muted';
    consentLabel.style.cssText = 'flex-basis:100%;display:flex;gap:.55rem;align-items:flex-start;line-height:1.45';

    const consent = document.createElement('input');
    consent.type = 'checkbox';
    consent.name = 'consent';
    consent.value = 'yes';
    consent.required = true;
    consent.style.marginTop = '.22rem';

    const consentText = document.createElement('span');
    consentText.textContent = 'I agree to receive occasional Free HTL Guide resource and module updates. I can unsubscribe at any time.';

    consentLabel.append(consent, consentText);
    form.appendChild(consentLabel);
  }

  let help = document.getElementById('emailSignupHelp');
  if (!help) {
    help = document.createElement('p');
    help.id = 'emailSignupHelp';
    help.className = 'small muted';
    help.style.flexBasis = '100%';
    help.textContent = 'No paid content is required. Your email is used only for the updates you request.';
    form.appendChild(help);
  }

  let status = document.getElementById('emailSignupStatus');
  if (!status) {
    status = document.createElement('p');
    status.id = 'emailSignupStatus';
    status.className = 'small';
    status.style.flexBasis = '100%';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.appendChild(status);
  }

  const setSubmitting = (submitting) => {
    form.dataset.submitting = submitting ? 'true' : 'false';
    form.setAttribute('aria-busy', String(submitting));
    submitButton.disabled = submitting;

    if (submitButton instanceof HTMLButtonElement) {
      if (!submitButton.dataset.originalText) submitButton.dataset.originalText = submitButton.textContent || 'Subscribe';
      submitButton.textContent = submitting ? 'Subscribing…' : submitButton.dataset.originalText;
    } else if (submitButton instanceof HTMLInputElement) {
      if (!submitButton.dataset.originalText) submitButton.dataset.originalText = submitButton.value || 'Subscribe';
      submitButton.value = submitting ? 'Subscribing…' : submitButton.dataset.originalText;
    }
  };

  const announce = (message, isError = false) => {
    status.textContent = message;
    status.style.color = isError ? '#b91c1c' : '';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === 'true') return;

    if (!form.reportValidity()) return;

    setSubmitting(true);
    announce('Submitting your request…');
    window.dispatchEvent(new CustomEvent('htl:email-signup-start', {
      detail: { formId: form.id, source: window.location.pathname }
    }));

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        let message = 'We could not complete the signup. Please check the address and try again.';
        try {
          const data = await response.json();
          const firstError = Array.isArray(data.errors) ? data.errors[0]?.message : null;
          if (firstError) message = firstError;
        } catch {
          // Keep the safe generic message when the provider does not return JSON.
        }
        throw new Error(message);
      }

      sessionStorage.setItem('free-htl-signup-success', '1');
      window.dispatchEvent(new CustomEvent('htl:email-signup-success', {
        detail: { formId: form.id, source: window.location.pathname }
      }));
      window.location.assign('thank-you.html?source=email-signup');
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'A network error prevented signup. Please try again.';
      announce(message, true);
      window.dispatchEvent(new CustomEvent('htl:email-signup-error', {
        detail: { formId: form.id, source: window.location.pathname, errorType: 'submission_error' }
      }));
      setSubmitting(false);
    }
  });
})();
