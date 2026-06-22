// One-off probe to discover the correct NeuralWatt API route/model.
// Usage:  node scripts/probe-neuralwatt.js
"use strict";

require("fs")
  .readFileSync(require("path").resolve(process.cwd(), ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.indexOf("=") === -1) return;
    const k = line.slice(0, line.indexOf("=")).trim();
    const v = line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[k] = v;
  });

const base = process.env.NEURALWATT_BASE_URL || "https://api.neuralwatt.com/v1";
const key = process.env.NEURALWATT_API_KEY || "";
const model = process.env.NEURALWATT_MODEL || "glm-5.2";

console.log("BASE =", base);
console.log("KEY  =", key ? key.slice(0, 10) + "..." + key.slice(-4) : "(empty)");
console.log("MODEL=", model);
console.log("");

const origin = base.replace(/^(https?:\/\/[^/]+).*/i, "$1");

const candidates = [
  base.replace(/\/$/, "") + "/chat/completions",
  origin + "/v1/chat/completions",
  origin + "/openai/v1/chat/completions",
  origin + "/api/v1/chat/completions",
].filter((v, i, a) => a.indexOf(v) === i);

const body = JSON.stringify({
  model,
  messages: [{ role: "user", content: "Reply with the single word OK" }],
  max_tokens: 10,
});

(async () => {
  for (const url of candidates) {
    process.stdout.write("TRY " + url + "  ->  ");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body,
      });
      const text = await res.text();
      console.log(
        "HTTP " + res.status + " | " + text.slice(0, 300).replace(/\s+/g, " "),
      );
    } catch (e) {
      console.log("ERROR " + e.message);
    }
  }

  const modelsUrl = base.replace(/\/$/, "") + "/models";
  process.stdout.write("\nLIST " + modelsUrl + "  ->  ");
  try {
    const res = await fetch(modelsUrl, {
      headers: { Authorization: "Bearer " + key },
    });
    const text = await res.text();
    console.log(
      "HTTP " + res.status + " | " + text.slice(0, 400).replace(/\s+/g, " "),
    );
  } catch (e) {
    console.log("ERROR " + e.message);
  }
})();