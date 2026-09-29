# BXN Customs — Shopify Theme

Custom Shopify Online Store 2.0 theme for BXN Customs (e-bike throttles & wireless speed limiters).

## Structure

- `assets/`, `config/`, `layout/`, `sections/`, `snippets/`, `templates/` — standard Shopify theme directories.
- `artifact/` — the standalone design reference for the homepage hero + "Shop all" carousel (`shop-all-carousel.html`), built and iterated on as a Claude Artifact before being ported into the theme's `sections/hero.liquid` and `sections/shop-all-carousel.liquid`. Open the HTML file directly in a browser to preview it.

## Deploying

Zip this folder's contents (not the folder itself) with forward-slash paths preserved, then upload via Shopify Admin → Online Store → Themes → Add theme → Upload zip file.
