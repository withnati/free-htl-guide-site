(() => {
  'use strict';

  const script = document.currentScript
    || [...document.scripts].find((item) => /\/authority\.js(?:\?|$)/.test(item.src));

  if (!script?.src) return;

  const pageKey = document.body?.dataset?.page || '';
  const dataUrl = new URL('../data/module-authority.json', script.src);
  const stylesheetUrl = new URL('authority.css', script.src);
  const editorialUrl = new URL('../editorial.html', script.src);
  const cloudBootstrapUrl = new URL('cloud-sync-bootstrap.js', script.src);

  function loadCloudSyncBootstrap() {
    if (pageKey === 'account' || pageKey === 'my-progress') return;
    if (!localStorage.getItem('free-htl-cloud-sync-v1')) return;
    if (window.FreeHTLCloudSync || document.querySelector('script[data-free-htl-cloud-sync]')) return;
    const cloudScript = document.createElement('script');
    cloudScript.src = cloudBootstrapUrl.href;
    cloudScript.async = false;
    cloudScript.dataset.freeHtlCloudSync = 'true';
    document.head.appendChild(cloudScript);
  }

  loadCloudSyncBootstrap();

  function ensureStylesheet() {
    if (document.querySelector('link[data-free-htl-authority]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = stylesheetUrl.href;
    link.dataset.freeHtlAuthority = 'true';
    document.head.appendChild(link);
  }

  function formatDate(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  function makeLink(label, href, className = 'btn') {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.textContent = label;
    if (/^https?:/i.test(href)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return link;
  }

  function addTocLink() {
    const list = document.querySelector('.toc ol');
    if (!list || list.querySelector('a[href="#authority"]')) return;
    const item = document.createElement('li');
    item.appendChild(makeLink('Exam alignment', '#authority', ''));
    const quizItem = [...list.children].find((child) => child.querySelector('a[href="#quiz"]'));
    list.insertBefore(item, quizItem || null);
  }

  function buildAuthoritySection(module, guideline) {
    const section = document.createElement('section');
    section.id = 'authority';
    section.className = 'section card authority-card';
    section.dataset.authority = 'true';

    const heading = document.createElement('h2');
    heading.textContent = 'Exam alignment and editorial status';
    section.appendChild(heading);

    const intro = document.createElement('p');
    intro.textContent = 'This independent study module is mapped to the current public ASCP BOC HT/HTL content guideline. The mapping supports study planning; it does not reproduce examination items or imply ASCP endorsement.';
    section.appendChild(intro);

    const facts = [
      ['Primary content area', module.primaryArea],
      ['Published exam range', module.examWeight],
      ['Module version', module.version],
      ['Last editorial review', formatDate(module.reviewed)]
    ];

    const grid = document.createElement('dl');
    grid.className = 'authority-grid';
    facts.forEach(([term, description]) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'authority-fact';
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = description;
      wrapper.append(dt, dd);
      grid.appendChild(wrapper);
    });
    section.appendChild(grid);

    if (module.secondaryAreas?.length) {
      const secondary = document.createElement('p');
      secondary.className = 'small muted';
      secondary.innerHTML = `<strong>Related outline areas:</strong> ${module.secondaryAreas.join(', ')}.`;
      section.appendChild(secondary);
    }

    const topicsHeading = document.createElement('h3');
    topicsHeading.textContent = 'Mapped outline topics';
    section.appendChild(topicsHeading);

    const topics = document.createElement('ul');
    module.outlineTopics.forEach((topic) => {
      const item = document.createElement('li');
      item.textContent = topic;
      topics.appendChild(item);
    });
    section.appendChild(topics);

    const htl = document.createElement('div');
    htl.className = 'callout';
    htl.innerHTML = `<strong>HTL emphasis:</strong> ${module.htlEmphasis}`;
    section.appendChild(htl);

    const sop = document.createElement('div');
    sop.className = 'callout warn';
    sop.innerHTML = '<strong>SOP-dependent practice:</strong> Reagent concentrations, timing, instrument settings, acceptance criteria, safety controls, and escalation pathways must follow the learner’s current validated laboratory procedures, manufacturer instructions, and applicable regulations.';
    section.appendChild(sop);

    const sourceNote = document.createElement('p');
    sourceNote.className = 'small muted';
    sourceNote.textContent = `Alignment source: ${guideline.title}, revised ${formatDate(guideline.revised)}.`;
    section.appendChild(sourceNote);

    const links = document.createElement('div');
    links.className = 'authority-links';
    links.append(
      makeLink('Official content guideline', guideline.url),
      makeLink('Official reading list', guideline.readingList),
      makeLink('Editorial standards and corrections', editorialUrl.href)
    );
    section.appendChild(links);

    return section;
  }

  function addAuthoritySection(module, guideline) {
    if (document.querySelector('[data-authority]')) return;
    const objectives = document.getElementById('objectives');
    const article = document.querySelector('article.content');
    if (!article) return;
    const section = buildAuthoritySection(module, guideline);
    if (objectives) objectives.insertAdjacentElement('afterend', section);
    else article.prepend(section);
  }

  function updateStatus(module) {
    const status = document.querySelector('.hero-card .status');
    if (!status) return;
    status.textContent = `v${module.version} · Reviewed ${formatDate(module.reviewed)}`;
    status.title = 'Editorial version and review date';
  }

  function labelQuestions(module, definitions) {
    const questions = [...document.querySelectorAll('#quiz fieldset[data-correct]')];
    questions.forEach((fieldset, index) => {
      const difficulty = module.questionDifficulties[index];
      if (!difficulty) return;
      fieldset.dataset.difficulty = difficulty;
      const legend = fieldset.querySelector('legend');
      if (!legend || legend.querySelector('.difficulty')) return;
      const badge = document.createElement('span');
      badge.className = `difficulty difficulty-${difficulty.toLowerCase()}`;
      badge.textContent = difficulty;
      badge.title = definitions[difficulty] || `${difficulty} question`;
      legend.append(' ', badge);
    });
  }

  function enrichReferences(module, guideline) {
    const section = document.getElementById('references');
    if (!section || section.querySelector('[data-authority-sources]')) return;

    const details = document.createElement('details');
    details.className = 'authority-sources';
    details.dataset.authoritySources = 'true';
    const summary = document.createElement('summary');
    summary.textContent = 'Editorial source set used for this module';
    const list = document.createElement('ol');
    module.references.forEach((reference) => {
      const item = document.createElement('li');
      item.textContent = reference;
      list.appendChild(item);
    });
    details.append(summary, list);

    const official = document.createElement('p');
    official.className = 'small';
    official.append(
      makeLink('Open the current ASCP BOC guideline', guideline.url, ''),
      document.createTextNode(' · '),
      makeLink('Open the suggested reading list', guideline.readingList, ''),
      document.createTextNode(' · '),
      makeLink('View the corrections log', editorialUrl.href, '')
    );
    details.appendChild(official);
    section.appendChild(details);
  }

  function addAuthorityStructuredData(module, guideline) {
    if (document.getElementById('free-htl-authority-schema')) return;
    const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href.split('#')[0];
    const schema = document.createElement('script');
    schema.id = 'free-htl-authority-schema';
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      '@id': `${canonical}#authority`,
      name: module.title,
      url: canonical,
      version: module.version,
      dateModified: module.reviewed,
      educationalLevel: 'HT and HTL professional certification preparation',
      educationalAlignment: {
        '@type': 'AlignmentObject',
        alignmentType: 'exam content area',
        targetName: `${module.primaryArea} (${module.examWeight})`,
        targetUrl: guideline.url
      },
      isBasedOn: guideline.url,
      isAccessibleForFree: true
    });
    document.head.appendChild(schema);
  }

  async function init() {
    if (!pageKey || !window.location.pathname.includes('/modules/')) return;
    ensureStylesheet();

    try {
      const response = await fetch(dataUrl.href, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Authority metadata request returned ${response.status}`);
      const data = await response.json();
      const module = data.modules?.[pageKey];
      if (!module) throw new Error(`No authority metadata for ${pageKey}`);

      updateStatus(module);
      addTocLink();
      addAuthoritySection(module, data.examGuideline);
      labelQuestions(module, data.difficultyDefinitions || {});
      enrichReferences(module, data.examGuideline);
      addAuthorityStructuredData(module, data.examGuideline);
      document.body.dataset.authorityLoaded = 'true';
      window.dispatchEvent(new CustomEvent('htl:authority-ready', { detail: { page: pageKey, module } }));
    } catch (error) {
      document.body.dataset.authorityLoaded = 'error';
      console.warn('[Free HTL Guide] Authority metadata could not be loaded.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
