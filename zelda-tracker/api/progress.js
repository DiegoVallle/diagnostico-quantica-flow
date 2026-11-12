// Guarda o progresso do tracker no Vercel Blob, um arquivo JSON por código.
import { put, head } from "@vercel/blob";
import { createHash } from "node:crypto";

const MAX_BYTES = 200 * 1024;

function pathFor(code) {
  const h = createHash("sha256").update("diario-de-hyrule:" + code).digest("hex");
  return `oot-remake/${h}.json`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const code = String(req.headers["x-code"] || "");
  if (!/^[\w\-.]{6,64}$/.test(code)) {
    return res.status(400).json({ error: "Código inválido" });
  }
  const pathname = pathFor(code);

  try {
    if (req.method === "GET") {
      let meta;
      try {
        meta = await head(pathname);
      } catch (e) {
        return res.status(200).json({}); // ainda não existe progresso para este código
      }
      const v = new Date(meta.uploadedAt).getTime();
      const r = await fetch(`${meta.url}?v=${v}`, { cache: "no-store" });
      if (!r.ok) return res.status(502).json({ error: "Falha ao ler o progresso" });
      return res.status(200).json(await r.json());
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const data = {
        c: body.c && typeof body.c === "object" ? body.c : {},
        x: body.x && typeof body.x === "object" ? body.x : {},
        u: Number(body.u) || Date.now(),
      };
      const json = JSON.stringify(data);
      if (json.length > MAX_BYTES) return res.status(413).json({ error: "Progresso grande demais" });
      await put(pathname, json, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
      return res.status(200).json({ ok: true, u: data.u });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Método não permitido" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro no servidor" });
  }
}
