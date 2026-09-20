// ==========================================
// STORE DATA & MODULE LOGIC
// ==========================================

const products = [
  { 
    id: 'p1', 
    shortCode: 'LC MP',
    title: 'LunarCraft Mouse Pad', 
    price: 9.99, 
    image: '../images/MousePad.png', 
    desc: 'Rectangle foam mouse pad with rubber bottom.',
    // Printify Details
    details: [
      'Material: Durable, high-density foam with an ultra-thin rubber base'
      '1/16 inch (1.58 mm) thick'
      'One-sided print'
    ]
  },
  { 
    id: 'p2', 
    shortCode: 'LC Hdy',
    title: 'LunarCraft Developer Hoodie', 
    price: 55.56, 
    image: '../images/Hoodie_Charcoal.jpg', 
    colorImages: {
      'C': '../images/Hoodie_Charcoal.jpg',        // Charcoal / Default
      'B': '../images/Hoodie_Black.jpg',  // Black
      'G': '../images/Hoodie_Gray.jpg',   // Gray
      'N': '../images/Hoodie_Navy.jpg'    // Navy
    },
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    colors: [
      { code: 'C', name: 'Charcoal' },
      { code: 'B', name: 'Black' },
      { code: 'G', name: 'Gray' },
      { code: 'N', name: 'Navy' }
    ],
    desc: '80% cotton. Medium heavy fabric. Regular fit.',
    // Printify Details
    details: [
      '80% combed, ring-spun cotton, 20% recycled polyester (varies per color)',
      'Soft 3-end fleece',
      'Medium heavy fabric (8.25 oz/yd² / 280 g/m²)',
      'Regular fit',
      'Three-panel hood with fleece lining',
      'Runs true to size',
      'Tear-away label'
    ]
  },
  { 
    id: 'p3', 
    shortCode: 'LC CM',
    title: 'LunarCraft Ceramic Mug', 
    price: 12.99, 
    image: '../images/Mug.png', 
    desc: '15oz dark ceramic mug. Lead and BPA free.',
    // Printify Details
    details: [
      'Black ceramic material with a glossy finish'
      'One size: 15oz (0.44 l)'
      'C-shaped easy-grip handle'
      'Lead and BPA-free'
    ]
  },
  { 
    id: 'p4', 
    shortCode: 'LC LTS',
    title: 'LunarCraft Laptop Sleeve', 
    price: 17.52, 
    image: '../images/LaptopSleeve.png', 
    sizes: ['12', '13', '15'],
    desc: 'Fleece interior. Lightweight. Please check sizing chart.',
    // Printify Details
    details: [
      'Materials: 100% polyester'
      'Plush fleece interior'
      'YKK 5 nylon zipper'
      'Black polyester back'
      'Lightweight'
      'Please note: Always check the measurement table for the correct size choice'
    ]
  },
  { 
    id: 'p5', 
    isDemo: true,
    title: 'Custom Build Consultation', 
    desc: 'Need a custom E-commerce web build for your brand? Reach out for a consultation.'
  }
];

document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  initModalDOM();
});

// Render Product Grid
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
              <a href="/booking/booking.html" class="btn btn-primary">Inquire About Builds</a>
            </div>
          </div>
        </div>`;
    } else {
      const hasSizes = prod.sizes && prod.sizes.length > 0;
      const hasColors = prod.colors && prod.colors.length > 0;

      html += `
        <div class="product-card" onclick="openProductModal('${prod.id}')">
          <div class="product-image-wrap">
            <img id="img-${prod.id}" src="${prod.image}" alt="${prod.title}">
          </div>
          <div class="product-info">
            <span class="badge">Official Gear</span>
            <h3>${prod.title}</h3>
            <p>${prod.desc}</p>
            
            ${(hasSizes || hasColors) ? `
              <div class="variant-selectors" onclick="event.stopPropagation();">
                ${hasSizes ? `
                  <div class="selector-group">
                    <label>Size:</label>
                    <select id="size-${prod.id}">
                      ${prod.sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                  </div>
                ` : ''}

                ${hasColors ? `
                  <div class="selector-group">
                    <label>Color:</label>
                    <select id="color-${prod.id}" onchange="handleColorChange('${prod.id}', this.value)">
                      ${prod.colors.map(c => `<option value="${c.code}">${c.name}</option>`).join('')}
                    </select>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <div class="product-price">$${prod.price.toFixed(2)}</div>
            <div class="card-actions" onclick="event.stopPropagation();">
              <button class="btn btn-secondary" onclick="addToCartFromCard('${prod.id}')">Add to Cart</button>
            </div>
          </div>
        </div>`;
    }
  }

  container.innerHTML = html;
}

// Handle Image Swap on Color Selection
function handleColorChange(productId, colorCode) {
  const prod = products.find(p => p.id === productId);
  if (!prod || !prod.colorImages) return;

  const newImgSrc = prod.colorImages[colorCode] || prod.image;

  // Update card image
  const cardImg = document.getElementById(`img-${productId}`);
  if (cardImg) cardImg.src = newImgSrc;

  // Update modal image if active
  const modalImg = document.getElementById('modal-product-img');
  if (modalImg && modalImg.dataset.productId === productId) {
    modalImg.src = newImgSrc;
  }
}

// Add to Cart from Card
function addToCartFromCard(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const sizeSelect = document.getElementById(`size-${productId}`);
  const colorSelect = document.getElementById(`color-${productId}`);

  const selectedSize = sizeSelect ? sizeSelect.value : null;
  const selectedColor = colorSelect ? colorSelect.value : null;

  executeAddToCart(prod, selectedSize, selectedColor);
}

// Add to Cart from Modal Overlay
function addToCartFromModal(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const sizeSelect = document.getElementById(`modal-size-${productId}`);
  const colorSelect = document.getElementById(`modal-color-${productId}`);

  const selectedSize = sizeSelect ? sizeSelect.value : null;
  const selectedColor = colorSelect ? colorSelect.value : null;

  executeAddToCart(prod, selectedSize, selectedColor);
  closeProductModal();
}

// Core Add to Cart Executor
function executeAddToCart(product, size, color) {
  let cart = (typeof state !== 'undefined' && state.cart) 
    ? state.cart 
    : (JSON.parse(localStorage.getItem('cart')) || []);

  const tagParts = [product.shortCode || product.title];
  if (size) tagParts.push(size);
  if (color) tagParts.push(color);
  const shortTag = tagParts.join(' | ');

  const existingIndex = cart.findIndex(item => 
    item.id === product.id && item.size === size && item.color === color
  );

  if (existingIndex > -1) {
    cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      size: size,
      color: color,
      shortTag: shortTag,
      quantity: 1
    });
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  if (typeof state !== 'undefined') state.cart = cart;

  if (typeof updateCartUI === 'function') updateCartUI();
  if (typeof openCartDrawer === 'function') openCartDrawer();
}

// Inject Modal Markup into DOM
function initModalDOM() {
  if (document.getElementById('product-modal-overlay')) return;

  const modalHTML = `
    <div id="product-modal-overlay" class="modal-overlay hidden" onclick="closeProductModal()">
      <div class="modal-card" onclick="event.stopPropagation()">
        <button class="modal-close-btn" onclick="closeProductModal()">&times;</button>
        <div class="modal-body" id="modal-body-content"></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Open Dynamic Product Modal Overlay
function openProductModal(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod || prod.isDemo) return;

  const modalOverlay = document.getElementById('product-modal-overlay');
  const modalContent = document.getElementById('modal-body-content');
  if (!modalOverlay || !modalContent) return;

  const cardSizeSelect = document.getElementById(`size-${productId}`);
  const cardColorSelect = document.getElementById(`color-${productId}`);

  const currentSize = cardSizeSelect ? cardSizeSelect.value : (prod.sizes ? prod.sizes[0] : null);
  const currentColor = cardColorSelect ? cardColorSelect.value : (prod.colors ? prod.colors[0].code : null);

  const currentImgSrc = (prod.colorImages && currentColor) 
    ? (prod.colorImages[currentColor] || prod.image) 
    : prod.image;

  const hasSizes = prod.sizes && prod.sizes.length > 0;
  const hasColors = prod.colors && prod.colors.length > 0;

  modalContent.innerHTML = `
    <div class="modal-image-wrap">
      <img id="modal-product-img" data-product-id="${prod.id}" src="${currentImgSrc}" alt="${prod.title}">
    </div>
    <div class="modal-info-wrap">
      <span class="badge">Official Gear</span>
      <h2>${prod.title}</h2>
      <p class="modal-desc">${prod.desc}</p>
      <div class="modal-details">
        <strong>Printify Specs & Features:</strong>
        ${Array.isArray(prod.details) ? `
          <ul class="printify-specs">
            ${prod.details.map(item => `<li>${item}</li>`).join('')}
          </ul>
        ` : `<p>${prod.details || ''}</p>`}
      </div>

      ${(hasSizes || hasColors) ? `
        <div class="variant-selectors modal-variants">
          ${hasSizes ? `
            <div class="selector-group">
              <label>Size:</label>
              <select id="modal-size-${prod.id}">
                ${prod.sizes.map(s => `<option value="${s}" ${s === currentSize ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          ` : ''}

          ${hasColors ? `
            <div class="selector-group">
              <label>Color:</label>
              <select id="modal-color-${prod.id}" onchange="handleColorChange('${prod.id}', this.value)">
                ${prod.colors.map(c => `<option value="${c.code}" ${c.code === currentColor ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="product-price modal-price">$${prod.price.toFixed(2)}</div>
      <button class="btn btn-secondary modal-add-btn" onclick="addToCartFromModal('${prod.id}')">Add to Cart</button>
    </div>
  `;

  modalOverlay.classList.remove('hidden');
}

function closeProductModal() {
  const modalOverlay = document.getElementById('product-modal-overlay');
  if (modalOverlay) modalOverlay.classList.add('hidden');
}
