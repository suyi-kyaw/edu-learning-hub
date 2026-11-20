export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/lessons") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM lessons ORDER BY id ASC"
      ).all();

      return Response.json(results, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
