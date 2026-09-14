// 1. Loader Snippet (Runs automatically at file load)
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

Cal("init", { origin: "https://cal.com" });

// 2. Click Handler (Fires modal when button is pressed)
document.addEventListener("DOMContentLoaded", () => {
  
  Cal("ui", {
    "theme": "dark",
    "hideEventTypeDetails": false,
    "layout": "month"
  });

  const callBtn = document.getElementById("book-call-btn");
  if (callBtn) {
    callBtn.addEventListener("click", (e) => {
      e.preventDefault();
      Cal("modal", {
        calLink: "hannah-martin-h12p3m/15min",
        config: { layout: "month", theme: "dark" }
      });
    });
  }

  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      alert("Estimator Modal Logic Connected!");
    });
  }

});
