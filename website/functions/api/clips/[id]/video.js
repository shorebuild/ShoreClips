export async function onRequestGet({ params, env, request }) {
  const id = String(params.id || "");
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response("Clip not found.", { status: 404 });
  if (!env.CLIPS_BUCKET) return new Response("Sharing service is not configured.", { status: 503 });
  const object = await env.CLIPS_BUCKET.get("clips/" + id + ".mp4", { range: request.headers });
  if (!object) return new Response("Clip not found.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Access-Control-Allow-Origin", "*");
  if (object.range) {
    headers.set("Content-Range", "bytes " + object.range.offset + "-" + (object.range.offset + object.range.length - 1) + "/" + object.size);
  }
  return new Response(object.body, { status: object.range ? 206 : 200, headers });
}