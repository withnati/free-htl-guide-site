(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = document.body.dataset.page || window.location.pathname;
  const root = document.documentElement;
  const themeKey = 'htl-theme';

  function loadAnalytics() {
    const guideScript = [...document.scripts].find((script) => /\/guide\.js(?:\?|$)/.test(script.src));
    if (!guideScript || document.querySelector('script[data-free-htl-analytics]')) return;

    const analyticsScript = document.createElement('script');
    analyticsScript.src = new URL('analytics.js', guideScript.src).href;
    analyticsScript.async = true;
    analyticsScript.dataset.freeHtlAnalytics = 'true';
    document.head.appendChild(analyticsScript);
  }

  function addJsonLd(id, data) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function canonicalUrl() {
    return $('link[rel="canonical"]')?.href || window.location.href.split('#')[0];
  }

  function addStructuredData() {
    const siteUrl = 'https://withnati.github.io/free-htl-guide-site/';
    const organizationId = `${siteUrl}#organization`;
    const personId = `${siteUrl}about.html#natnale-mengesha`;
    const title = $('h1')?.textContent.trim() || document.title;
    const description = $('meta[name="description"]')?.content || '';

    if (page === 'home') {
      const resources = [
        ['Fixation Study Guide', 'Fixation mechanisms, artifacts, safety, and QC.', 'modules/fixation-guide-v3.html'],
        ['Processing and Decalcification Study Guide', 'Processing, schedules, decalcification, and QC.', 'modules/processing-guide-v3.html'],
        ['Embedding and Microtomy Study Guide', 'Orientation, sectioning, cryostat work, and artifacts.', 'modules/embedding-guide-v3.html'],
        ['Routine H&E Staining Study Guide', 'Hematoxylin, eosin, stain balance, artifacts, and QC.', 'modules/staining-he-guide.html'],
        ['Special Stains Study Guide', 'Targets, chemistry, controls, colors, and troubleshooting.', 'modules/special-stains-guide.html'],
        ['Laboratory Operations Study Guide', 'Quality systems, safety, equipment, validation, and CAPA.', 'modules/lab-operations-guide.html'],
        ['IHC and ISH Fundamentals', 'Controls, retrieval, detection, validation, and troubleshooting.', 'modules/ihc-ish-guide.html']
      ];

      addJsonLd('free-htl-home-schema', {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': organizationId,
            name: 'Free HTL Guide',
            url: siteUrl,
            logo: `${siteUrl}assets/favicon-32.png`,
            founder: { '@id': personId }
          },
          {
            '@type': 'Person',
            '@id': personId,
            name: 'Natnale Mengesha',
            honorificSuffix: 'HTL(ASCP)cm',
            url: `${siteUrl}about.html`,
            worksFor: { '@id': organizationId },
            knowsAbout: ['Histotechnology', 'Molecular pathology', 'Immunohistochemistry', 'In situ hybridization', 'Digital pathology']
          },
          {
            '@type': 'ItemList',
            name: 'Free HT and HTL Study Guides',
            itemListOrder: 'https://schema.org/ItemListOrderAscending',
            numberOfItems: resources.length,
            itemListElement: resources.map(([name, resourceDescription, path], index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'LearningResource',
                name,
                description: resourceDescription,
                url: new URL(path, siteUrl).href,
                inLanguage: 'en-US',
                isAccessibleForFree: true,
                learningResourceType: 'Study guide',
                educationalLevel: 'Professional certification preparation',
                provider: { '@id': organizationId },
                author: { '@id': personId }
              }
            }))
          }
        ]
      });
      return;
    }

    if (window.location.pathname.includes('/modules/') || page === 'study-plan' || page === 'cumulative-practice') {
      addJsonLd('free-htl-learning-resource-schema', {
        '@context': 'https://schema.org',
        '@type': 'LearningResource',
        name: title,
        description,
        url: canonicalUrl(),
        inLanguage: 'en-US',
        isAccessibleForFree: true,
        learningResourceType: page === 'cumulative-practice' ? 'Practice questions' : (page === 'study-plan' ? 'Study plan' : 'Study guide'),
        educationalLevel: 'Professional certification preparation',
        provider: {
          '@type': 'Organization',
          '@id': organizationId,
          name: 'Free HTL Guide',
          url: siteUrl
        },
        author: {
          '@type': 'Person',
          '@id': personId,
          name: 'Natnale Mengesha',
          honorificSuffix: 'HTL(ASCP)cm'
        }
      });
    }

    if (window.location.pathname.includes('/modules/')) {
      addJsonLd('free-htl-breadcrumb-schema', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteUrl
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Study modules',
            item: `${siteUrl}#modules`
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: title,
            item: canonicalUrl()
          }
        ]
      });
    }
  }

  const themeButton = $('#themeBtn');

  function setTheme(value) {
    root.classList.toggle('dark', value === 'dark');
    localStorage.setItem(themeKey, value);
    if (themeButton) themeButton.textContent = value === 'dark' ? '☀️' : '🌙';
  }

  setTheme(
    localStorage.getItem(themeKey) ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  themeButton?.addEventListener('click', () => {
    setTheme(root.classList.contains('dark') ? 'light' : 'dark');
  });

  const menuButton = $('#menuBtn');
  const mobileMenu = $('#mobileMenu');

  menuButton?.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  $$('#mobileMenu a').forEach((link) => {
    link.addEventListener('click', () => mobileMenu?.classList.remove('open'));
  });

  $$('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  const progressFill = $('#progressFill');

  function updateProgress() {
    if (!progressFill) return;
    const documentElement = document.documentElement;
    const maximum = documentElement.scrollHeight - documentElement.clientHeight;
    const percent = maximum ? Math.min(100, (documentElement.scrollTop / maximum) * 100) : 0;
    progressFill.style.width = `${percent}%`;
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  const tocLinks = $$('.toc a[href^="#"]');
  const sections = $$('.section[id]');

  if ('IntersectionObserver' in window && tocLinks.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocLinks.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
        localStorage.setItem(`last:${page}`, entry.target.id);
      });
    }, { rootMargin: '-38% 0px -54% 0px' });

    sections.forEach((section) => observer.observe(section));
  }

  $('[data-resume]')?.addEventListener('click', (event) => {
    const lastSection = localStorage.getItem(`last:${page}`);
    if (!lastSection) return;
    event.preventDefault();
    window.location.hash = lastSection;
  });

  $$('[data-note]').forEach((area) => {
    const key = `note:${page}:${area.dataset.note}`;
    area.value = localStorage.getItem(key) || '';
    area.addEventListener('input', () => localStorage.setItem(key, area.value));
  });

  $$('[data-check]').forEach((box) => {
    const key = `check:${page}:${box.dataset.check}`;
    box.checked = localStorage.getItem(key) === '1';
    box.addEventListener('change', () => {
      localStorage.setItem(key, box.checked ? '1' : '0');
      window.dispatchEvent(new CustomEvent('htl:study-task', {
        detail: {
          page,
          taskId: box.dataset.check,
          checked: box.checked
        }
      }));
    });
  });

  function grade(form) {
    let score = 0;
    let total = 0;

    $$('fieldset[data-correct]', form).forEach((fieldset) => {
      total += 1;
      fieldset.classList.remove('correct', 'incorrect');

      const chosen = $('input:checked', fieldset);
      const correct = fieldset.dataset.correct;
      const explanation = $('.explanation', fieldset);

      if (chosen && chosen.value === correct) {
        score += 1;
        fieldset.classList.add('correct');
        if (explanation) explanation.textContent = `Correct. ${fieldset.dataset.expl || ''}`;
      } else {
        fieldset.classList.add('incorrect');
        if (explanation) explanation.textContent = `Review: ${fieldset.dataset.expl || ''}`;
      }

      if (explanation) explanation.hidden = false;
    });

    const percent = total ? Math.round((score / total) * 100) : 0;
    const result = $('.quiz-result', form.parentElement) || $('#quizResult');

    if (result) {
      result.hidden = false;
      result.textContent = `Score: ${score}/${total} (${percent}%). ${percent >= 80 ? 'Target met.' : 'Review the explanations and try again.'}`;
    }

    localStorage.setItem(`quiz:${page}`, String(percent));

    const bestDisplay = $('[data-best]');
    const previousBest = Number(localStorage.getItem(`best:${page}`) || 0);
    if (percent > previousBest) localStorage.setItem(`best:${page}`, String(percent));
    if (bestDisplay) bestDisplay.textContent = `Best: ${Math.max(previousBest, percent)}%`;

    window.dispatchEvent(new CustomEvent('htl:quiz-graded', {
      detail: {
        page,
        quizId: form.id,
        score,
        total,
        percent,
        targetMet: percent >= 80
      }
    }));
  }

  $$('[data-grade]').forEach((button) => {
    button.addEventListener('click', () => {
      const form = document.getElementById(button.dataset.grade);
      if (form) grade(form);
    });
  });

  $$('[data-retry]').forEach((button) => {
    button.addEventListener('click', () => {
      const form = document.getElementById(button.dataset.retry);
      if (!form) return;

      form.reset();
      $$('fieldset', form).forEach((fieldset) => fieldset.classList.remove('correct', 'incorrect'));
      $$('.explanation', form).forEach((explanation) => {
        explanation.hidden = true;
        explanation.textContent = '';
      });

      const result = $('.quiz-result', form.parentElement);
      if (result) result.hidden = true;

      window.dispatchEvent(new CustomEvent('htl:quiz-reset', {
        detail: {
          page,
          quizId: form.id
        }
      }));
    });
  });

  const bestDisplay = $('[data-best]');
  if (bestDisplay) {
    const bestValue = localStorage.getItem(`best:${page}`);
    bestDisplay.textContent = `Best: ${bestValue ? `${bestValue}%` : '—'}`;
  }

  $$('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy || '');
        const previousText = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(() => { button.textContent = previousText; }, 1200);
      } catch {
        window.alert('Copy failed. Select and copy manually.');
      }
    });
  });

  if (page === 'home') {
    $$('.chips .chip').forEach((element) => {
      if (element.textContent.trim() === '68 practice questions') {
        element.textContent = '70+ practice questions';
      }
    });

    $$('.profile .small.muted').forEach((element) => {
      if (element.textContent.includes('Profile image')) element.remove();
    });
  }

  addStructuredData();
  loadAnalytics();
})();
