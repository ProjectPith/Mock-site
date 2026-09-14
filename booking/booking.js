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

// Initialize Cal namespace explicitly
Cal("init", "15min", { origin: "https://cal.com" });

document.addEventListener("DOMContentLoaded", () => {
  
  // Set global UI theme on namespace
  Cal.ns["15min"]("ui", {
    "theme": "dark",
    "hideEventTypeDetails": false,
    "layout": "month"
  });

  const callBtn = document.getElementById("book-call-btn");
  if (callBtn) {
    callBtn.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Trigger modal directly on the initialized namespace
      Cal.ns["15min"]("modal", {
        calLink: "hannah-martin-h12p3m/15min",
        config: { layout: "month", theme: "dark" }
      });
    });
  }

  // Estimator handler
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      console.log("Estimator button clicked!");
    });
  }

});
