/* BXN Customs PayID store: cart, drawer, product pages, checkout and order confirmation. */
(function () {
  'use strict';

  var CONFIG = window.BXN_CONFIG || {};
  var PRODUCTS = window.BXN_PRODUCTS || [];
  var CART_KEY = 'bxn_cart_v1';
  var ORDER_KEY = 'bxn_last_order_v1';

  /* ---------------- Helpers ---------------- */
  function money(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function findProduct(handle) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].handle === handle) return PRODUCTS[i];
    }
    return null;
  }

  function storageGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* private mode or storage blocked: cart lasts for this page only */ }
  }

  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function isConfigured(value) {
    return value && String(value).indexOf('REPLACE_WITH') !== 0;
  }

  /* ---------------- Cart ---------------- */
  var memoryCart = null;

  function getCart() {
    if (memoryCart) return memoryCart;
    var stored = storageGet(CART_KEY, []);
    // Drop anything that's no longer in the catalogue.
    memoryCart = (Array.isArray(stored) ? stored : []).filter(function (line) {
      return findProduct(line.handle) && line.qty > 0;
    });
    return memoryCart;
  }

  function saveCart(cart) {
    memoryCart = cart;
    storageSet(CART_KEY, cart);
    renderCartUI();
  }

  function addToCart(handle, qty) {
    var cart = getCart().slice();
    var existing = cart.filter(function (l) { return l.handle === handle; })[0];
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else cart.push({ handle: handle, qty: qty });
    saveCart(cart);
  }

  function setLineQty(handle, qty) {
    var cart = getCart().slice();
    cart = cart.map(function (l) { return l.handle === handle ? { handle: l.handle, qty: qty } : l; })
      .filter(function (l) { return l.qty > 0; });
    saveCart(cart);
  }

  function cartDetails() {
    var lines = getCart().map(function (l) {
      var p = findProduct(l.handle);
      return { handle: l.handle, qty: l.qty, product: p, lineTotal: p.price * l.qty };
    });
    var subtotal = lines.reduce(function (sum, l) { return sum + l.lineTotal; }, 0);
    var count = lines.reduce(function (sum, l) { return sum + l.qty; }, 0);
    var shipping = shippingFor(subtotal);
    return { lines: lines, subtotal: subtotal, count: count, shipping: shipping, total: subtotal + shipping };
  }

  function shippingFor(subtotal) {
    if (subtotal <= 0) return 0;
    if (CONFIG.freeShippingThreshold && subtotal >= CONFIG.freeShippingThreshold) return 0;
    return CONFIG.shippingFlatRate || 0;
  }

  /* ---------------- Layout (header, footer, drawer) ---------------- */
  var CART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></svg>';

  function renderLayout() {
    var header = document.getElementById('SiteHeader');
    if (header) {
      header.className = 'site-header';
      header.innerHTML =
        '<div class="container site-header__inner">' +
          '<a class="site-header__logo" href="index.html">BXN Customs</a>' +
          '<nav class="site-header__nav" aria-label="Main">' +
            '<a href="index.html#shop">Shop</a>' +
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
              '<p class="site-footer__brand">' + escapeHtml(CONFIG.businessName || 'BXN Customs') + '</p>' +
              '<p style="margin:0">ABN ' + escapeHtml(CONFIG.abn || '') + '</p>' +
              '<p style="margin:4px 0 0"><a href="mailto:' + escapeHtml(CONFIG.contactEmail) + '">' + escapeHtml(CONFIG.contactEmail) + '</a></p>' +
              '<span class="site-footer__pay">Pay by PayID or bank transfer</span>' +
            '</div>' +
            '<nav class="site-footer__links" aria-label="Policies">' +
              '<a href="contact.html">Contact</a>' +
              '<a href="policies/shipping-policy.html">Shipping</a>' +
              '<a href="policies/refund-policy.html">Refunds</a>' +
              '<a href="policies/terms-of-service.html">Terms</a>' +
              '<a href="policies/privacy-policy.html">Privacy</a>' +
              '<a href="policies/legal-notice.html">Legal notice</a>' +
            '</nav>' +
          '</div>' +
          '<p style="margin:24px 0 0">&copy; ' + new Date().getFullYear() + ' ' + escapeHtml(CONFIG.businessName || 'BXN Customs') + '. Shipping Australia-wide.</p>' +
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
          '<p class="drawer__note">Flat ' + money(CONFIG.shippingFlatRate || 0) + ' shipping Australia-wide, free over ' + money(CONFIG.freeShippingThreshold || 0).replace('.00', '') + '. Pay by PayID at checkout.</p>' +
          '<a href="checkout.html" class="button button--primary button--full">Checkout</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(drawer);
  }

  function freeShippingMarkup() {
    if (!CONFIG.freeShippingThreshold) return '';
    return '<div class="free-ship" data-free-ship>' +
      '<p class="free-ship__msg" data-free-ship-msg></p>' +
      '<div class="free-ship__track" role="progressbar" aria-label="Progress to free shipping" aria-valuemin="0" aria-valuemax="100">' +
        '<div class="free-ship__fill" data-free-ship-fill></div>' +
      '</div>' +
    '</div>';
  }

  function lineMarkup(line, editable) {
    var p = line.product;
    var title = escapeHtml(p.title);
    var qty = editable
      ? '<div class="qty" data-handle="' + escapeHtml(line.handle) + '">' +
          '<button type="button" data-qty-dec aria-label="Decrease quantity of ' + title + '">&minus;</button>' +
          '<span>' + line.qty + '</span>' +
          '<button type="button" data-qty-inc aria-label="Increase quantity of ' + title + '">+</button>' +
        '</div>'
      : '<p style="margin:0;color:var(--muted);font-size:0.88rem">Qty ' + line.qty + '</p>';
    return '<div class="line">' +
      '<div class="line__image"><img src="' + escapeHtml(p.images[0]) + '" alt="" width="72" height="72"></div>' +
      '<div class="line__details"><p class="line__title">' + title + '</p>' + qty + '</div>' +
      '<div class="line__end"><span>' + money(line.lineTotal) + '</span>' +
        (editable ? '<button type="button" class="line__remove" data-remove="' + escapeHtml(line.handle) + '">Remove</button>' : '') +
      '</div>' +
    '</div>';
  }

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
          '<a href="index.html#shop" class="button button--primary" data-drawer-close>Shop parts</a></div>';
        if (footer) footer.hidden = true;
      } else {
        items.innerHTML = d.lines.map(function (l) { return lineMarkup(l, true); }).join('');
        if (footer) footer.hidden = false;
      }
    }
    var subtotalEl = document.getElementById('CartSubtotal');
    if (subtotalEl) subtotalEl.textContent = money(d.subtotal);

    renderFreeShipping(d);
    if (typeof onCartChange === 'function') onCartChange(d);
  }

  function renderFreeShipping(d) {
    var threshold = CONFIG.freeShippingThreshold;
    if (!threshold) return;
    var remaining = threshold - d.subtotal;
    var percent = Math.min(100, Math.round((d.subtotal / threshold) * 100));
    document.querySelectorAll('[data-free-ship]').forEach(function (bar) {
      var msg = bar.querySelector('[data-free-ship-msg]');
      if (msg) {
        if (d.count === 0) msg.innerHTML = 'Free shipping on orders over <strong>' + money(threshold).replace('.00', '') + '</strong>';
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

  /* ---------------- Drawer behaviour ---------------- */
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
      var closer = e.target.closest('[data-drawer-close]');
      if (closer) {
        // Let links (e.g. "Shop parts") navigate after closing.
        closeDrawer();
        return;
      }
      var qty = e.target.closest('.qty[data-handle]');
      if (qty) {
        var handle = qty.getAttribute('data-handle');
        var current = getCart().filter(function (l) { return l.handle === handle; })[0];
        if (!current) return;
        if (e.target.closest('[data-qty-inc]')) setLineQty(handle, Math.min(99, current.qty + 1));
        if (e.target.closest('[data-qty-dec]')) setLineQty(handle, current.qty - 1);
      }
      var remove = e.target.closest('[data-remove]');
      if (remove) setLineQty(remove.getAttribute('data-remove'), 0);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // Swipe right to close.
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

  /* ---------------- Home page ---------------- */
  function initHome() {
    var grid = document.getElementById('ProductGrid');
    if (!grid) return;
    grid.innerHTML = PRODUCTS.map(function (p) {
      return '<a class="product-card" href="product.html?p=' + encodeURIComponent(p.handle) + '">' +
        '<div class="product-card__image"><img src="' + escapeHtml(p.images[0]) + '" alt="' + escapeHtml(p.title) + '" loading="lazy"></div>' +
        '<p class="product-card__type">' + escapeHtml(p.type || '') + '</p>' +
        '<p class="product-card__title">' + escapeHtml(p.title) + '</p>' +
        '<p class="product-card__price">' + money(p.price) + '</p>' +
      '</a>';
    }).join('');
  }

  /* ---------------- Product page ---------------- */
  function initProduct() {
    var root = document.getElementById('ProductRoot');
    if (!root) return;
    var handle = new URLSearchParams(window.location.search).get('p');
    var p = findProduct(handle) || (PRODUCTS.length === 1 ? PRODUCTS[0] : null);
    if (!p) {
      root.innerHTML = '<div class="page"><h1 class="page__heading">Product not found</h1><a class="button button--primary" href="index.html#shop">Back to shop</a></div>';
      return;
    }
    document.title = p.title + ' – BXN Customs';

    var thumbs = p.images.length > 1
      ? '<div class="product__thumbs">' + p.images.map(function (src, i) {
          return '<button type="button" class="product__thumb' + (i === 0 ? ' is-active' : '') + '" data-src="' + escapeHtml(src) + '" aria-label="Show image ' + (i + 1) + '"><img src="' + escapeHtml(src) + '" alt=""></button>';
        }).join('') + '</div>'
      : '';

    var video = p.installVideo
      ? '<div class="install-video"><video src="' + escapeHtml(p.installVideo.src) + '" poster="' + escapeHtml(p.installVideo.poster || '') + '" controls preload="metadata" playsinline></video></div>'
      : '';

    root.innerHTML =
      '<div class="container product">' +
        '<div>' +
          '<div class="product__main-image"><img id="MainImage" src="' + escapeHtml(p.images[0]) + '" alt="' + escapeHtml(p.title) + '"></div>' +
          thumbs +
        '</div>' +
        '<div>' +
          '<a class="product__back" href="index.html#shop">&larr; Shop all</a>' +
          '<p class="product__type">' + escapeHtml(p.type || '') + '</p>' +
          '<h1 class="product__title">' + escapeHtml(p.title) + '</h1>' +
          '<p class="product__price">' + money(p.price) + '</p>' +
          '<p class="product__price-note">' + money(CONFIG.shippingFlatRate || 0) + ' flat shipping Australia-wide. Free over ' + money(CONFIG.freeShippingThreshold || 0).replace('.00', '') + '.</p>' +
          '<div class="product__buy">' +
            '<div class="qty" id="ProductQty"><button type="button" data-dec aria-label="Decrease quantity">&minus;</button><span id="ProductQtyValue">1</span><button type="button" data-inc aria-label="Increase quantity">+</button></div>' +
            '<button type="button" class="button button--primary" id="AddToCart">Add to cart</button>' +
          '</div>' +
          '<div class="product__pay-note"><span aria-hidden="true">⚡</span><span><strong>Pay by PayID.</strong> Instant bank transfer, no card needed. You\'ll get the payment details at checkout and we ship as soon as it lands.</span></div>' +
          '<ul class="trust">' +
            '<li>Faulty or damaged? Repaired, replaced or refunded under Australian Consumer Law</li>' +
            '<li>14-day change-of-mind returns on unused items</li>' +
            '<li>Ships from NSW with Australia Post tracking</li>' +
          '</ul>' +
          '<details class="accordion" open><summary>Description</summary><div class="accordion__body">' + p.description + '</div></details>' +
          '<details class="accordion"><summary>Installation &amp; safety</summary><div class="accordion__body">' + video +
            '<div class="warnings"><p><strong>Before you install</strong></p><ul>' +
              '<li>Check the product suits your bike before connecting anything.</li>' +
              '<li>Disconnect or switch off the battery before working on the electrical system.</li>' +
              '<li>Never bypass or disable brakes, brake cut-off switches, the BMS, fuses or other safety features.</li>' +
              '<li>Test at low speed in a safe, open area before riding normally.</li>' +
              '<li>If you\'re not confident, have a qualified e-bike or e-moto technician fit it.</li>' +
            '</ul><p>Fitting this product does not make a bike road legal. Read our <a href="policies/legal-notice.html">Legal Notice</a> before riding.</p></div>' +
          '</div></details>' +
          '<details class="accordion"><summary>Shipping &amp; returns</summary><div class="accordion__body">' +
            '<p>Orders ship within 1–3 business days of payment arriving, with Australia Post tracking. ' + money(CONFIG.shippingFlatRate || 0) + ' flat rate Australia-wide, free on orders over ' + money(CONFIG.freeShippingThreshold || 0).replace('.00', '') + '.</p>' +
            '<p><a href="policies/shipping-policy.html">Shipping policy</a> · <a href="policies/refund-policy.html">Refund policy</a></p>' +
          '</div></details>' +
        '</div>' +
      '</div>';

    var qty = 1;
    var qtyValue = document.getElementById('ProductQtyValue');
    document.getElementById('ProductQty').addEventListener('click', function (e) {
      if (e.target.closest('[data-inc]')) qty = Math.min(99, qty + 1);
      if (e.target.closest('[data-dec]')) qty = Math.max(1, qty - 1);
      qtyValue.textContent = qty;
    });

    var addBtn = document.getElementById('AddToCart');
    addBtn.addEventListener('click', function () {
      addToCart(p.handle, qty);
      openDrawer(addBtn);
    });

    root.querySelectorAll('.product__thumb').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('MainImage').src = btn.getAttribute('data-src');
        root.querySelectorAll('.product__thumb').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      });
    });
  }

  /* ---------------- Checkout ---------------- */
  var onCartChange = null;

  function newOrderId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var id = '';
    var bytes = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    for (var i = 0; i < bytes.length; i++) id += chars[bytes[i] % chars.length];
    return 'BXN-' + id;
  }

  function initCheckout() {
    var form = document.getElementById('CheckoutForm');
    if (!form) return;

    var summaryItems = document.getElementById('SummaryItems');
    onCartChange = function (d) {
      if (!d.lines.length) {
        document.getElementById('CheckoutRoot').innerHTML =
          '<div class="confirm"><h1 class="page__heading">Your cart is empty</h1><p>Add something before checking out.</p><a class="button button--primary" href="index.html#shop">Shop parts</a></div>';
        return;
      }
      summaryItems.innerHTML = d.lines.map(function (l) { return lineMarkup(l, false); }).join('');
      document.getElementById('SummarySubtotal').textContent = money(d.subtotal);
      document.getElementById('SummaryShipping').textContent = d.shipping === 0 ? 'FREE' : money(d.shipping);
      document.getElementById('SummaryTotal').textContent = money(d.total);
    };
    onCartChange(cartDetails());

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errorBox = document.getElementById('CheckoutError');
      errorBox.hidden = true;
      if (!form.reportValidity()) return;

      var d = cartDetails();
      if (!d.lines.length) return;

      var data = new FormData(form);
      var get = function (k) { return (data.get(k) || '').toString().trim(); };
      var order = {
        id: newOrderId(),
        createdAt: new Date().toISOString(),
        customer: {
          name: get('first_name') + ' ' + get('last_name'),
          email: get('email'),
          phone: get('phone'),
          address: [get('address1'), get('address2'), get('suburb') + ' ' + get('state') + ' ' + get('postcode')]
            .filter(function (x) { return x.trim(); }).join(', ')
        },
        notes: get('notes'),
        items: d.lines.map(function (l) { return { title: l.product.title, qty: l.qty, lineTotal: l.lineTotal }; }),
        subtotal: d.subtotal,
        shipping: d.shipping,
        total: d.total
      };

      var submitBtn = document.getElementById('PlaceOrder');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Placing order...';

      var itemsText = order.items.map(function (i) { return i.qty + ' x ' + i.title + ' (' + money(i.lineTotal) + ')'; }).join('\n');

      var params = {
        order_id: order.id,
        customer_name: order.customer.name,
        customer_email: order.customer.email,
        customer_phone: order.customer.phone,
        shipping_address: order.customer.address,
        items: itemsText,
        subtotal: money(order.subtotal),
        shipping: order.shipping === 0 ? 'FREE' : money(order.shipping),
        total: money(order.total),
        payid: CONFIG.payId,
        payid_name: CONFIG.payIdAccountName,
        notes: order.notes || '-',
        cancel_hours: String(CONFIG.unpaidCancelHours || 72),
        business_email: CONFIG.contactEmail
      };

      Promise.all([submitToNetlify(params), sendEmails(params)])
        .then(function (results) {
          order.savedToNetlify = results[0];
          order.emailed = results[1];
          if (!order.savedToNetlify && !order.emailed && !isLocalPreview()) {
            throw new Error('not-recorded');
          }
          storageSet(ORDER_KEY, order);
          saveCart([]);
          window.location.href = 'order.html';
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Place order';
          errorBox.innerHTML = 'Sorry, we couldn\'t place your order. Please check your connection and try again, or email us at <a href="mailto:' +
            escapeHtml(CONFIG.contactEmail) + '">' + escapeHtml(CONFIG.contactEmail) + '</a>.';
          errorBox.hidden = false;
          errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
  }

  function isLocalPreview() {
    return window.location.protocol === 'file:' || /^(localhost|127\.)/.test(window.location.hostname);
  }

  // Netlify Forms keeps a copy of every order in the Netlify dashboard and can
  // email it to you, even before EmailJS is set up.
  function submitToNetlify(params) {
    if (isLocalPreview()) return Promise.resolve(false);
    var body = new URLSearchParams();
    body.append('form-name', 'order');
    Object.keys(params).forEach(function (k) { body.append(k, params[k]); });
    return fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }).then(function (res) { return res.ok; }).catch(function () { return false; });
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
    var ej = CONFIG.emailjs || {};
    if (!ej.publicKey || !ej.serviceId || !ej.ownerTemplateId) return Promise.resolve(false);
    return loadEmailJs().then(function (emailjs) {
      emailjs.init({ publicKey: ej.publicKey });
      var sends = [emailjs.send(ej.serviceId, ej.ownerTemplateId, params)];
      if (ej.customerTemplateId) sends.push(emailjs.send(ej.serviceId, ej.customerTemplateId, params));
      return Promise.all(sends).then(function () { return true; });
    }).catch(function () { return false; });
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

    var payIdReady = isConfigured(CONFIG.payId);
    var payIdText = payIdReady ? CONFIG.payId : 'PayID coming soon, email us to pay';
    var nameRow = isConfigured(CONFIG.payIdAccountName)
      ? '<div class="pay-row"><div><p class="pay-row__label">Account name</p><p class="pay-row__value">' + escapeHtml(CONFIG.payIdAccountName) + '</p></div></div>'
      : '';

    root.innerHTML =
      '<div class="confirm">' +
        '<span class="confirm__badge">Order received</span>' +
        '<h1 class="page__heading">Thanks, ' + escapeHtml(order.customer.name.split(' ')[0]) + '!</h1>' +
        '<p>Your order <strong>' + escapeHtml(order.id) + '</strong> is reserved. Pay by PayID below and we\'ll ship it as soon as the payment lands.</p>' +
        '<div class="pay-card">' +
          payRow('Amount to pay', money(order.total), true) +
          payRow('PayID', payIdText, false, payIdReady) +
          nameRow +
          payRow('Reference / description', order.id, false) +
        '</div>' +
        '<ol class="steps">' +
          '<li>Open your banking app and choose <strong>Pay someone → PayID</strong>.</li>' +
          '<li>Paste the PayID and check the account name matches.</li>' +
          '<li>Enter <strong>' + money(order.total) + '</strong> and put <strong>' + escapeHtml(order.id) + '</strong> as the reference or description.</li>' +
          '<li>We\'ll email you tracking once it\'s shipped.</li>' +
        '</ol>' +
        '<p class="notice">' +
          (order.emailed ? 'We\'ve also emailed these details to <strong>' + escapeHtml(order.customer.email) + '</strong>. ' : 'Take a screenshot of this page so you have the payment details. ') +
          'Orders not paid within ' + (CONFIG.unpaidCancelHours || 72) + ' hours are cancelled. Questions? Email <a href="mailto:' + escapeHtml(CONFIG.contactEmail) + '">' + escapeHtml(CONFIG.contactEmail) + '</a>.' +
        '</p>' +
        '<a class="button button--secondary" href="index.html">Back to home</a>' +
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
    var canCopy = copyable !== false;
    var copyValue = label === 'Amount to pay' ? value.replace('$', '') : value;
    return '<div class="pay-row"><div><p class="pay-row__label">' + escapeHtml(label) + '</p>' +
      '<p class="pay-row__value' + (accent ? ' pay-row__value--accent' : '') + '">' + escapeHtml(value) + '</p></div>' +
      (canCopy ? '<button type="button" class="copy-btn" data-copy="' + escapeHtml(copyValue) + '">Copy</button>' : '') +
    '</div>';
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      resolve();
    });
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    renderLayout();
    initDrawer();
    initHome();
    initProduct();
    initCheckout();
    initConfirmation();
    renderCartUI();
  });
})();
