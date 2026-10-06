// Takes an order's items off stock before the order is accepted, so the store
// can never sell more than it has.
//
// Stock lives in assets/data/stock.json in the GitHub repo. We read it with the
// GitHub API, check every item, subtract, and write it back using the file's
// sha. GitHub rejects the write if anything changed the file in between (for
// example another order a moment earlier), and we then start again from the
// fresh copy. That compare-and-swap is what makes two people unable to buy the
// last one.
//
// Needs a GITHUB_TOKEN environment variable in Netlify: a fine-grained token
// with Contents read/write on this repo only.

const REPO = 'BenClaude11/bxn-customs-theme';
const BRANCH = 'claude/compassionate-dijkstra-5yypbi';
const STOCK_PATH = 'payid-store/site/assets/data/stock.json';
const PRODUCTS_PATH = 'payid-store/site/assets/data/products.json';
const MAX_ATTEMPTS = 5;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

function github(path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bxn-reserve-stock',
      ...(init.headers || {})
    }
  });
}

async function readFile(path) {
  const res = await github(`${path}?ref=${encodeURIComponent(BRANCH)}&t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`read ${path}: ${res.status}`);
  const file = await res.json();
  return { sha: file.sha, data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')) };
}

// Returns true on success, false if the file changed since we read it.
async function writeStock(data, sha, orderId) {
  const res = await github(STOCK_PATH, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Stock: reserve order ${orderId}`,
      content: Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64'),
      sha,
      branch: BRANCH
    })
  });
  if (res.ok) return true;
  if (res.status === 409 || res.status === 422) return false;
  throw new Error(`write stock: ${res.status}`);
}

function cleanItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  const wanted = new Map();
  for (const item of raw) {
    const handle = typeof item?.handle === 'string' ? item.handle : '';
    const variant = typeof item?.variant === 'string' ? item.variant : '';
    const qty = Number(item?.qty);
    if (!handle || !Number.isInteger(qty) || qty < 1 || qty > 99) return null;
    const key = `${handle}|${variant}`;
    const prev = wanted.get(key);
    wanted.set(key, { handle, variant, qty: (prev ? prev.qty : 0) + qty });
  }
  return [...wanted.values()];
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!process.env.GITHUB_TOKEN) return json(503, { ok: false, error: 'not-configured' });

  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'bad-json' }); }
  const items = cleanItems(body?.items);
  const orderId = String(body?.orderId || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 24) || 'unknown';
  if (!items) return json(400, { ok: false, error: 'bad-items' });

  try {
    const { data: productData } = await readFile(PRODUCTS_PATH);
    const products = new Map((productData.products || []).map((p) => [p.handle, p]));

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data: stock, sha } = await readFile(STOCK_PATH);
      const lines = Array.isArray(stock.items) ? stock.items : (stock.items = []);

      const shortages = [];
      for (const item of items) {
        const product = products.get(item.handle);
        const variants = (product?.variants || []).filter((v) => v && v.name);
        const variant = variants.find((v) => v.name === item.variant);
        const forSale = product && !product.soldOut &&
          (variants.length ? variant && !variant.soldOut : item.variant === '');
        const line = lines.find((l) => l.product === item.handle && (l.option || '') === item.variant);
        const available = forSale && line ? Math.max(0, parseInt(line.stock, 10) || 0) : 0;
        if (available < item.qty) shortages.push({ handle: item.handle, variant: item.variant, available });
        else item.line = line;
      }
      if (shortages.length) return json(409, { ok: false, error: 'stock', shortages });

      for (const item of items) item.line.stock = (parseInt(item.line.stock, 10) || 0) - item.qty;
      if (await writeStock(stock, sha, orderId)) return json(200, { ok: true });
      // Someone else changed stock.json first. Loop and re-check against the new numbers.
    }
    return json(503, { ok: false, error: 'busy' });
  } catch (err) {
    console.error(err);
    return json(502, { ok: false, error: 'upstream' });
  }
};
