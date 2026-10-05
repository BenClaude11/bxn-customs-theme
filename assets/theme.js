document.addEventListener('DOMContentLoaded', function () {
  initMobileNav();
  initCartDrawer();
  initLoginRecoverToggle();
  initShopCarousel();
  initSaleCountdown();
  if (document.querySelector('.product-form')) initProductForm();
});

/* ---------------- Shop all carousel (click-to-advance, seamless loop both ways) ---------------- */
function initShopCarousel() {
  var track = document.getElementById('ShopCarouselTrack');
  var prevBtn = document.getElementById('ShopCarouselPrev');
  var nextBtn = document.getElementById('ShopCarouselNext');
  if (!track || !prevBtn || !nextBtn) return;

  // The section renders the card list three times back-to-back and starts
  // the view on the middle copy, leaving a full spare set on either side so
  // both arrows can step indefinitely: whichever edge we reach, snap back
  // by exactly one set-width with no transition, invisible since the
  // neighbouring set is identical.
  var setWidth = track.scrollWidth / 3;
  var offset = -setWidth;
  track.style.transform = 'translateX(' + offset + 'px)';

  // Rapid clicking used to queue up faster than the reset logic could keep
  // pace, so the offset ran past the spare set with nothing there to show
  // (the strip appeared to vanish). Locking input for the duration of each
  // step's transition means offset only ever moves by exactly one card at
  // a time, so the boundary check below is always correcting from a known,
  // valid position.
  var isAnimating = false;
  var TRANSITION_MS = 500;

  function step(direction) {
    if (isAnimating) return;
    isAnimating = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    var card = track.querySelector('.carousel-card');
    var gap = 22;
    var cardStep = card ? card.getBoundingClientRect().width + gap : 238;

    offset -= direction * cardStep;
    track.style.transform = 'translateX(' + offset + 'px)';

    setTimeout(function () {
      var pastFarEdge = offset <= -2 * setWidth;
      var pastNearEdge = offset >= 0;
      if (pastFarEdge || pastNearEdge) {
        track.classList.add('is-snapping');
        offset += pastFarEdge ? setWidth : -setWidth;
        track.style.transform = 'translateX(' + offset + 'px)';
        track.offsetHeight; // force reflow so the snap applies with no transition
        requestAnimationFrame(function () {
          track.classList.remove('is-snapping');
        });
      }
      isAnimating = false;
      prevBtn.disabled = false;
      nextBtn.disabled = false;
    }, TRANSITION_MS);
  }

  nextBtn.addEventListener('click', function () { step(1); });
  prevBtn.addEventListener('click', function () { step(-1); });
}

/* ---------------- Sale countdown ---------------- */
function initSaleCountdown() {
  var el = document.getElementById('SaleCountdown');
  if (!el) return;
  var endTime = new Date(el.dataset.end).getTime();
  if (isNaN(endTime)) return;

  var hoursEl = document.getElementById('CountdownHours');
  var minutesEl = document.getElementById('CountdownMinutes');
  var secondsEl = document.getElementById('CountdownSeconds');

  function tick() {
    var remaining = endTime - Date.now();
    if (remaining <= 0) {
      el.style.display = 'none';
      clearInterval(interval);
      return;
    }
    var hours = Math.floor(remaining / 3600000);
    var minutes = Math.floor((remaining % 3600000) / 60000);
    var seconds = Math.floor((remaining % 60000) / 1000);
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  tick();
  var interval = setInterval(tick, 1000);
}

/* ---------------- Mobile nav ---------------- */
function initMobileNav() {
  var toggle = document.getElementById('MobileMenuToggle');
  var nav = document.getElementById('SiteNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
  });
}

/* ---------------- Login / recover password toggle ---------------- */
function initLoginRecoverToggle() {
  var show = document.getElementById('ShowRecoverForm');
  var hide = document.getElementById('HideRecoverForm');
  var login = document.getElementById('LoginForm');
  var recover = document.getElementById('RecoverForm');
  if (!show || !recover || !login) return;
  show.addEventListener('click', function () {
    login.hidden = true;
    recover.hidden = false;
  });
  if (hide) {
    hide.addEventListener('click', function () {
      recover.hidden = true;
      login.hidden = false;
    });
  }
}

/* ---------------- Product form: options, image swap, quantity, add to cart ---------------- */
function initProductForm() {
  var form = document.getElementById('ProductForm');
  var productUrl = form ? form.dataset.productUrl : null;
  var variants = [];
  var selectedOptions = {};

  // Seed selectedOptions from whichever option-value buttons start selected.
  // Keys are 1-based to match Shopify's option1/option2/option3 on each variant.
  document.querySelectorAll('.product-form__option-values').forEach(function (group) {
    var index = parseInt(group.dataset.optionIndex, 10) + 1;
    var selected = group.querySelector('.option-value.is-selected') || group.querySelector('.option-value');
    if (selected) selectedOptions[index] = selected.dataset.optionValue;
  });

  if (productUrl) {
    fetch(productUrl + '.js')
      .then(function (res) { return res.json(); })
      .then(function (productData) { variants = productData.variants; });
  }

  document.querySelectorAll('.product-form__option-values').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('.option-value');
      if (!btn || btn.disabled) return;
      var index = parseInt(group.dataset.optionIndex, 10) + 1;
      selectedOptions[index] = btn.dataset.optionValue;

      group.querySelectorAll('.option-value').forEach(function (b) {
        var isSelected = b === btn;
        b.classList.toggle('is-selected', isSelected);
        b.setAttribute('aria-pressed', isSelected);
      });

      var option = group.closest('.product-form__option');
      var selectedLabel = option ? option.querySelector('[data-selected-label]') : null;
      if (selectedLabel) selectedLabel.textContent = btn.dataset.optionLabel || btn.dataset.optionValue;

      updateSelectedVariant();
    });
  });

  function findMatchingVariant() {
    return variants.find(function (variant) {
      return Object.keys(selectedOptions).every(function (position) {
        return variant['option' + position] === selectedOptions[position];
      });
    });
  }

  function updateSelectedVariant() {
    var variant = findMatchingVariant();
    var addBtn = document.getElementById('AddToCartButton');
    var addText = document.getElementById('AddToCartText');
    var priceEl = document.getElementById('ProductPrice');
    var idInput = document.getElementById('ProductSelectedVariantId');

    if (!variant) {
      if (addBtn) addBtn.disabled = true;
      if (addText) addText.textContent = 'Unavailable';
      return;
    }

    if (idInput) idInput.value = variant.id;
    if (priceEl) {
      var priceHtml = '<span class="now">' + formatMoney(variant.price) + '</span>';
      if (variant.compare_at_price > variant.price) {
        var savePct = Math.round((variant.compare_at_price - variant.price) * 100 / variant.compare_at_price);
        priceHtml += '<span class="was">' + formatMoney(variant.compare_at_price) + '</span>' +
          '<span class="product__save">Save ' + savePct + '%</span>';
      }
      priceEl.innerHTML = priceHtml;
    }

    var skuEl = document.getElementById('ProductSku');
    if (skuEl && variant.sku) skuEl.textContent = variant.sku;

    if (addBtn) addBtn.disabled = !variant.available;
    if (addText) addText.textContent = variant.available ? 'Add to cart' : 'Sold out';

    if (variant.featured_image && variant.featured_image.src) {
      var mainImg = document.getElementById('ProductMainImageTag');
      if (mainImg) mainImg.src = resizeImageUrl(variant.featured_image.src, 900);
    }
  }

  // Thumbnail gallery swap.
  document.querySelectorAll('.product__thumbnail').forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      var mainImg = document.getElementById('ProductMainImageTag');
      if (mainImg) mainImg.src = thumb.dataset.imageUrl;
      document.querySelectorAll('.product__thumbnail').forEach(function (t) {
        t.classList.toggle('is-active', t === thumb);
      });
    });
  });

  // Quantity stepper.
  var qtyInput = document.getElementById('Quantity');
  var qtyDec = document.getElementById('QuantityDecrease');
  var qtyInc = document.getElementById('QuantityIncrease');
  if (qtyDec) qtyDec.addEventListener('click', function () {
    qtyInput.value = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
  });
  if (qtyInc) qtyInc.addEventListener('click', function () {
    qtyInput.value = parseInt(qtyInput.value || '1', 10) + 1;
  });

  // Submit via AJAX so the shopper stays on the product page and the cart drawer slides in.
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var addBtn = document.getElementById('AddToCartButton');
      var addText = document.getElementById('AddToCartText');
      var originalText = addText ? addText.textContent : '';
      if (addBtn) addBtn.disabled = true;
      if (addText) addText.textContent = 'Adding...';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          id: document.getElementById('ProductSelectedVariantId').value,
          quantity: parseInt(qtyInput ? qtyInput.value : 1, 10)
        })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.description || data.message || 'Could not add to cart');
            return data;
          });
        })
        .then(function () { return refreshCartDrawer(); })
        .then(function () {
          if (addBtn) addBtn.disabled = false;
          if (addText) addText.textContent = originalText;
          if (!openCartDrawer(addBtn)) showAddResult('Added to cart \u2713');
        })
        .catch(function (err) {
          console.error('Add to cart failed', err);
          showAddResult(err.message || 'Could not add to cart');
        });

      function showAddResult(message) {
        if (addText) addText.textContent = message;
        setTimeout(function () {
          if (addBtn) addBtn.disabled = false;
          if (addText) addText.textContent = originalText;
        }, 1800);
      }
    });
  }
}

function resizeImageUrl(url, width) {
  if (!url) return url;
  return url.replace(/(\.[a-zA-Z0-9]+)(\?|$)/, '_' + width + 'x$1$2');
}

function formatMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}

/* ---------------- Cart drawer (AJAX) ---------------- */
function initCartDrawer() {
  var drawer = document.getElementById('CartDrawer');
  var overlay = document.getElementById('CartDrawerOverlay');
  var closeBtn = document.getElementById('CartDrawerClose');
  var panel = document.getElementById('CartDrawerPanel');
  var cartLink = document.getElementById('CartIconLink');

  // The cart icon opens the drawer; without JS (or the drawer) it still links to /cart.
  if (cartLink && drawer) {
    cartLink.addEventListener('click', function (e) {
      e.preventDefault();
      openCartDrawer(cartLink);
      refreshCartDrawer();
    });
  }
  if (overlay) overlay.addEventListener('click', closeCartDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeCartDrawer);
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-cart-drawer-close]')) {
        e.preventDefault();
        closeCartDrawer();
      }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) closeCartDrawer();
  });

  // Swipe right on the panel to close it, like a native sheet.
  if (panel) {
    var startX = 0;
    var startY = 0;
    var dragX = 0;
    var dragging = false;
    panel.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragX = 0;
      dragging = false;
    }, { passive: true });
    panel.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      if (!dragging && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) dragging = true;
      if (!dragging) return;
      dragX = Math.max(0, dx);
      panel.style.transition = 'none';
      panel.style.transform = 'translateX(' + dragX + 'px)';
    }, { passive: true });
    panel.addEventListener('touchend', function () {
      if (!dragging) return;
      panel.style.transition = '';
      panel.style.transform = '';
      if (dragX > 80) closeCartDrawer();
      dragging = false;
    });
  }

  var itemsContainer = document.getElementById('CartDrawerItems');
  if (itemsContainer) {
    bindQuantityControls(itemsContainer, function (lineKey, quantity) {
      itemsContainer.classList.add('is-loading');
      updateCartLine(lineKey, quantity)
        .then(refreshCartDrawer)
        .finally(function () { itemsContainer.classList.remove('is-loading'); });
    });
  }

  // The full /cart page has its own static line items (server-rendered) that
  // need the same +/- and remove wiring. Reload the page after a change so
  // subtotal, shipping estimate, etc. all stay in sync with the server.
  var cartPageItems = document.getElementById('CartPageItems');
  if (cartPageItems) {
    bindQuantityControls(cartPageItems, function (lineKey, quantity) {
      updateCartLine(lineKey, quantity).then(function () { window.location.reload(); });
    });
  }
}

function bindQuantityControls(container, onChange) {
  container.addEventListener('click', function (e) {
    var line = e.target.closest('[data-line-key]');
    if (!line) return;
    var lineKey = line.dataset.lineKey;

    if (e.target.closest('[data-cart-remove]')) {
      onChange(lineKey, 0);
    } else if (e.target.closest('[data-cart-qty-increase]')) {
      var current = parseInt(line.querySelector('.cart-item__qty-value').textContent, 10);
      onChange(lineKey, current + 1);
    } else if (e.target.closest('[data-cart-qty-decrease]')) {
      var current2 = parseInt(line.querySelector('.cart-item__qty-value').textContent, 10);
      onChange(lineKey, Math.max(0, current2 - 1));
    }
  });
}

var cartDrawerTrigger = null;

// Returns false when there's no drawer on the page so callers can fall back.
function openCartDrawer(trigger) {
  var drawer = document.getElementById('CartDrawer');
  if (!drawer) return false;
  if (drawer.classList.contains('is-open')) return true;
  cartDrawerTrigger = trigger || document.activeElement;
  lockPageScroll();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  var closeBtn = document.getElementById('CartDrawerClose');
  if (closeBtn) setTimeout(function () { closeBtn.focus({ preventScroll: true }); }, 50);
  return true;
}

function closeCartDrawer() {
  var drawer = document.getElementById('CartDrawer');
  if (!drawer || !drawer.classList.contains('is-open')) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  unlockPageScroll();
  if (cartDrawerTrigger && cartDrawerTrigger.focus) cartDrawerTrigger.focus({ preventScroll: true });
  cartDrawerTrigger = null;
}

// Freeze the page behind the drawer. iOS Safari ignores overflow:hidden on
// body, so pin the body in place and restore the scroll position on close.
var lockedScrollY = 0;
function lockPageScroll() {
  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  var body = document.body;
  body.style.position = 'fixed';
  body.style.top = '-' + lockedScrollY + 'px';
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  document.documentElement.classList.add('cart-drawer-open');
}

function unlockPageScroll() {
  var body = document.body;
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  document.documentElement.classList.remove('cart-drawer-open');
  window.scrollTo(0, lockedScrollY);
}

function updateCartLine(lineKey, quantity) {
  return fetch('/cart/change.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: lineKey, quantity: quantity })
  }).catch(function (err) { console.error('Cart update failed', err); });
}

function refreshCartDrawer() {
  return fetch('/cart.js')
    .then(function (res) { return res.json(); })
    .then(function (cart) {
      renderCartDrawer(cart);
      updateCartCount(cart.item_count);
      renderFreeShippingBars(cart);
      return cart;
    });
}

function updateCartCount(count) {
  var badge = document.getElementById('CartCount');
  if (badge) badge.textContent = count > 0 ? count : '';
}

function renderCartDrawer(cart) {
  var itemsContainer = document.getElementById('CartDrawerItems');
  var subtotalEl = document.getElementById('CartDrawerSubtotal');
  var footer = document.getElementById('CartDrawerFooter');
  if (!itemsContainer) return;

  var countEl = document.getElementById('CartDrawerCount');
  if (countEl) countEl.textContent = cart.item_count > 0 ? '(' + cart.item_count + ')' : '';

  if (cart.item_count === 0) {
    itemsContainer.innerHTML =
      '<div class="cart-drawer__empty">' +
        '<p>Your cart is empty.</p>' +
        '<a href="/collections/all" class="button button--primary" data-cart-drawer-continue>Shop parts</a>' +
      '</div>';
    if (footer) footer.hidden = true;
    return;
  }

  if (footer) footer.hidden = false;
  if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);

  itemsContainer.innerHTML = cart.items.map(function (item) {
    var titleSafe = escapeHtml(item.product_title);
    var image = item.image
      ? '<img src="' + resizeImageUrl(item.image, 180) + '" alt="' + titleSafe + '" width="72" height="72">'
      : '';
    var variant = (item.variant_title && item.variant_title !== 'Default Title')
      ? '<p class="cart-item__variant">' + escapeHtml(item.variant_title) + '</p>'
      : '';

    return (
      '<div class="cart-item" data-line-key="' + item.key + '">' +
        '<div class="cart-item__image">' + image + '</div>' +
        '<div class="cart-item__details">' +
          '<p class="cart-item__title">' + titleSafe + '</p>' +
          variant +
          '<div class="cart-item__qty">' +
            '<button class="cart-item__qty-btn" data-cart-qty-decrease aria-label="Decrease quantity of ' + titleSafe + '">&minus;</button>' +
            '<span class="cart-item__qty-value">' + item.quantity + '</span>' +
            '<button class="cart-item__qty-btn" data-cart-qty-increase aria-label="Increase quantity of ' + titleSafe + '">&plus;</button>' +
          '</div>' +
        '</div>' +
        '<div class="cart-item__price-remove">' +
          '<span class="cart-item__price">' + formatMoney(item.final_line_price) + '</span>' +
          '<button class="cart-item__remove" data-cart-remove aria-label="Remove ' + titleSafe + ' from cart">Remove</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function renderFreeShippingBars(cart) {
  document.querySelectorAll('[data-free-shipping]').forEach(function (bar) {
    var threshold = parseInt(bar.dataset.threshold, 10);
    if (!threshold) return;
    var total = cart.total_price;
    var remaining = threshold - total;
    var percent = Math.min(100, Math.round((total / threshold) * 100));
    var message = bar.querySelector('[data-free-shipping-message]');
    var fill = bar.querySelector('[data-free-shipping-fill]');
    var track = bar.querySelector('[role="progressbar"]');

    if (message) {
      if (cart.item_count === 0) {
        message.innerHTML = 'Free shipping on orders over <strong>' + formatMoney(threshold).replace('.00', '') + '</strong>';
      } else if (remaining > 0) {
        message.innerHTML = 'You\'re <strong>' + formatMoney(remaining) + '</strong> away from free shipping';
      } else {
        message.innerHTML = 'You\'ve unlocked <strong>free shipping</strong>';
      }
    }
    if (fill) fill.style.width = percent + '%';
    if (track) track.setAttribute('aria-valuenow', percent);
    bar.classList.toggle('is-complete', remaining <= 0 && cart.item_count > 0);
  });
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
