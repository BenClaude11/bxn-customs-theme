/* BXN Customs PayID store. Products, settings and policies are loaded from
   assets/data/*.json and content/policies/*.md, which are edited through /admin. */
(function () {
  'use strict';

  var SETTINGS = {};
  var PRODUCTS = [];
  var CART_KEY = 'bxn_cart_v2';
  var ORDER_KEY = 'bxn_last_order_v1';

  /* ---------------- Helpers ---------------- */
  function cents(dollars) { return Math.round((Number(dollars) || 0) * 100); }
  function money(c) { return '$' + (c / 100).toFixed(2); }
  function moneyShort(c) { return money(c).replace('.00', ''); }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Small Markdown renderer for descriptions and policies: headings (##),
  // lists (-), quotes (>), **bold**, *italic*, [links](url) and line breaks.
  function inlineMd(text) {
    var out = escapeHtml(text);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
      var safe = /^(https?:|mailto:|tel:|[a-z0-9_\-./?=&#%]+$)/i.test(url) ? url : '#';
      return '<a href="' + safe + '">' + label + '</a>';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/ {2,}\n/g, '<br>');
    return out;
  }

  function md(text) {
    if (!text) return '';
    var blocks = String(text).replace(/\r\n/g, '\n').split(/\n{2,}/);
    return blocks.map(function (block) {
      var lines = block.split('\n');
      var heading = block.match(/^(#{1,4})\s+(.*)$/);
      if (heading && lines.length === 1) {
        var level = Math.max(2, Math.min(4, heading[1].length));
        return '<h' + level + '>' + inlineMd(heading[2]) + '</h' + level + '>';
      }
      if (lines.every(function (l) { return /^\s*[-*]\s+/.test(l); })) {
        return '<ul>' + lines.map(function (l) { return '<li>' + inlineMd(l.replace(/^\s*[-*]\s+/, '')) + '</li>'; }).join('') + '</ul>';
      }
      if (lines.every(function (l) { return /^\s*\d+[.)]\s+/.test(l); })) {
        return '<ol>' + lines.map(function (l) { return '<li>' + inlineMd(l.replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; }).join('') + '</ol>';
      }
      if (lines.every(function (l) { return /^>/.test(l); })) {
        return '<blockquote>' + md(lines.map(function (l) { return l.replace(/^>\s?/, ''); }).join('\n')) + '</blockquote>';
      }
      return '<p>' + inlineMd(block) + '</p>';
    }).join('');
  }

  function storageGet(key, fallback) {
    try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }

  function isConfigured(value) { return value && String(value).indexOf('REPLACE_WITH') !== 0; }

  function shippingRate() { return cents(SETTINGS.shippingFlatRate); }
  function freeThreshold() { return cents(SETTINGS.freeShippingThreshold); }

  function findProduct(handle) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].handle === handle) return PRODUCTS[i];
    return null;
  }

  function productUrl(p) { return 'product.html?p=' + encodeURIComponent(p.handle); }

  function normaliseProducts(list) {
    return (list || []).filter(function (p) { return p && p.handle && p.title; }).map(function (p) {
      return {
        title: p.title,
        handle: p.handle,
        type: p.type || '',
        price: cents(p.price),
        soldOut: !!p.soldOut,
        images: (p.images || []).filter(Boolean),
        videos: (p.videos || []).filter(Boolean),
        variants: (p.variants || []).filter(function (v) { return v && v.name; }),
        description: p.description || '',
        installVideo: p.installVideo || '',
        installVideoPoster: p.installVideoPoster || ''
      };
    });
  }

  /* ---------------- Cart ---------------- */
  var memoryCart = null;

  function lineKey(handle, variant) { return handle + '|' + (variant || ''); }

  function getCart() {
    if (memoryCart) return memoryCart;
    var stored = storageGet(CART_KEY, []);
    memoryCart = (Array.isArray(stored) ? stored : []).filter(function (l) {
      var p = findProduct(l.handle);
      return p && l.qty > 0 && (!l.variant || p.variants.some(function (v) { return v.name === l.variant; }));
    });
    return memoryCart;
  }

  function saveCart(cart) {
    memoryCart = cart;
    storageSet(CART_KEY, cart);
    renderCartUI();
  }

  function addToCart(handle, variant, qty) {
    var cart = getCart().slice();
    var key = lineKey(handle, variant);
    var existing = cart.filter(function (l) { return lineKey(l.handle, l.variant) === key; })[0];
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else cart.push({ handle: handle, variant: variant || '', qty: qty });
    saveCart(cart);
  }

  function setLineQty(key, qty) {
    var cart = getCart().map(function (l) {
      return lineKey(l.handle, l.variant) === key ? { handle: l.handle, variant: l.variant, qty: qty } : l;
    }).filter(function (l) { return l.qty > 0; });
    saveCart(cart);
  }

  function variantImage(p, variantName) {
    var v = p.variants.filter(function (x) { return x.name === variantName; })[0];
    return (v && v.image) || p.images[0] || '';
  }

  function cartDetails() {
    var lines = getCart().map(function (l) {
      var p = findProduct(l.handle);
      return {
        key: lineKey(l.handle, l.variant),
        handle: l.handle,
        variant: l.variant,
        qty: l.qty,
        product: p,
        image: variantImage(p, l.variant),
        lineTotal: p.price * l.qty
      };
    });
    var subtotal = lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);
    var count = lines.reduce(function (s, l) { return s + l.qty; }, 0);
    var shipping = shippingFor(subtotal);
    return { lines: lines, subtotal: subtotal, count: count, shipping: shipping, total: subtotal + shipping };
  }

  function shippingFor(subtotal) {
    if (subtotal <= 0) return 0;
    if (freeThreshold() > 0 && subtotal >= freeThreshold()) return 0;
    return shippingRate();
  }

  /* ---------------- Layout ---------------- */
  var CART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></svg>';

  function policyLink(slug, label) { return '<a href="policy.html?p=' + slug + '">' + label + '</a>'; }

  function shippingSummary() {
    var text = money(shippingRate()) + ' flat shipping Australia-wide';
    if (freeThreshold() > 0) text += '. Free over ' + moneyShort(freeThreshold());
    return text + '.';
  }

  function renderLayout() {
    var header = document.getElementById('SiteHeader');
    if (header) {
      header.className = 'site-header';
      header.innerHTML =
        '<div class="container site-header__inner">' +
          '<a class="site-header__logo" href="index.html">' + escapeHtml(SETTINGS.businessName || 'BXN Customs') + '</a>' +
          '<nav class="site-header__nav" aria-label="Main">' +
            '<a href="shop.html">Shop all</a>' +
            '<a href="contact.html">Contact</a>' +
          '</nav>' +
          '<button type="button" class="site-header__cart" id="CartButton" aria-label="Open cart">' +
            CART_ICON + '<span class="site-header__count" id="CartCount"></span>' +
          '</button>' +
        '</div>';
    }

    var footer = document.getElementById('SiteFooter');
    if (footer) {
      footer.className = 'site-footer';
      footer.innerHTML =
        '<div class="container">' +
          '<div class="site-footer__row">' +
            '<div>' +
              '<p class="site-footer__brand">' + escapeHtml(SETTINGS.businessName || 'BXN Customs') + '</p>' +
              '<p style="margin:0">ABN ' + escapeHtml(SETTINGS.abn || '') + '</p>' +
              '<p style="margin:4px 0 0"><a href="mailto:' + escapeHtml(SETTINGS.contactEmail) + '">' + escapeHtml(SETTINGS.contactEmail) + '</a></p>' +
              '<span class="site-footer__pay">Pay by PayID or bank transfer</span>' +
            '</div>' +
            '<nav class="site-footer__links" aria-label="Policies">' +
              '<a href="shop.html">Shop all</a>' +
              '<a href="contact.html">Contact</a>' +
              policyLink('shipping-policy', 'Shipping') +
              policyLink('refund-policy', 'Refunds') +
              policyLink('terms-of-service', 'Terms') +
              policyLink('privacy-policy', 'Privacy') +
              policyLink('legal-notice', 'Legal notice') +
            '</nav>' +
          '</div>' +
          '<p style="margin:24px 0 0">&copy; ' + new Date().getFullYear() + ' ' + escapeHtml(SETTINGS.businessName || 'BXN Customs') + '. Shipping within Australia.</p>' +
        '</div>';
    }

    var drawer = document.createElement('div');
    drawer.className = 'drawer';
    drawer.id = 'CartDrawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="drawer__overlay" data-drawer-close></div>' +
      '<div class="drawer__panel" id="CartPanel" role="dialog" aria-modal="true" aria-labelledby="CartTitle" tabindex="-1">' +
        '<div class="drawer__header">' +
          '<h2 class="drawer__title" id="CartTitle">Your cart <span id="CartDrawerCount"></span></h2>' +
          '<button type="button" class="drawer__close" id="CartClose" aria-label="Close cart" data-drawer-close>&times;</button>' +
        '</div>' +
        freeShippingMarkup() +
        '<div class="drawer__items" id="CartItems"></div>' +
        '<div class="drawer__footer" id="CartFooter">' +
          '<div class="drawer__row"><span>Subtotal</span><span id="CartSubtotal"></span></div>' +
          '<p class="drawer__note">' + shippingSummary() + ' Pay by PayID at checkout.</p>' +
          '<a href="checkout.html" class="button button--primary button--full">Checkout</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(drawer);
  }

  function freeShippingMarkup() {
    if (freeThreshold() <= 0) return '';
    return '<div class="free-ship" data-free-ship>' +
      '<p class="free-ship__msg" data-free-ship-msg></p>' +
      '<div class="free-ship__track" role="progressbar" aria-label="Progress to free shipping" aria-valuemin="0" aria-valuemax="100">' +
        '<div class="free-ship__fill" data-free-ship-fill></div>' +
      '</div>' +
    '</div>';
  }

  function lineMarkup(line, editable) {
    var title = escapeHtml(line.product.title);
    var variant = line.variant ? '<p class="line__variant">' + escapeHtml(line.variant) + '</p>' : '';
    var qty = editable
      ? '<div class="qty" data-key="' + escapeHtml(line.key) + '">' +
          '<button type="button" data-qty-dec aria-label="Decrease quantity of ' + title + '">&minus;</button>' +
          '<span>' + line.qty + '</span>' +
          '<button type="button" data-qty-inc aria-label="Increase quantity of ' + title + '">+</button>' +
        '</div>'
      : '<p class="line__variant">Qty ' + line.qty + '</p>';
    return '<div class="line">' +
      '<div class="line__image">' + (line.image ? '<img src="' + escapeHtml(line.image) + '" alt="" width="72" height="72">' : '') + '</div>' +
      '<div class="line__details"><p class="line__title">' + title + '</p>' + variant + qty + '</div>' +
      '<div class="line__end"><span>' + money(line.lineTotal) + '</span>' +
        (editable ? '<button type="button" class="line__remove" data-remove="' + escapeHtml(line.key) + '">Remove</button>' : '') +
      '</div>' +
    '</div>';
  }

  var onCartChange = null;

  function renderCartUI() {
    var d = cartDetails();
    var countEl = document.getElementById('CartCount');
    if (countEl) countEl.textContent = d.count > 0 ? d.count : '';
    var drawerCount = document.getElementById('CartDrawerCount');
    if (drawerCount) drawerCount.textContent = d.count > 0 ? '(' + d.count + ')' : '';

    var items = document.getElementById('CartItems');
    var footer = document.getElementById('CartFooter');
    if (items) {
      if (!d.lines.length) {
        items.innerHTML = '<div class="drawer__empty"><p>Your cart is empty.</p>' +
          '<a href="shop.html" class="button button--primary" data-drawer-close>Shop parts</a></div>';
        if (footer) footer.hidden = true;
      } else {
        items.innerHTML = d.lines.map(function (l) { return lineMarkup(l, true); }).join('');
        if (footer) footer.hidden = false;
      }
    }
    var subtotalEl = document.getElementById('CartSubtotal');
    if (subtotalEl) subtotalEl.textContent = money(d.subtotal);

    renderFreeShipping(d);
    if (onCartChange) onCartChange(d);
  }

  function renderFreeShipping(d) {
    var threshold = freeThreshold();
    if (threshold <= 0) return;
    var remaining = threshold - d.subtotal;
    var percent = Math.min(100, Math.round((d.subtotal / threshold) * 100));
    document.querySelectorAll('[data-free-ship]').forEach(function (bar) {
      var msg = bar.querySelector('[data-free-ship-msg]');
      if (msg) {
        if (d.count === 0) msg.innerHTML = 'Free shipping on orders over <strong>' + moneyShort(threshold) + '</strong>';
        else if (remaining > 0) msg.innerHTML = 'You\'re <strong>' + money(remaining) + '</strong> away from free shipping';
        else msg.innerHTML = 'You\'ve unlocked <strong>free shipping</strong>';
      }
      var fill = bar.querySelector('[data-free-ship-fill]');
      if (fill) fill.style.width = percent + '%';
      var track = bar.querySelector('[role="progressbar"]');
      if (track) track.setAttribute('aria-valuenow', percent);
      bar.classList.toggle('is-complete', d.count > 0 && remaining <= 0);
    });
  }

  /* ---------------- Drawer ---------------- */
  var lastTrigger = null;
  var lockedY = 0;

  function lockScroll() {
    lockedY = window.scrollY || 0;
    var s = document.body.style;
    s.position = 'fixed'; s.top = '-' + lockedY + 'px'; s.left = '0'; s.right = '0'; s.width = '100%';
  }
  function unlockScroll() {
    var s = document.body.style;
    s.position = ''; s.top = ''; s.left = ''; s.right = ''; s.width = '';
    window.scrollTo(0, lockedY);
  }

  function openDrawer(trigger) {
    var drawer = document.getElementById('CartDrawer');
    if (!drawer || drawer.classList.contains('is-open')) return;
    lastTrigger = trigger || document.activeElement;
    renderCartUI();
    lockScroll();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    var close = document.getElementById('CartClose');
    if (close) setTimeout(function () { close.focus({ preventScroll: true }); }, 50);
  }

  function closeDrawer() {
    var drawer = document.getElementById('CartDrawer');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    unlockScroll();
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus({ preventScroll: true });
  }

  function initDrawer() {
    var button = document.getElementById('CartButton');
    if (button) button.addEventListener('click', function () { openDrawer(button); });

    var drawer = document.getElementById('CartDrawer');
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-drawer-close]')) { closeDrawer(); return; }
      var qty = e.target.closest('.qty[data-key]');
      if (qty) {
        var key = qty.getAttribute('data-key');
        var line = cartDetails().lines.filter(function (l) { return l.key === key; })[0];
        if (!line) return;
        if (e.target.closest('[data-qty-inc]')) setLineQty(key, Math.min(99, line.qty + 1));
        if (e.target.closest('[data-qty-dec]')) setLineQty(key, line.qty - 1);
      }
      var remove = e.target.closest('[data-remove]');
      if (remove) setLineQty(remove.getAttribute('data-remove'), 0);
    });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    var panel = document.getElementById('CartPanel');
    var startX = 0, startY = 0, dx = 0, dragging = false;
    panel.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0; dragging = false;
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      var mx = e.touches[0].clientX - startX;
      var my = e.touches[0].clientY - startY;
      if (!dragging && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my)) dragging = true;
      if (!dragging) return;
      dx = Math.max(0, mx);
      panel.style.transition = 'none';
      panel.style.transform = 'translateX(' + dx + 'px)';
    }, { passive: true });
    panel.addEventListener('touchend', function () {
      if (!dragging) return;
      panel.style.transition = '';
      panel.style.transform = '';
      if (dx > 80) closeDrawer();
      dragging = false;
    });
  }

  /* ---------------- Product cards, carousel and shop page ---------------- */
  function cardMarkup(p) {
    return '<a class="product-card" href="' + productUrl(p) + '">' +
      '<div class="product-card__image">' +
        (p.images[0] ? '<img src="' + escapeHtml(p.images[0]) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">' : '') +
        (p.soldOut ? '<span class="product-card__badge">Sold out</span>' : '') +
      '</div>' +
      '<p class="product-card__type">' + escapeHtml(p.type) + '</p>' +
      '<p class="product-card__title">' + escapeHtml(p.title) + '</p>' +
      '<p class="product-card__price">' + money(p.price) + '</p>' +
    '</a>';
  }

  function initHome() {
    var hero = document.getElementById('Hero');
    if (hero) {
      var heading = (SETTINGS.heroHeading || '').split(/\s*\n\s*/).map(escapeHtml).join('<br>');
      var video = SETTINGS.heroVideo
        ? '<video class="hero__video" src="' + escapeHtml(SETTINGS.heroVideo) + '"' +
            (SETTINGS.heroPoster ? ' poster="' + escapeHtml(SETTINGS.heroPoster) + '"' : '') +
            ' autoplay muted loop playsinline preload="auto"></video>'
        : (SETTINGS.heroPoster ? '<img class="hero__video" src="' + escapeHtml(SETTINGS.heroPoster) + '" alt="">' : '');
      hero.innerHTML = video +
        '<div class="container hero__content">' +
          '<h1 class="hero__heading">' + heading + '</h1>' +
          '<a class="button button--primary" href="shop.html">Shop parts &rarr;</a>' +
        '</div>';
    }

    var track = document.getElementById('CarouselTrack');
    if (track) {
      track.innerHTML = PRODUCTS.map(function (p) { return '<div class="carousel__slide">' + cardMarkup(p) + '</div>'; }).join('');
      var prev = document.getElementById('CarouselPrev');
      var next = document.getElementById('CarouselNext');
      var step = function (dir) {
        var slide = track.querySelector('.carousel__slide');
        var amount = slide ? slide.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
        track.scrollBy({ left: dir * amount, behavior: 'smooth' });
      };
      var updateArrows = function () {
        var max = track.scrollWidth - track.clientWidth - 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max;
        document.getElementById('CarouselControls').hidden = track.scrollWidth <= track.clientWidth + 2;
      };
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      track.addEventListener('scroll', updateArrows, { passive: true });
      window.addEventListener('resize', updateArrows);
      updateArrows();
    }
  }

  function initShop() {
    var grid = document.getElementById('ShopGrid');
    if (!grid) return;
    grid.innerHTML = PRODUCTS.length
      ? PRODUCTS.map(cardMarkup).join('')
      : '<p style="color:var(--muted)">New parts coming soon.</p>';
  }

  /* ---------------- Product page ---------------- */
  function initProduct() {
    var root = document.getElementById('ProductRoot');
    if (!root) return;
    var handle = new URLSearchParams(window.location.search).get('p');
    var p = findProduct(handle) || (PRODUCTS.length === 1 ? PRODUCTS[0] : null);
    if (!p) {
      root.innerHTML = '<div class="container page"><h1 class="page__heading">Product not found</h1><a class="button button--primary" href="shop.html">Back to shop</a></div>';
      return;
    }
    document.title = p.title + ' – ' + (SETTINGS.businessName || 'BXN Customs');

    var media = p.images.map(function (src) { return { type: 'image', src: src }; })
      .concat(p.videos.map(function (src) { return { type: 'video', src: src }; }));

    var thumbs = media.length > 1
      ? '<div class="product__thumbs">' + media.map(function (m, i) {
          var inner = m.type === 'image'
            ? '<img src="' + escapeHtml(m.src) + '" alt="">'
            : '<span class="product__thumb-play" aria-hidden="true">&#9654;</span>';
          return '<button type="button" class="product__thumb' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '" aria-label="Show ' + (m.type === 'video' ? 'video' : 'image') + ' ' + (i + 1) + '">' + inner + '</button>';
        }).join('') + '</div>'
      : '';

    var variants = p.variants.length
      ? '<div class="variants"><p class="variants__label">Colour: <span id="VariantLabel">' + escapeHtml(p.variants[0].name) + '</span></p><div class="variants__options">' +
          p.variants.map(function (v, i) {
            return '<button type="button" class="variant' + (i === 0 ? ' is-active' : '') + (v.soldOut ? ' is-soldout' : '') + '" data-variant="' + escapeHtml(v.name) + '"' + (v.soldOut ? ' aria-disabled="true"' : '') + '>' + escapeHtml(v.name) + '</button>';
          }).join('') + '</div></div>'
      : '';

    var installVideo = p.installVideo
      ? '<div class="install-video"><video src="' + escapeHtml(p.installVideo) + '"' + (p.installVideoPoster ? ' poster="' + escapeHtml(p.installVideoPoster) + '"' : '') + ' controls preload="metadata" playsinline></video></div>'
      : '';

    root.innerHTML =
      '<div class="container product">' +
        '<div>' +
          '<div class="product__main-image" id="MainMedia"></div>' +
          thumbs +
        '</div>' +
        '<div>' +
          '<a class="product__back" href="shop.html">&larr; Shop all</a>' +
          '<p class="product__type">' + escapeHtml(p.type) + '</p>' +
          '<h1 class="product__title">' + escapeHtml(p.title) + '</h1>' +
          '<p class="product__price">' + money(p.price) + '</p>' +
          '<p class="product__price-note">' + shippingSummary() + '</p>' +
          variants +
          '<div class="product__buy">' +
            '<div class="qty" id="ProductQty"><button type="button" data-dec aria-label="Decrease quantity">&minus;</button><span id="ProductQtyValue">1</span><button type="button" data-inc aria-label="Increase quantity">+</button></div>' +
            '<button type="button" class="button button--primary" id="AddToCart">Add to cart</button>' +
          '</div>' +
          '<div class="product__pay-note"><span aria-hidden="true">⚡</span><span><strong>Pay by PayID.</strong> Instant bank transfer, no card needed. You\'ll get the payment details at checkout and we ship as soon as it lands.</span></div>' +
          '<ul class="trust">' +
            '<li>Faulty or damaged? Repaired, replaced or refunded under Australian Consumer Law</li>' +
            '<li>We cover return postage on faulty or incorrect items</li>' +
            '<li>Not sure it fits? <a href="contact.html">Ask us before you buy</a></li>' +
          '</ul>' +
          '<details class="accordion" open><summary>Description</summary><div class="accordion__body">' + md(p.description) + '</div></details>' +
          '<details class="accordion"><summary>Installation &amp; safety</summary><div class="accordion__body">' + installVideo +
            '<div class="warnings"><p><strong>Before you install</strong></p><ul>' +
              '<li>Check the product suits your bike before connecting anything.</li>' +
              '<li>Disconnect or switch off the battery before working on the electrical system.</li>' +
              '<li>Never bypass or disable brakes, brake cut-off switches, the BMS, fuses or other safety features.</li>' +
              '<li>Test at low speed in a safe, open area before riding normally.</li>' +
              '<li>If you\'re not confident, have a qualified e-bike or e-moto technician fit it.</li>' +
            '</ul><p>Fitting this product does not make a bike road legal. Read our ' + policyLink('legal-notice', 'Legal Notice') + ' before riding.</p></div>' +
          '</div></details>' +
          '<details class="accordion"><summary>Shipping &amp; returns</summary><div class="accordion__body">' +
            '<p>' + shippingSummary() + ' We aim to dispatch the same or next business day after your payment arrives.</p>' +
            '<p>' + policyLink('shipping-policy', 'Shipping policy') + ' · ' + policyLink('refund-policy', 'Refund policy') + '</p>' +
          '</div></details>' +
        '</div>' +
      '</div>';

    var mainMedia = document.getElementById('MainMedia');
    function showMedia(m, alt) {
      if (!m) { mainMedia.innerHTML = ''; return; }
      mainMedia.innerHTML = m.type === 'video'
        ? '<video src="' + escapeHtml(m.src) + '" controls playsinline preload="metadata"></video>'
        : '<img src="' + escapeHtml(m.src) + '" alt="' + escapeHtml(alt || p.title) + '">';
    }
    function setActiveThumb(index) {
      root.querySelectorAll('.product__thumb').forEach(function (b) {
        b.classList.toggle('is-active', Number(b.getAttribute('data-index')) === index);
      });
    }
    showMedia(media[0]);

    root.querySelectorAll('.product__thumb').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-index'));
        showMedia(media[i]);
        setActiveThumb(i);
      });
    });

    var selectedVariant = p.variants.length ? p.variants[0].name : '';
    var addBtn = document.getElementById('AddToCart');

    function refreshBuyButton() {
      var v = p.variants.filter(function (x) { return x.name === selectedVariant; })[0];
      var soldOut = p.soldOut || (v && v.soldOut);
      addBtn.disabled = !!soldOut;
      addBtn.textContent = soldOut ? 'Sold out' : 'Add to cart';
    }

    root.querySelectorAll('.variant').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedVariant = btn.getAttribute('data-variant');
        root.querySelectorAll('.variant').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        document.getElementById('VariantLabel').textContent = selectedVariant;
        var v = p.variants.filter(function (x) { return x.name === selectedVariant; })[0];
        if (v && v.image) {
          var idx = media.map(function (m) { return m.src; }).indexOf(v.image);
          showMedia({ type: 'image', src: v.image }, p.title + ' – ' + v.name);
          setActiveThumb(idx);
        }
        refreshBuyButton();
      });
    });
    refreshBuyButton();

    var qty = 1;
    var qtyValue = document.getElementById('ProductQtyValue');
    document.getElementById('ProductQty').addEventListener('click', function (e) {
      if (e.target.closest('[data-inc]')) qty = Math.min(99, qty + 1);
      if (e.target.closest('[data-dec]')) qty = Math.max(1, qty - 1);
      qtyValue.textContent = qty;
    });

    addBtn.addEventListener('click', function () {
      if (addBtn.disabled) return;
      addToCart(p.handle, selectedVariant, qty);
      openDrawer(addBtn);
    });
  }

  /* ---------------- Checkout ---------------- */
  function newOrderId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var bytes = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var id = '';
    for (var i = 0; i < bytes.length; i++) id += chars[bytes[i] % chars.length];
    return 'BXN-' + id;
  }

  function initCheckout() {
    var form = document.getElementById('CheckoutForm');
    if (!form) return;
    document.getElementById('ShippingLabel').textContent = 'Shipping (Australia Post, tracked)';

    onCartChange = function (d) {
      if (form.dataset.submitted) return;
      if (!d.lines.length) {
        document.getElementById('CheckoutRoot').innerHTML =
          '<div class="confirm"><h1 class="page__heading">Your cart is empty</h1><p>Add something before checking out.</p><a class="button button--primary" href="shop.html">Shop parts</a></div>';
        return;
      }
      document.getElementById('SummaryItems').innerHTML = d.lines.map(function (l) { return lineMarkup(l, false); }).join('');
      document.getElementById('SummarySubtotal').textContent = money(d.subtotal);
      document.getElementById('SummaryShipping').textContent = d.shipping === 0 ? 'FREE' : money(d.shipping);
      document.getElementById('SummaryTotal').textContent = money(d.total);
    };
    onCartChange(cartDetails());

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var d = cartDetails();
      if (!d.lines.length) return;

      var data = new FormData(form);
      var get = function (k) { return (data.get(k) || '').toString().trim(); };
      var order = {
        id: newOrderId(),
        createdAt: new Date().toISOString(),
        customer: {
          name: (get('first_name') + ' ' + get('last_name')).trim(),
          email: get('email'),
          phone: get('phone'),
          address: [get('address1'), get('address2'), (get('suburb') + ' ' + get('state') + ' ' + get('postcode')).trim()]
            .filter(Boolean).join(', ')
        },
        notes: get('notes'),
        items: d.lines.map(function (l) {
          return { title: l.product.title + (l.variant ? ' – ' + l.variant : ''), qty: l.qty, lineTotal: l.lineTotal };
        }),
        subtotal: d.subtotal,
        shipping: d.shipping,
        total: d.total
      };

      var submitBtn = document.getElementById('PlaceOrder');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Placing order...';

      var params = orderParams(order);

      // Record the order wherever we can, but never block the customer:
      // the confirmation page offers a one-tap email if nothing got through.
      Promise.all([submitToNetlify(params), sendEmails(params)]).then(function (results) {
        order.savedToNetlify = results[0];
        order.emailed = results[1];
        order.recorded = results[0] || results[1];
        storageSet(ORDER_KEY, order);
        form.dataset.submitted = '1';
        saveCart([]);
        window.location.href = 'order.html';
      });
    });
  }

  function orderParams(order) {
    return {
      order_id: order.id,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone,
      shipping_address: order.customer.address,
      items: order.items.map(function (i) { return i.qty + ' x ' + i.title + ' (' + money(i.lineTotal) + ')'; }).join('\n'),
      subtotal: money(order.subtotal),
      shipping: order.shipping === 0 ? 'FREE' : money(order.shipping),
      total: money(order.total),
      payid: SETTINGS.payId,
      payid_name: SETTINGS.payIdAccountName,
      notes: order.notes || '-',
      cancel_hours: String(SETTINGS.unpaidCancelHours || 72),
      business_email: SETTINGS.contactEmail
    };
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (resolve) { setTimeout(function () { resolve(false); }, ms); })]);
  }

  function isLocalPreview() {
    return window.location.protocol === 'file:' || /^(localhost|127\.)/.test(window.location.hostname);
  }

  function submitToNetlify(params) {
    if (isLocalPreview()) return Promise.resolve(false);
    var body = new URLSearchParams();
    body.append('form-name', 'order');
    Object.keys(params).forEach(function (k) { body.append(k, params[k]); });
    return withTimeout(fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }).then(function (res) { return res.ok; }).catch(function () { return false; }), 8000);
  }

  var emailjsLoading = null;
  function loadEmailJs() {
    if (window.emailjs) return Promise.resolve(window.emailjs);
    if (emailjsLoading) return emailjsLoading;
    emailjsLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      s.onload = function () { resolve(window.emailjs); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return emailjsLoading;
  }

  function sendEmails(params) {
    var ej = SETTINGS.emailjs || {};
    if (!ej.publicKey || !ej.serviceId || !ej.ownerTemplateId) return Promise.resolve(false);
    return withTimeout(loadEmailJs().then(function (emailjs) {
      emailjs.init({ publicKey: ej.publicKey });
      var sends = [emailjs.send(ej.serviceId, ej.ownerTemplateId, params)];
      if (ej.customerTemplateId) sends.push(emailjs.send(ej.serviceId, ej.customerTemplateId, params));
      return Promise.all(sends).then(function () { return true; });
    }).catch(function () { return false; }), 10000);
  }

  /* ---------------- Order confirmation ---------------- */
  function initConfirmation() {
    var root = document.getElementById('OrderRoot');
    if (!root) return;
    var order = storageGet(ORDER_KEY, null);
    if (!order) {
      root.innerHTML = '<div class="confirm"><h1 class="page__heading">No recent order</h1><p>If you\'ve placed an order, check your email for the payment details.</p><a class="button button--primary" href="index.html">Back to home</a></div>';
      return;
    }

    var payIdReady = isConfigured(SETTINGS.payId);
    var nameRow = isConfigured(SETTINGS.payIdAccountName)
      ? '<div class="pay-row"><div><p class="pay-row__label">Account name</p><p class="pay-row__value">' + escapeHtml(SETTINGS.payIdAccountName) + '</p></div></div>'
      : '';

    // If the order couldn't be recorded automatically, let the customer send it to us.
    var p = orderParams(order);
    var mailBody = 'Hi BXN Customs,\n\nI just placed order ' + order.id + '.\n\n' +
      'Name: ' + p.customer_name + '\nEmail: ' + p.customer_email + '\nPhone: ' + p.customer_phone +
      '\nShip to: ' + p.shipping_address + '\n\nItems:\n' + p.items +
      '\n\nShipping: ' + p.shipping + '\nTotal: ' + p.total + '\n\nNotes: ' + p.notes;
    var mailto = 'mailto:' + encodeURIComponent(SETTINGS.contactEmail || '') +
      '?subject=' + encodeURIComponent('Order ' + order.id) + '&body=' + encodeURIComponent(mailBody);
    var sendBox = order.recorded ? '' :
      '<div class="send-order"><p><strong>One last step:</strong> tap below to email your order to us so we can match your payment.</p>' +
      '<a class="button button--primary button--full" href="' + mailto + '">Email my order to BXN Customs</a></div>';

    var payBlock = payIdReady
      ? '<div class="pay-card">' +
          payRow('Amount to pay', money(order.total), true, true) +
          payRow('PayID', SETTINGS.payId, false, true) +
          nameRow +
          payRow('Reference / description', order.id, false, true) +
        '</div>' +
        '<ol class="steps">' +
          '<li>Open your banking app and choose <strong>Pay someone → PayID</strong>.</li>' +
          '<li>Paste the PayID and check the account name matches.</li>' +
          '<li>Enter <strong>' + money(order.total) + '</strong> and put <strong>' + escapeHtml(order.id) + '</strong> as the reference or description.</li>' +
          '<li>We\'ll email you tracking once it\'s shipped.</li>' +
        '</ol>'
      : '<div class="pay-card">' + payRow('Amount to pay', money(order.total), true, false) + payRow('Reference', order.id, false, false) + '</div>' +
        '<p class="notice">We\'ll email you our payment details shortly.</p>';

    root.innerHTML =
      '<div class="confirm">' +
        '<span class="confirm__badge">Order received</span>' +
        '<h1 class="page__heading">Thanks, ' + escapeHtml(order.customer.name.split(' ')[0]) + '!</h1>' +
        '<p>Your order <strong>' + escapeHtml(order.id) + '</strong> is reserved. Pay by PayID below and we\'ll ship it as soon as the payment lands.</p>' +
        sendBox +
        payBlock +
        '<p class="notice">' +
          (order.emailed ? 'We\'ve also emailed these details to <strong>' + escapeHtml(order.customer.email) + '</strong>. ' : 'Take a screenshot of this page so you have the payment details. ') +
          'Orders not paid within ' + (SETTINGS.unpaidCancelHours || 72) + ' hours are cancelled. Questions? Email <a href="mailto:' + escapeHtml(SETTINGS.contactEmail) + '">' + escapeHtml(SETTINGS.contactEmail) + '</a>.' +
        '</p>' +
        '<a class="button button--secondary" href="shop.html">Keep shopping</a>' +
      '</div>';

    root.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-copy')).then(function () {
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 1600);
        });
      });
    });
  }

  function payRow(label, value, accent, copyable) {
    var copyValue = label === 'Amount to pay' ? value.replace('$', '') : value;
    return '<div class="pay-row"><div><p class="pay-row__label">' + escapeHtml(label) + '</p>' +
      '<p class="pay-row__value' + (accent ? ' pay-row__value--accent' : '') + '">' + escapeHtml(value) + '</p></div>' +
      (copyable ? '<button type="button" class="copy-btn" data-copy="' + escapeHtml(copyValue) + '">Copy</button>' : '') +
    '</div>';
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta); resolve();
    });
  }

  /* ---------------- Policy page ---------------- */
  function initPolicy() {
    var root = document.getElementById('PolicyRoot');
    if (!root) return;
    var slug = (new URLSearchParams(window.location.search).get('p') || '').replace(/[^a-z0-9-]/g, '');
    if (!slug) { root.innerHTML = '<h1 class="page__heading">Policy not found</h1>'; return; }
    fetch('content/policies/' + slug + '.md', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('missing'); return r.text(); })
      .then(function (text) {
        var meta = {};
        var body = text;
        var m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
        if (m) {
          m[1].split('\n').forEach(function (line) {
            var idx = line.indexOf(':');
            if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          });
          body = m[2];
        }
        document.title = (meta.title || 'Policy') + ' – ' + (SETTINGS.businessName || 'BXN Customs');
        root.innerHTML = '<h1 class="page__heading">' + escapeHtml(meta.title || 'Policy') + '</h1>' +
          (meta.updated ? '<p class="policy__updated">Last updated: ' + escapeHtml(meta.updated) + '</p>' : '') +
          '<div class="prose">' + md(body) + '</div>';
      })
      .catch(function () { root.innerHTML = '<h1 class="page__heading">Policy not found</h1><p><a href="index.html">Back to home</a></p>'; });
  }

  /* ---------------- Boot ---------------- */
  function loadJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Promise.all([loadJson('assets/data/settings.json'), loadJson('assets/data/products.json')])
      .then(function (res) {
        SETTINGS = res[0] || {};
        PRODUCTS = normaliseProducts(res[1] && res[1].products);
      })
      .catch(function (err) {
        console.error('Could not load store data', err);
        var main = document.getElementById('MainContent');
        if (main) main.insertAdjacentHTML('afterbegin', '<div class="container"><p class="form-error" style="margin-top:20px">Sorry, the store couldn\'t load. Please refresh the page.</p></div>');
      })
      .then(function () {
        renderLayout();
        initDrawer();
        initHome();
        initShop();
        initProduct();
        initCheckout();
        initConfirmation();
        initPolicy();
        renderCartUI();
      });
  });
})();
