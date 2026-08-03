(() => {
  'use strict';

  const script = document.currentScript
    || [...document.scripts].find((item) => /\/seo\.js(?:\?|$)/.test(item.src));

  if (!script?.src) return;

  const dataUrl = new URL('../data/site-seo.json', script.src);
  const stylesheetUrl = new URL('seo.css', script.src);
  const runtimeRoot = new URL('../', script.src);
  const pageKey = document.body?.dataset?.page || '';

  function ensureStylesheet() {
    if (document.querySelector('link[data-free-htl-seo-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = stylesheetUrl.href;
    link.dataset.freeHtlSeoStyle = 'true';
    document.head.appendChild(link);
  }

  function setMeta(attribute, key, content) {
    if (!content) return;
    let meta = document.head.querySelector(`meta[${attribute}="${CSS.escape(key)}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, key);
      document.head.appendChild(meta);
    }
    meta.content = content;
  }

  function ensureLink(rel, href, attributes = {}) {
    let link = document.head.querySelector(`link[rel="${CSS.escape(rel)}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
    Object.entries(attributes).forEach(([name, value]) => link.setAttribute(name, value));
    return link;
  }

  function addJsonLd(id, value) {
    if (document.getElementById(id)) return;
    const node = document.createElement('script');
    node.id = id;
    node.type = 'application/ld+json';
    node.textContent = JSON.stringify(value);
    document.head.appendChild(node);
  }

  function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('Copy command failed'));
  }

  function dispatchShare(method, url) {
    window.dispatchEvent(new CustomEvent('htl:share', {
      detail: { method, page: pageKey, url }
    }));
  }

  function pageLabel(data, key) {
    const page = data.pages[key];
    return page?.breadcrumbs?.at(-1)?.name || key;
  }

  function addRelatedResources(data, page) {
    if (pageKey === 'home' || !page.related?.length || document.querySelector('[data-seo-related]')) return;
    const target = document.querySelector('article.content') || document.querySelector('main');
    if (!target) return;

    const section = document.createElement('section');
    section.className = 'section card seo-related';
    section.dataset.seoRelated = 'true';

    const heading = document.createElement('h2');
    heading.textContent = 'Related study resources';
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'seo-related-links';
    page.related.forEach((relatedKey) => {
      const related = data.pages[relatedKey];
      if (!related) return;
      const link = document.createElement('a');
      link.className = 'btn';
      link.href = new URL(related.path, runtimeRoot).href;
      link.textContent = pageLabel(data, relatedKey);
      list.appendChild(link);
    });
    section.appendChild(list);
    target.appendChild(section);
  }

  function addShareCard(data, page, title, description, canonical) {
    if (!page.share || document.querySelector('[data-seo-share]')) return;

    const wrapper = document.createElement('section');
    wrapper.className = `card seo-share${pageKey === 'home' ? ' seo-share-home' : ''}`;
    wrapper.dataset.seoShare = 'true';

    const heading = document.createElement('h2');
    heading.textContent = 'Share this free study resource';
    const copy = document.createElement('p');
    copy.className = 'small muted';
    copy.textContent = 'Share a preview card or copy the direct canonical link.';

    const actions = document.createElement('div');
    actions.className = 'seo-share-actions';
    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.className = 'btn btn-primary';
    shareButton.textContent = 'Share';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'btn';
    copyButton.textContent = 'Copy link';
    const status = document.createElement('p');
    status.className = 'small seo-share-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const shareUrl = new URL(data.site.sharePage, runtimeRoot);
    shareUrl.searchParams.set('p', pageKey);

    shareButton.addEventListener('click', async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title, text: description, url: shareUrl.href });
          status.textContent = 'Share options opened.';
          dispatchShare('native', shareUrl.href);
        } else {
          await copyText(shareUrl.href);
          status.textContent = 'Share-preview link copied.';
          dispatchShare('preview_copy', shareUrl.href);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') status.textContent = 'The link could not be shared. Use Copy link instead.';
      }
    });

    copyButton.addEventListener('click', async () => {
      try {
        await copyText(canonical);
        status.textContent = 'Direct link copied.';
        dispatchShare('canonical_copy', canonical);
      } catch (error) {
        status.textContent = 'Copy failed. Select the address from your browser.';
      }
    });

    actions.append(shareButton, copyButton);
    wrapper.append(heading, copy, actions, status);

    const rail = document.querySelector('.rail');
    if (rail) rail.appendChild(wrapper);
    else {
      const main = document.querySelector('main');
      if (main) main.appendChild(wrapper);
    }
  }

  function addBreadcrumbSchema(data, page, canonical) {
    if (!page.breadcrumbs?.length) return;
    addJsonLd('free-htl-breadcrumb-schema', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: page.breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: index === page.breadcrumbs.length - 1
          ? canonical
          : new URL(crumb.path, data.site.url).href
      }))
    });
  }

  function addPageSchema(data, page, title, description, canonical, image) {
    addJsonLd('free-htl-page-schema', {
      '@context': 'https://schema.org',
      '@type': page.type === 'profile' ? 'ProfilePage' : 'WebPage',
      '@id': `${canonical}#webpage`,
      name: title,
      description,
      url: canonical,
      inLanguage: data.site.language,
      dateModified: data.site.updated,
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${data.site.url}#website`,
        name: data.site.name,
        url: data.site.url
      },
      author: {
        '@type': 'Person',
        name: data.site.author.name,
        url: new URL(data.site.author.url, data.site.url).href
      },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: image,
        width: data.site.imageWidth,
        height: data.site.imageHeight,
        caption: data.site.imageAlt
      }
    });
  }

  function applyMetadata(data, page) {
    const canonical = document.querySelector('link[rel="canonical"]')?.href
      || new URL(page.path === 'index.html' ? '' : page.path, data.site.url).href;
    const title = document.title.trim();
    const description = document.querySelector('meta[name="description"]')?.content?.trim() || '';
    const image = new URL(data.site.defaultImage, data.site.url).href;

    setMeta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setMeta('name', 'author', data.site.author.name);
    setMeta('name', 'application-name', data.site.name);
    setMeta('name', 'apple-mobile-web-app-title', data.site.name);

    setMeta('property', 'og:type', page.type);
    setMeta('property', 'og:site_name', data.site.name);
    setMeta('property', 'og:locale', 'en_US');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:width', String(data.site.imageWidth));
    setMeta('property', 'og:image:height', String(data.site.imageHeight));
    setMeta('property', 'og:image:alt', data.site.imageAlt);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setMeta('name', 'twitter:image:alt', data.site.imageAlt);

    if (page.type === 'article') {
      setMeta('property', 'article:section', page.section);
      setMeta('property', 'article:modified_time', `${data.site.updated}T00:00:00Z`);
    }

    ensureLink('manifest', new URL(data.site.manifest, runtimeRoot).href);
    ensureLink('icon', new URL(data.site.icon, runtimeRoot).href, { type: 'image/svg+xml', sizes: 'any' });

    addBreadcrumbSchema(data, page, canonical);
    addPageSchema(data, page, title, description, canonical, image);
    addRelatedResources(data, page);
    addShareCard(data, page, title, description, canonical);
  }

  async function init() {
    const robots = document.querySelector('meta[name="robots"]')?.content?.toLowerCase() || '';
    if (!pageKey || robots.includes('noindex')) return;
    ensureStylesheet();

    try {
      const response = await fetch(dataUrl.href, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`SEO metadata request returned ${response.status}`);
      const data = await response.json();
      const page = data.pages?.[pageKey];
      if (!page) throw new Error(`No SEO metadata for ${pageKey}`);
      applyMetadata(data, page);
      document.body.dataset.seoLoaded = 'true';
      window.dispatchEvent(new CustomEvent('htl:seo-ready', { detail: { page: pageKey } }));
    } catch (error) {
      document.body.dataset.seoLoaded = 'error';
      console.warn('[Free HTL Guide] SEO metadata could not be loaded.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
