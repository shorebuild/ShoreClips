export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!/^[a-f0-9]{32}$/.test(id)) return Response.json({ error: "Clip not found." }, { status: 404 });
  if (!env.CLIPS_BUCKET) return Response.json({ error: "Sharing service is not configured." }, { status: 503 });
  const object = await env.CLIPS_BUCKET.head("clips/" + id + ".mp4");
  if (!object) return Response.json({ error: "Clip not found." }, { status: 404 });
  return Response.json({ id, name: object.customMetadata?.name || "ShoreClips clip.mp4", createdAt: object.customMetadata?.createdAt || object.uploaded.toISOString() }, {
    headers: { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*" }
  });
}