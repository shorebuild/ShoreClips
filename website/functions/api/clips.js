export async function onRequestPost({ request, env }) {
  if (!env.CLIPS_BUCKET || !env.SHARE_UPLOAD_TOKEN) return Response.json({ error: "Sharing service is not configured. Add the CLIPS_BUCKET R2 binding and SHARE_UPLOAD_TOKEN secret." }, { status: 503 });
  const auth = request.headers.get("Authorization") || "";
  if (auth !== "Bearer " + env.SHARE_UPLOAD_TOKEN) return Response.json({ error: "Upload authorization failed. Check the ShoreClips sharing token." }, { status: 401 });
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 150 * 1024 * 1024) return Response.json({ error: "Clip exceeds the 150 MB upload limit." }, { status: 413 });
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "video/mp4") return Response.json({ error: "Only validated MP4 clips can be shared. Export the clip again in ShoreClips first." }, { status: 415 });
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 150 * 1024 * 1024) return Response.json({ error: "Clip is empty or exceeds the 150 MB upload limit." }, { status: 413 });
  const id = crypto.randomUUID().replaceAll("-", "");
  const rawName = request.headers.get("X-Clip-Name") || "ShoreClips clip.mp4";
  let name = "ShoreClips clip.mp4";
  try { name = decodeURIComponent(rawName).replace(/[\\/\\r\\n\\0]/g, "-").slice(0, 120) || name; } catch {}
  await env.CLIPS_BUCKET.put("clips/" + id + ".mp4", bytes, {
    httpMetadata: { contentType: "video/mp4", cacheControl: "public, max-age=3600" },
    customMetadata: { name, createdAt: new Date().toISOString() }
  });
  return Response.json({ id, url: new URL("/c/" + id, request.url).toString() }, { headers: { "Cache-Control": "no-store" } });
}