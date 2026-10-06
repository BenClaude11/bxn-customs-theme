/*
  Product catalogue. Prices are in cents (7000 = $70.00).
  To add a product, copy the block below, give it a new handle (used in the
  page address) and update the details and photos.
*/
window.BXN_PRODUCTS = [
  {
    handle: 'dirodi-cnc-throttle',
    title: 'Dirodi CNC Throttle',
    type: 'Throttle',
    price: 7000,
    images: [
      'assets/img/dirodi-cnc-throttle-1.png',
      'assets/img/dirodi-cnc-throttle-2.png'
    ],
    description:
      '<p>A CNC-machined throttle with a grippy, textured handle, designed to give you more grip and a more responsive feel.</p>' +
      '<p><strong>Check fitment before you order.</strong> Make sure the connector matches your bike. Not sure? <a href="contact.html">Ask us</a> with your bike\'s make, model and year and a photo of your connector.</p>',
    installVideo: {
      src: 'assets/video/install-throttle.mp4',
      poster: 'assets/video/install-throttle-poster.jpg'
    }
  }
];
