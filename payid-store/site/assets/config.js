/*
  BXN Customs store settings.
  This is the only file you need to edit to change payment details,
  shipping prices or the order email setup.
*/
window.BXN_CONFIG = {
  // Your PayID, exactly as customers should type it into their banking app.
  payId: 'REPLACE_WITH_YOUR_PAYID',

  // The account name customers will see when they enter your PayID.
  // Their bank shows this before they confirm, so it reassures them it's you.
  payIdAccountName: 'REPLACE_WITH_ACCOUNT_NAME',

  // Prices are in cents. 1195 = $11.95.
  shippingFlatRate: 1195,
  freeShippingThreshold: 15000,

  // Orders not paid within this many hours are cancelled.
  unpaidCancelHours: 72,

  // Business details shown in the footer and order emails.
  businessName: 'BXN Customs',
  abn: '51 935 846 860',
  contactEmail: 'benw98136@gmail.com',

  // EmailJS sends the order to you and the payment details to the customer.
  // Fill these in from your EmailJS dashboard (see SETUP.md). They are not
  // passwords and are safe to have in the website.
  emailjs: {
    publicKey: '',
    serviceId: '',
    ownerTemplateId: '',
    customerTemplateId: ''
  }
};
