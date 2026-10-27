export async function onRequestGet({ params, env, request }) {
  const id = String(params.id || "");
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response("Clip not found.", { status: 404 });
  if (!env.CLIPS_BUCKET) return new Response("Sharing service is not configured.", { status: 503 });
  const key = "clips/" + id + ".mp4";
  const head = await env.CLIPS_BUCKET.head(key);
  if (!head) return new Response("Clip not found.", { status: 404 });
  const rangeHeader = request.headers.get("Range");
  let range = null;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match || (!match[1] && !match[2])) return new Response("Invalid range.", { status: 416, headers: { "Content-Range": "bytes */" + head.size } });
    let start, end;
    if (!match[1]) {
      const suffix = Number(match[2]);
      if (!Number.isFinite(suffix) || suffix <= 0) return new Response("Invalid range.", { status: 416 });
      start = Math.max(0, head.size - suffix); end = head.size - 1;
    } else {
      start = Number(match[1]); end = match[2] ? Number(match[2]) : head.size - 1;
    }
    if (start >= head.size || end < start) return new Response("Range not satisfiable.", { status: 416, headers: { "Content-Range": "bytes */" + head.size } });
    end = Math.min(end, head.size - 1);
    range = { offset: start, length: end - start + 1 };
  }
  const object = await env.CLIPS_BUCKET.get(key, range ? { range } : {});
  if (!object) return new Response("Clip not found.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Content-Type-Options", "nosniff");
  if (range) {
    headers.set("Content-Length", String(range.length));
    headers.set("Content-Range", "bytes " + range.offset + "-" + (range.offset + range.length - 1) + "/" + head.size);
  } else {
    headers.set("Content-Length", String(head.size));
  }
  return new Response(object.body, { status: range ? 206 : 200, headers });
}