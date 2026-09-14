import onRequestPost from './functions/api/create-checkout-session.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route API requests to your Stripe checkout session handler
    if (url.pathname === '/api/create-checkout-session' && request.method === 'POST') {
      return onRequestPost.onRequestPost({ request, env });
    }

    // Serve all frontend HTML/CSS/JS assets
    return env.ASSETS.fetch(request);
  }
};
