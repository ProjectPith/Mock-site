import onRequestPost from './functions/api/create-checkout-session.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route /api/create-checkout-session to your function
    if (url.pathname === '/api/create-checkout-session' && request.method === 'POST') {
      return onRequestPost.onRequestPost({ request, env });
    }

    // Serve all static HTML/CSS/JS files normally
    return env.ASSETS.fetch(request);
  }
};
