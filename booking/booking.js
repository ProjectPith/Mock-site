document.addEventListener("DOMContentLoaded", () => {
  
  // 1. Create Modal Container for Cal.com
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "cal-custom-modal";
  modalOverlay.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    z-index: 99999;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    position: relative;
    width: 90%;
    max-width: 900px;
    height: 85vh;
    background: #161b22;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  `;

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "✕ Close";
  closeBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    background: #30363d;
    color: #f0f6fc;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    z-index: 10;
  `;

  const iframe = document.createElement("iframe");
  iframe.src = "https://cal.com/hannah-martin-h12p3m/15min?embed=true&theme=dark";
  iframe.style.cssText = "width: 100%; height: 100%; border: none;";

  modalContent.appendChild(closeBtn);
  modalContent.appendChild(iframe);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // 2. Open / Close Modal Logic
  const callBtn = document.getElementById("book-call-btn");
  if (callBtn) {
    callBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modalOverlay.style.display = "flex";
    });
  }

  closeBtn.addEventListener("click", () => {
    modalOverlay.style.display = "none";
  });

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.style.display = "none";
    }
  });

  // 3. Price Estimator Handler
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      console.log("Estimator button clicked!");
    });
  }

});
