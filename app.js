// ==========================================
// MOCK DATA & STATE MANAGEMENT
// ==========================================
const servicesData = [
    { id: 's1', title: 'Architecture Review', price: 150, desc: '90-min session reviewing system layout and frontend specs.' },
    { id: 's2', title: 'Full Web Build Package', price: 1200, desc: 'Turnkey development of responsive enterprise sites.' },
    { id: 's3', title: 'Performance & Audit', price: 300, desc: 'Detailed Web Vitals analysis and UI/UX optimization report.' }
];

let state = {
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    selectedService: null,
    orders: JSON.parse(localStorage.getItem('orders')) || [],
    bookings: JSON.parse(localStorage.getItem('bookings')) || []
};

// ==========================================
// INITIALIZATION & TAB NAVIGATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    renderServices();
    renderProducts();
    updateCartUI();
    updateAuthNav();
});

function switchTab(tabId) {
    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });

    // Remove active class from all links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show current tab
    const selectedTab = document.getElementById(tabId + '-tab');
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }

    // Add active class to the clicked button
    const activeLink = document.querySelector(`.nav-link[onclick*="${tabId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Call once on initial page load to ensure products render immediately
document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
});

// ==========================================
// SERVICES & BOOKING SYSTEM
// ==========================================
function renderServices() {
    const container = document.getElementById('services-list');
    container.innerHTML = servicesData.map(service => `
        <div class="service-card ${state.selectedService?.id === service.id ? 'selected' : ''}" 
             onclick="selectService('${service.id}')">
            <h3>${service.title}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">${service.desc}</p>
            <strong style="color: var(--blue-primary);">$${service.price}</strong>
        </div>
    `).join('');
}

function selectService(id) {
    state.selectedService = servicesData.find(s => s.id === id);
    document.getElementById('selected-service-display').value = `${state.selectedService.title} ($${state.selectedService.price})`;
    renderServices();
}

function handleBooking(e) {
    e.preventDefault();
    if (!state.selectedService) {
        alert('Please select a service from the list first.');
        return;
    }
    const date = document.getElementById('booking-date').value;
    const time = document.getElementById('booking-time').value;

    const booking = {
        id: 'BK-' + Date.now().toString().slice(-4),
        service: state.selectedService.title,
        price: state.selectedService.price,
        date,
        time,
        status: 'Confirmed'
    };

    state.bookings.push(booking);
    localStorage.setItem('bookings', JSON.stringify(state.bookings));

    alert(`Success! Booking reserved for ${booking.service} on ${date} at ${time}.`);
    document.getElementById('booking-form').reset();
    state.selectedService = null;
    document.getElementById('selected-service-display').value = 'Select a service from the left';
    renderServices();
}

// ==========================================
// E-COMMERCE & CART SYSTEM
// ==========================================
// Updated with your web dev merch lineup
const productsData = [
    { 
        id: 'p1', 
        title: 'LunarCraft Mouse Pad', 
        price: 9.99, 
        image: 'images/mouse-pad.jpg', 
        desc: 'Rectangle foam mouse pad with rubber bottom. 1.58mm thick',
        buyUrl: 'YOUR_PRINTIFY_OR_STRIPE_LINK' 
    },
    { 
        id: 'p2', 
        title: 'LunarCraft Developer Hoodie', 
        price: 55.56, 
        image: 'images/hoodie.jpg', 
        desc: '80% cotton. Medium heavy fabric. Regular fit.',
        buyUrl: 'YOUR_PRINTIFY_OR_STRIPE_LINK' 
    },
    { 
        id: 'p3', 
        title: 'LunarCraft Ceramic Mug', 
        price: 12.99, 
        image: 'images/mug.jpg', 
        desc: '15oz dark ceramic mug. Lead and BPA free.',
        buyUrl: 'YOUR_PRINTIFY_OR_STRIPE_LINK' 
    },
    { 
        id: 'p4', 
        title: 'LunarCraft Protective Laptop Sleeve', 
        price: 17.52, 
        image: 'images/laptop-sleeve.jpg', 
        desc: 'fleece interior. YKK 5 nylon zipper. Lightweight.',
        buyUrl: 'YOUR_PRINTIFY_OR_STRIPE_LINK' 
    }
];

function renderProducts() {
    var container = document.getElementById('products-grid');
    if (!container || typeof productsData === 'undefined') return;
    
    var html = '';
    for (var i = 0; i < productsData.length; i++) {
        var prod = productsData[i];
        html += '<div class="product-card">' +
            '<div class="product-image-wrap">' +
                '<img src="' + prod.image + '" alt="' + prod.title + '">' +
            '</div>' +
            '<div class="product-info">' +
                '<span class="badge">Official Gear</span>' +
                '<h3>' + prod.title + '</h3>' +
                '<p>' + prod.desc + '</p>' +
                '<div class="product-price">$' + prod.price + '</div>' +
                '<div class="card-actions">' +
                    '<button class="btn btn-secondary" onclick="addToCart(\'' + prod.id + '\')">Test Cart</button>' +
                    '<a href="' + prod.buyUrl + '" target="_blank" class="btn btn-primary">Buy Now</a>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

function addToCart(productId) {
    const item = productsData.find(p => p.id === productId);
    const existing = state.cart.find(ci => ci.id === productId);

    if (existing) {
        existing.qty += 1;
    } else {
        state.cart.push({ ...item, qty: 1 });
    }

    saveCart();
    toggleCart(true);
}

function updateCartUI() {
    const totalCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById('cart-count').innerText = totalCount;

    const cartContainer = document.getElementById('cart-items');
    if (state.cart.length === 0) {
        cartContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Cart is empty.</p>`;
    } else {
        cartContainer.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <div>
                    <strong>${item.title}</strong><br>
                    <small style="color: var(--text-muted);">$${item.price} × ${item.qty}</small>
                </div>
                <button class="close-btn" onclick="removeFromCart('${item.id}')">&times;</button>
            </div>
        `).join('');
    }

    const totalPrice = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById('cart-total-price').innerText = `$${totalPrice.toFixed(2)}`;
}

function removeFromCart(id) {
    state.cart = state.cart.filter(item => item.id !== id);
    saveCart();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartUI();
}

function toggleCart(forceOpen = false) {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    
    if (forceOpen || !drawer.classList.contains('open')) {
        drawer.classList.add('open');
        overlay.classList.add('open');
    } else {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
    }
}

// ==========================================
// CHECKOUT SYSTEM
// ==========================================
function openCheckout() {
    if (state.cart.length === 0) {
        alert("Your cart is empty.");
        return;
    }
    toggleCart(false);
    
    const summary = document.getElementById('checkout-summary');
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    summary.innerHTML = `
        <div style="background: var(--bg-dark); padding: 1rem; border-radius:6px; margin-bottom: 1.5rem;">
            ${state.cart.map(i => `<div style="display:flex; justify-between">${i.title} (x${i.qty}) - $${i.price * i.qty}</div>`).join('')}
            <hr style="border-color: var(--border); margin: 0.5rem 0;">
            <strong>Total Amount: $${total.toFixed(2)}</strong>
        </div>
    `;

    if (state.currentUser) {
        document.getElementById('checkout-name').value = state.currentUser.name;
        document.getElementById('checkout-email').value = state.currentUser.email;
    }

    document.getElementById('checkout-modal').classList.add('open');
}

function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('open');
}

function processPayment(e) {
    e.preventDefault();
    const order = {
        id: 'ORD-' + Date.now().toString().slice(-5),
        items: [...state.cart],
        total: state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0),
        date: new Date().toLocaleDateString()
    };

    state.orders.push(order);
    localStorage.setItem('orders', JSON.stringify(state.orders));

    state.cart = [];
    saveCart();

    closeCheckout();
    alert(`Payment Successful! Order ID: ${order.id}`);
    switchTab('account');
}

// ==========================================
// USER ACCOUNTS & AUTHENTICATION
// ==========================================
function openAuthModal() {
    document.getElementById('auth-modal').classList.add('open');
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('tab-btn-login').classList.add('active');
        document.getElementById('tab-btn-register').classList.remove('active');
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
        document.getElementById('tab-btn-register').classList.add('active');
        document.getElementById('tab-btn-login').classList.remove('active');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;

    state.currentUser = { name, email };
    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

    closeAuthModal();
    updateAuthNav();
    switchTab('account');
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;

    state.currentUser = { name: email.split('@')[0], email };
    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

    closeAuthModal();
    updateAuthNav();
    switchTab('account');
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthNav();
    switchTab('home');
}

function updateAuthNav() {
    const container = document.getElementById('auth-nav-container');
    if (state.currentUser) {
        container.innerHTML = `
            <button class="btn btn-secondary" onclick="switchTab('account')">Account (${state.currentUser.name})</button>
        `;
    } else {
        container.innerHTML = `
            <button class="btn btn-primary" onclick="openAuthModal()">Sign In</button>
        `;
    }
}

function renderAccountTab() {
    const view = document.getElementById('account-view');
    if (!state.currentUser) {
        view.innerHTML = `
            <div class="section-header" style="text-align: center; margin-top: 3rem;">
                <h2>Account Access Required</h2>
                <p>Please log in or register to view your dashboard, past orders, and bookings.</p>
                <br>
                <button class="btn btn-primary" onclick="openAuthModal()">Sign In / Register</button>
            </div>
        `;
        return;
    }

    view.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>User Portal</h2>
            <button class="btn btn-secondary" onclick="logout()">Sign Out</button>
        </div>
        <div class="feature-card" style="margin-bottom: 2rem;">
            <h3>Profile Details</h3>
            <p><strong>Name:</strong> ${state.currentUser.name}</p>
            <p><strong>Email:</strong> ${state.currentUser.email}</p>
        </div>

        <h3 style="margin-bottom: 1rem;">Service Bookings</h3>
        ${state.bookings.length === 0 ? '<p style="color:var(--text-muted); margin-bottom: 2rem;">No active bookings.</p>' : 
            state.bookings.map(b => `
                <div class="service-card">
                    <strong>${b.service}</strong> - ${b.date} at ${b.time}
                    <div style="color:var(--blue-primary); font-size: 0.85rem; margin-top: 4px;">Status: ${b.status} ($${b.price})</div>
                </div>
            `).join('')}

        <h3 style="margin-bottom: 1rem; margin-top: 2rem;">Order History</h3>
        ${state.orders.length === 0 ? '<p style="color:var(--text-muted);">No orders placed yet.</p>' : 
            state.orders.map(o => `
                <div class="service-card">
                    <strong>Order #${o.id}</strong> — Total: $${o.total.toFixed(2)} (${o.date})
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">
                        ${o.items.map(i => `${i.title} (x${i.qty})`).join(', ')}
                    </div>
                </div>
            `).join('')}
    `;
}
