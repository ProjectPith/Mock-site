import { onRequestPost, onRequestOptions } from './functions/api/create-checkout-session.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route API calls directly to your backend functions
    if (url.pathname === '/api/create-checkout-session') {
      const context = { request, env, ctx };
      
      if (request.method === 'POST') {
        return onRequestPost(context);
      }
      if (request.method === 'OPTIONS') {
        return onRequestOptions(context);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Pass all other requests through to your static site assets
    return env.ASSETS.fetch(request);
  }
};
