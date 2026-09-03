/**
 * Public, read-only resolver for certificate metadata and cover images.
 * The storage bucket is private; this route serves immutable content-hash
 * paths so the ERC-721 token URI is publicly resolvable. No writes, ever.
 */

import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_PATH = /^sepolia\/(images\/)?[0-9a-f]{64}\.(json|jpg|jpeg|png|webp|avif|gif)$/i;

const CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

export const Route = createFileRoute("/api/public/certificates/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!ALLOWED_PATH.test(path)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("certificate-metadata")
          .download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        const extension = path.split(".").pop()!.toLowerCase();
        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
            // Content-hash paths are immutable.
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
