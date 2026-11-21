export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      // your API routes using env.DB
      return new Response('ok');
    }

    // fall through to static assets
    return env.ASSETS.fetch(request);
  },
};
