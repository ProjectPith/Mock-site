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

// Global Cal Initialization
Cal("init", { origin: "https://cal.com" });

Cal("ui", {
  "theme": "dark",
  "styles": { "branding": { "brandColor": "#238636" } },
  "hideEventTypeDetails": false,
  "layout": "month"
});

// Explicitly bind click listener
Cal("elementClick", {
  elementOrSelector: "#book-call-btn",
  calLink: "hannah-martin-h12p3m/15min"
});

// Page Interaction Handlers
function initBookingPage() {
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      // Replace test alert with your actual modal opening function/logic here
      console.log("Estimator clicked");
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBookingPage);
} else {
  initBookingPage();
}
