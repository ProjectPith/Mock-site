// 1. Cal.com Loader Snippet
(function (C, A, L) { 
  let p = function (a, ar) { a.q.push(ar); }; 
  let l = C.Cal = C.Cal || function () { 
    let cal = l; 
    let ar = arguments; 
    if (!cal.q) { cal.q = []; } 
    if (typeof ar[0] === "string") { 
      if (ar[0] === "init") { 
        let api = function () { p(api, arguments); }; 
        let c = ar[1]; 
        api.q = api.q || []; 
        if (typeof c === "string") { 
          cal.ns = cal.ns || {}; 
          cal.ns[c] = cal.ns[c] || api; 
          p(cal.ns[c], ar); 
          p(cal, ["initNamespace", c]); 
        } else { p(cal, ar); } 
        return; 
      } 
      p(cal, ar); 
    } 
  }; 
})(window, "https://app.cal.com/embed/embed.js", "Cal");

// 2. Main Page Setup
function initBookingPage() {
  // Initialize Cal API safely inside DOM ready execution
  if (typeof window.Cal === "function") {
    Cal("init", { origin: "https://cal.com" });
    
    Cal("ui", {
      "theme": "dark",
      "hideEventTypeDetails": false,
      "layout": "month"
    });

    Cal("elementClick", {
      elementOrSelector: "#book-call-btn",
      calLink: "hannah-martin-h12p3m/15min"
    });
  }

  // Fallback direct click handler for Schedule Call button
  const callBtn = document.getElementById("book-call-btn");
  if (callBtn) {
    callBtn.addEventListener("click", (e) => {
      if (window.Cal && typeof window.Cal === "function") {
        // Manually trigger modal if data-attributes didn't catch it
        Cal("modal", {
          calLink: "hannah-martin-h12p3m/15min",
          config: { layout: "month" }
        });
      }
    });
  }

  // Price Estimator Button Handler
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      console.log("Estimator button clicked successfully!");
      // Insert your estimator modal trigger here
    });
  }
}

// Ensure execution triggers regardless of load state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBookingPage);
} else {
  initBookingPage();
}
