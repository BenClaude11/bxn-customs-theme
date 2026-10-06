# BXN Customs PayID store: setup guide

The `site/` folder is the whole website. Customers order online and pay by
PayID straight into your bank account. Once it's set up, you edit products,
photos, videos, the homepage video, settings and policies from **/admin**.
You don't touch any code.

---

## Part 1: Put the site online, connected to GitHub (one time, ~15 min)

The admin page saves your changes to GitHub, and Netlify republishes the site
automatically. So Netlify needs to be connected to your GitHub repo, not
drag-and-drop.

1. Sign up at https://app.netlify.com/signup and choose **Sign up with GitHub**,
   using the GitHub account that owns `BenClaude11/bxn-customs-theme`.
2. Click **Add new site → Import an existing project → GitHub**, then choose
   **bxn-customs-theme**.
3. Fill in:
   - **Branch to deploy:** `claude/compassionate-dijkstra-5yypbi`
   - **Base directory:** `payid-store/site`
   - **Build command:** leave empty
   - **Publish directory:** `payid-store/site`
4. Click **Deploy**. It goes live at an address like `random-name.netlify.app`.
   Rename it under **Site configuration → Change site name**, e.g. `bxncustoms`.
5. Turn on order saving: **Site configuration → Forms → Enable form detection**.
   Then **Deploys → Trigger deploy → Deploy site** once, so Netlify sees the
   order and contact forms.
6. Get order emails: **Site configuration → Notifications → Emails and webhooks
   → Form submission notifications → Add notification → Email notification**.
   Pick the `order` form and enter your business Gmail. Repeat for `contact`.

## Part 2: Turn on the admin login (one time, ~5 min)

1. On GitHub, go to **Settings (your profile) → Developer settings → OAuth Apps
   → New OAuth App**:
   - **Application name:** BXN Customs Admin
   - **Homepage URL:** your Netlify address, e.g. `https://bxncustoms.netlify.app`
   - **Authorization callback URL:** `https://api.netlify.com/auth/done`
   - Click **Register application**, then **Generate a new client secret**.
2. In Netlify: **Site configuration → Access & security → OAuth → Install
   provider → GitHub**. Paste the **Client ID** and **Client secret**.
3. Go to `https://your-site.netlify.app/admin` and click **Login with GitHub**.

Treat the client secret like a password. Only paste it into Netlify.

## Part 3: Fill in your details (in /admin)

Open **/admin → Store → Store settings** and set:
- **PayID** and **PayID account name**. Until these are filled in, the payment
  screen tells customers you'll email them the payment details.
- Shipping rate ($11.95) and free shipping threshold ($150) are already set.
- **Order number prefix** (optional): the letters at the start of each order
  number, e.g. `BXN` gives `BXN-4F7K2Q`.
- Click **Publish**. The live site updates within a minute or two.

---

## Everyday editing in /admin

### Change the homepage video
**Store → Store settings → Homepage background video → Choose different file → Upload.**
- Keep it **short (6–15 seconds)** and **under 20 MB**. A 4K or 120fps phone
  video is far too big. Trim it and export at **1080p, 30fps** first (CapCut
  or iMovie), or send it to Claude to compress.
- It plays muted on loop.

### Add a product
**Store → Products → Add Products**, then fill in:
- **Product name**, **Page address** (e.g. `speed-limiter-v2`), **Category**, **Price**
- **Photos**: upload one or more. The first is the main photo. Transparent PNGs look best.
- **Product videos** (optional): shown in the photo gallery.
- **Options** (optional): e.g. Black and Silver, each with its own photo.
- **Description**, **Install video** and **Install video cover image**.
- Click **Publish**.

### Mark something sold out
Tick **Sold out** on the product, or on just one option (e.g. Silver).

### Edit a policy
**Policies →** pick the policy, edit the text, update **Last updated**, then **Publish**.

---

## Optional: email customers their payment details (EmailJS, free)

Netlify already emails *you* each order. EmailJS also emails *the customer*
their order number, amount and PayID.

1. Sign up at https://www.emailjs.com with the business Gmail.
2. **Email Services → Add New Service → Gmail**. Copy the **Service ID**.
3. **Email Templates → Create New Template** twice, using the templates below.
   Copy each **Template ID**.
4. **Account → General**: copy your **Public Key**.
5. Paste all four into **/admin → Store settings → EmailJS** and publish.
6. In EmailJS **Account → Security**, add your site address to the allowed domains.

### Template 1: New order (to you)
- **To email:** your business Gmail
- **Subject:** `New order {{order_id}}: {{total}}`
- **Content:**
```
New order {{order_id}}

Customer: {{customer_name}}
Email: {{customer_email}}
Phone: {{customer_phone}}
Ship to: {{shipping_address}}

Items:
{{items}}

Subtotal: {{subtotal}}
Shipping: {{shipping}}
Total: {{total}}

Notes: {{notes}}

Check your bank for a PayID payment with reference {{order_id}} before shipping.
```

### Template 2: Payment details (to the customer)
- **To email:** `{{customer_email}}`
- **Reply to:** `{{business_email}}`
- **Subject:** `Your BXN Customs order {{order_id}}: payment details`
- **Content:**
```
Hi {{customer_name}},

Thanks for your order! It's reserved for you. To complete it, pay by PayID:

Amount: {{total}}
PayID: {{payid}}
Account name: {{payid_name}}
Reference: {{order_id}}

Open your banking app, choose Pay someone > PayID, paste the PayID, check the
account name matches, and use {{order_id}} as the reference.

We ship as soon as your payment arrives and will email you tracking.
Orders not paid within {{cancel_hours}} hours are cancelled.

Your order:
{{items}}
Shipping: {{shipping}}
Total: {{total}}

Delivering to: {{shipping_address}}

Questions? Just reply to this email.

BXN Customs
```

---

## If an order can't be recorded

If form detection is off and EmailJS isn't set up, the order page shows the
customer an **"Email my order to BXN Customs"** button, so orders never get
lost. Turn on form detection (Part 1, step 5) so this rarely happens.

## Every order

1. "New order BXN-XXXXXX" email arrives.
2. Check your bank app for a payment with that reference and amount.
3. Paid: pack it, buy the label in MyPost Business, email the customer tracking.
4. Not paid after 48 hours: send a reminder. After 72 hours: cancel.

Never ship on a screenshot. Only ship once the money is in your account, and
only refund to the account the payment came from.
