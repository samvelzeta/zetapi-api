// ======================
// 🔥 PARSER SVELTEKIT (__data.json)
// ======================
function parseAV1Nodes(json: any) {

  const servers: any[] = [];

  if (!json?.nodes) return servers;

  const flat = JSON.stringify(json.nodes);

  // 🔥 reconstrucción básica (rápida y efectiva)
  const matches = flat.match(/"server":\d+,"url":\d+/g);

  if (!matches) return servers;

  const allValues = JSON.stringify(json.nodes);

  const values = allValues.match(/"(.*?)"/g)?.map(v => v.replace(/"/g, "")) || [];

  for (const m of matches) {

    const nums = m.match(/\d+/g);
    if (!nums || nums.length < 2) continue;

    const serverIndex = parseInt(nums[0]);
    const urlIndex = parseInt(nums[1]);

    const server = values[serverIndex];
    const url = values[urlIndex];

    if (!url) continue;

    servers.push({
      name: "animeav1",
      server,
      embed: url,
      type: server === "HLS" ? "hls" : "embed",
      lang: "sub" // se ajusta luego
    });
  }

  // 🔥 idioma
  const raw = JSON.stringify(json);

  if (raw.includes("DUB")) {
    servers.forEach(s => {
      if (s.server === "HLS") s.lang = "latino";
    });
  }

  return servers;
}
