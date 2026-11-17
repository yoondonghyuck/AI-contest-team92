import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { polymerRagStore, type PolymerSourceType } from "./server/pgVectorRagServer";

function readRequestBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_err) {
        resolve({});
      }
    });
  });
}

function sendJson(res: any, statusCode: number, payload: any) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function pgVectorRagApiPlugin(): Plugin {
  const attachMiddleware = (middlewares: any) => {
    // Pre-initialize the 3-source store in the background on server startup
    polymerRagStore.ensureInitialized().catch((err) => {
      console.warn("[Vite PG-RAG Middleware] Init warning:", err);
    });

    middlewares.use(async (req: any, res: any, next: () => void) => {
      const rawUrl = req.url || "";
      if (!rawUrl.startsWith("/api/")) {
        return next();
      }

      try {
        const parsedUrl = new URL(rawUrl, "http://localhost:5173");
        const pathname = parsedUrl.pathname;

        // 1. GET /api/rag/stats
        if (pathname === "/api/rag/stats" && req.method === "GET") {
          const stats = await polymerRagStore.getStatsSummary();
          return sendJson(res, 200, stats);
        }

        // 2. GET /api/materials (Lightweight metadata list from PostgreSQL / Hybrid index)
        if (pathname === "/api/materials" && req.method === "GET") {
          const sourceType = (parsedUrl.searchParams.get("source_type") || "ALL") as
            | "ALL"
            | PolymerSourceType;
          const query = parsedUrl.searchParams.get("query") || "";
          const grade = parsedUrl.searchParams.get("grade") || "ALL";
          const architecture = parsedUrl.searchParams.get("architecture") || "ALL";
          const morphology = parsedUrl.searchParams.get("morphology") || "ALL";
          const stageFilter = parsedUrl.searchParams.get("stage_filter") || "ALL";
          const sortBy = (parsedUrl.searchParams.get("sort_by") || "latest") as any;
          const limit = Number(parsedUrl.searchParams.get("limit") || "60");
          const offset = Number(parsedUrl.searchParams.get("offset") || "0");
          const minTgStr = parsedUrl.searchParams.get("min_tg");
          const maxTgStr = parsedUrl.searchParams.get("max_tg");
          const minTensileStr = parsedUrl.searchParams.get("min_tensile");

          const result = await polymerRagStore.listMaterialsMetadata({
            sourceType,
            query,
            grade,
            architecture,
            morphology,
            stageFilter,
            minTg: minTgStr !== null && minTgStr !== "" ? Number(minTgStr) : undefined,
            maxTg: maxTgStr !== null && maxTgStr !== "" ? Number(maxTgStr) : undefined,
            minTensile:
              minTensileStr !== null && minTensileStr !== "" ? Number(minTensileStr) : undefined,
            sortBy,
            limit,
            offset,
          });
          return sendJson(res, 200, result);
        }

        // 3. GET /api/materials/:id (Loads individual file `storage/materials/{id}.json` on demand)
        if (pathname.startsWith("/api/materials/") && req.method === "GET") {
          const rawId = decodeURIComponent(pathname.replace("/api/materials/", "").trim());
          if (!rawId) {
            return sendJson(res, 400, { error: "Missing material id" });
          }
          const detail = await polymerRagStore.getMaterialDetailById(rawId);
          if (!detail) {
            return sendJson(res, 404, { error: `Material ${rawId} not found in storage/materials` });
          }
          return sendJson(res, 200, detail);
        }

        // 4. POST /api/rag/search (3-Source Unified pgvector RAG Search for Chat & R&D)
        if (pathname === "/api/rag/search" && req.method === "POST") {
          const body = await readRequestBody(req);
          const query = String(body?.query || "");
          const topK = Number(body?.topK || 3);
          const ragResult = await polymerRagStore.searchUnifiedTriadRag(query, topK);
          return sendJson(res, 200, ragResult);
        }

        // 5. POST /api/materials/ingest (Daemon / Live ingestion into Postgres + `storage/materials/{id}.json`)
        if (pathname === "/api/materials/ingest" && req.method === "POST") {
          const body = await readRequestBody(req);
          if (!body || !body.record) {
            return sendJson(res, 400, { error: "Missing record in payload" });
          }
          const meta = await polymerRagStore.ingestMaterialRecord({
            record: body.record,
            sourceType: body.sourceType || "ACTIVE_S_TIER",
            statusStage: body.statusStage,
            statusReason: body.statusReason,
            evictedRecordId: body.evictedRecordId,
          });
          return sendJson(res, 200, { ok: true, metadata: meta });
        }

        return next();
      } catch (err: any) {
        console.error("[Vite PG-RAG API Error]:", err);
        return sendJson(res, 500, { error: err?.message || "Internal RAG Server Error" });
      }
    });
  };

  return {
    name: "polymatrix-pgvector-rag-api",
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pgVectorRagApiPlugin(),
    {
      name: "block-live-pool-full-reload",
      configureServer(server) {
        const origSend = server.ws.send.bind(server.ws);
        server.ws.send = ((payload: any, ...args: any[]) => {
          if (payload && typeof payload === "object" && payload.type === "full-reload") {
            return;
          }
          return origSend(payload, ...args);
        }) as typeof server.ws.send;
      },
      handleHotUpdate({ file }) {
        if (
          file.includes("live_synthetic_pool") ||
          file.includes("synthetic_polymers") ||
          file.includes("polymer_informatics_dataset") ||
          file.includes("storage") ||
          file.endsWith(".tmp")
        ) {
          return [];
        }
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: [/backups/, /public[\\/]+data/, /storage/, /scripts/, /\.tmp$/],
    },
  },
});
