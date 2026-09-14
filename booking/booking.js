// Cal.com Official Embed Snippet
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

function initBookingPage() {
  // Bind Schedule Call Button Directly
  const callBtn = document.getElementById("book-call-btn");
  if (callBtn) {
    callBtn.addEventListener("click", () => {
      Cal("modal", {
        calLink: "hannah-martin-h12p3m/15min",
        config: { layout: "month", theme: "dark" }
      });
    });
  }

  // Bind Estimator Button
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      // Trigger your estimator action here
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBookingPage);
} else {
  initBookingPage();
}

  // Price Estimator Button Handler
document.addEventListener("DOMContentLoaded", () => {

  // Price Estimator Button Handler
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      // Put your actual estimator modal trigger code here
      alert("Estimator Modal Logic Connected!");
    });
  }

});
