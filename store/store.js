// ==========================================
// STORE DATA & MODULE LOGIC
// ==========================================
const products = [
  { 
    id: 'p1', 
    title: 'LunarCraft Mouse Pad', 
    price: 9.99, 
    image: '../images/MousePad.png', 
    desc: 'Rectangle foam mouse pad with rubber bottom. 1.58mm thick',
    buyUrl: '#' 
  },
  { 
    id: 'p2', 
    title: 'LunarCraft Developer Hoodie', 
    price: 55.56, 
    image: '../images/Hoodie.png', 
    desc: '80% cotton. Medium heavy fabric. Regular fit.',
    buyUrl: '#' 
  },
  { 
    id: 'p3', 
    title: 'LunarCraft Ceramic Mug', 
    price: 12.99, 
    image: '../images/Mug.png', 
    desc: '15oz dark ceramic mug. Lead and BPA free.',
    buyUrl: '#' 
  },
  { 
    id: 'p4', 
    title: 'LunarCraft Laptop Sleeve', 
    price: 17.52, 
    image: '../images/LaptopSleeve.png', 
    desc: 'Fleece interior. YKK 5 nylon zipper. Lightweight.',
    buyUrl: '#' 
  },
  { 
    id: 'p5', 
    isDemo: true,
    title: 'Custom Build Consultation', 
    desc: 'Need a custom E-commerce web build for your brand? Reach out for a consultation.',
  }
];

document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
});

function renderProducts() {
  const container = document.getElementById('products-grid');
  if (!container) return;

  let html = '';

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];

    if (prod.isDemo) {
      html += `
        <div class="product-card demo-card">
          <div class="demo-icon">🚀</div>
          <div class="product-info">
            <span class="badge badge-demo">Portfolio Demo</span>
            <h3>${prod.title}</h3>
            <p>${prod.desc}</p>
            <div class="card-actions">
              <a href="/booking/booking.html" class="btn btn-primary" style="width:100%; text-align:center;">Inquire About Builds</a>
            </div>
          </div>
        </div>`;
    } else {
      html += `
        <div class="product-card">
          <div class="product-image-wrap">
            <img src="${prod.image}" alt="${prod.title}">
          </div>
          <div class="product-info">
            <span class="badge">Official Gear</span>
            <h3>${prod.title}</h3>
            <p>${prod.desc}</p>
            <div class="product-price">$${prod.price}</div>
            <div class="card-actions">
              <button class="btn btn-secondary" onclick="addToCart('${prod.id}')">Test Cart</button>
              <a href="${prod.buyUrl}" target="_blank" class="btn btn-primary">Buy Now</a>
            </div>
          </div>
        </div>`;
    }
  }

  container.innerHTML = html;
}

// Inside store.js
function addToCart(productId) {
  // Replace 'products' below with whatever variable name holds your array in store.js
  if (typeof products === 'undefined' || !Array.isArray(products)) {
    console.error('Products array is not loaded yet.');
    return;
  }

  // Find item by ID
  const product = products.find(p => p.id === productId || p.id === String(productId));

  if (!product) {
    console.error(`Product ${productId} not found.`);
    return;
  }

  // Get active cart array from global state or localStorage
  let cart = (typeof state !== 'undefined' && state.cart) 
    ? state.cart 
    : (JSON.parse(localStorage.getItem('cart')) || []);

  const existingIndex = cart.findIndex(item => item.id === product.id);

  if (existingIndex > -1) {
    cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  // Update localStorage and global state
  localStorage.setItem('cart', JSON.stringify(cart));
  if (typeof state !== 'undefined') {
    state.cart = cart;
  }

  // Refresh cart badge and open cart drawer
  if (typeof updateCartUI === 'function') updateCartUI();
  if (typeof openCartDrawer === 'function') openCartDrawer();
}
