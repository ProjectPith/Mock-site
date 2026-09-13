document.addEventListener("DOMContentLoaded", function() {
  const navContainer = document.getElementById("nav-placeholder");

  if (navContainer) {
    navContainer.innerHTML = `
      <header class="navbar">
        <div class="logo">LunarCraft</div>
        <nav class="nav-links">
          <a href="index.html">Home</a>
          <a href="booking.html">Book Service</a>
          <a href="store.html">Store</a>
        </nav>
        <div class="nav-actions">
          <button class="cart-btn">Cart <span id="cart-count">0</span></button>
          <button class="sign-in-btn">Sign In</button>
        </div>
      </header>
    `;
  }
});
