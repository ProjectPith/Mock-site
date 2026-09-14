// 1. Loader Snippet
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

document.addEventListener("DOMContentLoaded", () => {
  console.log("--> Step 1: DOMContentLoaded fired");

  const callBtn = document.getElementById("book-call-btn");
  
  if (callBtn) {
    console.log("--> Step 2: Found #book-call-btn element successfully");
    
    callBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("--> Step 3: Button clicked! Attempting to fire Cal modal...");
      console.log("--> Check window.Cal type:", typeof window.Cal);
      
      try {
        Cal("modal", {
          calLink: "hannah-martin-h12p3m/15min",
          config: { layout: "month", theme: "dark" }
        });
        console.log("--> Step 4: Cal('modal') command sent without JS errors.");
      } catch (err) {
        console.error("--> Step 4 FAILED with error:", err);
      }
    });
  } else {
    console.error("--> Step 2 FAILED: Could not find element with id='book-call-btn'");
  }

  // Estimator test handler
  const estimatorBtn = document.getElementById("open-estimator-btn");
  if (estimatorBtn) {
    estimatorBtn.addEventListener("click", () => {
      console.log("Estimator button clicked!");
    });
  }
});
