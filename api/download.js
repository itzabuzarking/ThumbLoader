// Vercel serverless function: /api/download
// Fetches a YouTube thumbnail server-side and returns it as a downloadable attachment.
const ALLOWED_QUALITIES = new Set([
  "maxresdefault",
  "hqdefault",
  "sddefault",
  "mqdefault",
  "default"
]);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const videoId = String(req.query.videoId || "");
  const quality = String(req.query.quality || "hqdefault");

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Please provide a valid YouTube video ID." });
  }
  if (!ALLOWED_QUALITIES.has(quality)) {
    return res.status(400).json({ error: "That thumbnail quality is not supported." });
  }

  const imageUrl = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;

  try {
    const upstream = await fetch(imageUrl, {
      headers: { "User-Agent": "ThumbLoader/1.0 thumbnail downloader" }
    });

    if (!upstream.ok) {
      return res.status(404).json({ error: "This thumbnail quality is not available for that video." });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return res.status(502).json({ error: "The thumbnail host returned an unexpected response." });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!bytes.length) {
      return res.status(404).json({ error: "The thumbnail image was empty." });
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", `attachment; filename="thumbloader-${videoId}-${quality}.jpg"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(bytes);
  } catch (error) {
    console.error("ThumbLoader download error:", error);
    return res.status(502).json({ error: "Unable to fetch the thumbnail right now. Please try again." });
  }
};
