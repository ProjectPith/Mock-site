// Cal.com Loader Initialization
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

function initBookingPage() {
  // 1. Setup Cal.com
  if (window.Cal) {
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

  // 2. Setup Price Estimator Button
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      alert("Estimator modal clicked!"); // Test alert to verify connection
    });
  }
}

// Fire immediately if DOM is ready, otherwise wait for event
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBookingPage);
} else {
  initBookingPage();
}
