# BXN Customs PayID store: setup guide

The `site/` folder is the whole website. Customers order online and pay by
PayID straight into your bank account.

## 1. Add your PayID

Open `site/assets/config.js` and change these two lines:

```js
payId: 'REPLACE_WITH_YOUR_PAYID',             // e.g. 'bxncustoms@gmail.com'
payIdAccountName: 'REPLACE_WITH_ACCOUNT_NAME', // the name customers see in their bank app
```

Until these are filled in, the payment screen says "PayID coming soon, email us to pay".

## 2. Put the site online (Netlify, free)

1. Sign up at https://app.netlify.com/signup using the business Gmail. If it asks
   for someone 18 or older, a parent signs up instead.
2. Go to **Sites → Add new site → Deploy manually**.
3. Drag the `site` folder (or the zip, unzipped) onto the page.
4. It goes live at an address like `random-name.netlify.app`. Change it under
   **Site configuration → Change site name**, e.g. `bxncustoms.netlify.app`.

To update the site later, go to **Deploys** and drag the folder on again.

## 3. Get orders emailed to you (Netlify Forms, built in)

Every order and contact message is saved in Netlify automatically.

1. In Netlify, go to **Forms**. You should see `order` and `contact` (after the
   first deploy, you may need to click **Enable form detection** and redeploy).
2. Go to **Site configuration → Notifications → Emails and webhooks → Form
   submission notifications → Add notification → Email notification**.
3. Choose the `order` form and enter your business Gmail. Repeat for `contact`.

That alone is enough to start taking orders. Customers see the payment details
on screen after ordering.

## 4. (Recommended) Email customers their payment details (EmailJS, free)

This sends the customer an email with their order number, amount and your PayID.

1. Sign up at https://www.emailjs.com with the business Gmail.
2. **Email Services → Add New Service → Gmail**, connect your Gmail. Copy the
   **Service ID**.
3. **Email Templates → Create New Template** twice, using the templates below.
   Copy each **Template ID**.
4. **Account → General**: copy your **Public Key**.
5. Paste all four into `site/assets/config.js` under `emailjs`, then redeploy.
6. In EmailJS **Account → Security**, add your site address (e.g.
   `bxncustoms.netlify.app`) to the allowed domains so no one else can use your
   templates.

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

## 5. Place a test order

Order something on the live site with your own email and check:
- you get the "New order" email (Netlify and/or EmailJS)
- the customer email arrives (if EmailJS is set up)
- the payment screen shows your PayID correctly

## Adding or changing products

Edit `site/assets/products.js`. Copy the existing product block, change the
handle, title, price (in cents) and photos, and put new photos in
`site/assets/img/`. Then redeploy.

## Changing shipping

In `site/assets/config.js`: `shippingFlatRate` (1195 = $11.95) and
`freeShippingThreshold` (15000 = $150). If you change these, update the
Shipping Policy text in `site/policies/shipping-policy.html` to match.

## Every order

1. "New order BXN-XXXXXX" email arrives.
2. Check your bank app for a payment with that reference and amount.
3. Paid: pack it, buy the label in MyPost Business, email the customer tracking.
4. Not paid after 48 hours: send a reminder. After 72 hours: cancel.

Never ship on a screenshot. Only ship once the money is in your account, and
only refund to the account the payment came from.
