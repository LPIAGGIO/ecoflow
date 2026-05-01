// Serverless function: lee cotizaciones de Cauciones desde el snapshot
// estático de A3 Mercados.
//
// Por qué no consulta A3 directamente:
// ------------------------------------
// A3 Mercados restringe el acceso por IP a Argentina. Las funciones de
// Vercel salen con IPs de US/EU/BR y reciben 403. La solución es que
// el script `scripts/refresh-a3.js` corra desde la máquina del developer
// (con IP argentina), descargue los datos, y los guarde como JSON
// estático en public/data/a3-snapshot.json. Ese archivo se commitea
// al repo y se sirve estáticamente.
//
// Esta función mantiene el shape de respuesta original (array de
// cotizaciones) para que el frontend no necesite cambios. Solo agrega
// headers con timestamps del snapshot, para que el módulo pueda mostrar
// "actualizado hace X" en la UI.
//
// Para refrescar los datos: `npm run refresh-a3` desde una máquina con
// IP argentina, después commit + push.

import fs from "node:fs";
import path from "node:path";

// El path es relativo al cwd de la function en Vercel, que es la raíz
// del proyecto. En local (vercel dev) también funciona porque corre
// desde la raíz.
const SNAPSHOT_PATH = path.join(process.cwd(), "public", "data", "a3-snapshot.json");

export default async function handler(req, res) {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) {
      return res.status(503).json({
        error:
          "Snapshot A3 no disponible. Ejecutar `npm run refresh-a3` y commitear el resultado.",
      });
    }

    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
    const snapshot = JSON.parse(raw);

    const cauEntry = snapshot?.endpoints?.cauciones;
    if (!cauEntry) {
      return res.status(503).json({
        error: "Snapshot existe pero no contiene 'cauciones'. Refrescar el snapshot.",
      });
    }

    if (!cauEntry.ok) {
      return res.status(502).json({
        error: `El último refresh de cauciones falló: ${cauEntry.error}`,
        fetchedAt: cauEntry.fetchedAt,
      });
    }

    // Headers informativos. El cache es agresivo (5 min) porque el
    // snapshot solo cambia cuando se commitea uno nuevo.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("X-Snapshot-Generated-At", snapshot.generatedAt || "");
    res.setHeader("X-Snapshot-Fetched-At", cauEntry.fetchedAt || "");

    return res.status(200).json(cauEntry.data);
  } catch (error) {
    return res.status(500).json({
      error: `Error leyendo snapshot: ${error.message}`,
    });
  }
}
