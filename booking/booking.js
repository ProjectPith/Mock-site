// 1. Safe Cal.com Global Initialization Snippet
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

// Initialize Cal core origin
Cal("init", { origin: "https://cal.com" });

// 2. DOM Ready Logic
document.addEventListener("DOMContentLoaded", () => {

  // Initialize Cal.com UI settings & click binding
  if (typeof window.Cal === "function") {
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

  // Price Estimator Handler
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      alert("Estimator Modal Logic Connected!");
    });
  }

});
