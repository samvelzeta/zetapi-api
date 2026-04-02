const R2_BASE = "https://pub-902a08f7869e43be91aefa973d603954.r2.dev";

// ==============================
// 🔥 OBTENER INDEX
// ==============================
export async function getR2Index(slug: string) {
  try {
    const res = await fetch(`${R2_BASE}/${slug}/_index.json`);

    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
}
