// ==========================================
// STORE DATA & MODULE LOGIC
// ==========================================
const productsData = [
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

  for (let i = 0; i < productsData.length; i++) {
    const prod = productsData[i];

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

function addToCart(title, rawPrice) {
  // Convert raw price to string, strip any '$' signs, and parse as a float
  const cleanedPrice = parseFloat(String(rawPrice).replace(/[^0-9.]/g, ""));
  
  // Guard against missing/invalid prices
  const itemPrice = isNaN(cleanedPrice) ? 0 : cleanedPrice;
  const itemTitle = title || "Unknown Product";

  const existingItem = window.cart.find(item => item.title === itemTitle);
  
  if (existingItem) {
    existingItem.quantity = (existingItem.quantity || 1) + 1;
  } else {
    window.cart.push({ title: itemTitle, price: itemPrice, quantity: 1 });
  }

  if (typeof window.saveCart === "function") {
    window.saveCart();
  }
}
