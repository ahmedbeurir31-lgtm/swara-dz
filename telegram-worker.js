const SITE_ORIGIN = "https://ahmedbeurir31-lgtm.github.io";
const MAX_PHOTO_BYTES = 9 * 1024 * 1024;

function json(body, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (origin === SITE_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = SITE_ORIGIN;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (origin !== SITE_ORIGIN) {
      return json({ error: "Origin not allowed" }, 403, null);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": SITE_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({ error: "Telegram destination is not configured" }, 503, origin);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || "0");
    if (declaredLength > MAX_PHOTO_BYTES + 64 * 1024) {
      return json({ error: "Photo is too large" }, 413, origin);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Invalid form data" }, 400, origin);
    }

    if (form.get("consent") !== "yes") {
      return json({ error: "Visitor consent is required" }, 400, origin);
    }

    const photo = form.get("photo");
    if (!(photo instanceof File) || !photo.size || photo.size > MAX_PHOTO_BYTES) {
      return json({ error: "Photo is missing or too large" }, 413, origin);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
      return json({ error: "Unsupported image type" }, 415, origin);
    }

    const telegramForm = new FormData();
    telegramForm.set("chat_id", env.TELEGRAM_CHAT_ID);
    telegramForm.set("caption", "صورة أرسلها الزائر بموافقته عبر SWARA DZ.");
    telegramForm.set("photo", photo, photo.name || "swara-dz.jpg");

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
        { method: "POST", body: telegramForm },
      );
      if (!response.ok) {
        return json({ error: "Telegram could not deliver this photo" }, 502, origin);
      }
      return json({ ok: true }, 200, origin);
    } catch {
      return json({ error: "Telegram is temporarily unavailable" }, 502, origin);
    }
  },
};