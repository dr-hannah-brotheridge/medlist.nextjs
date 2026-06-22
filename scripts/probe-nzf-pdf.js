// One-off probe of nzf.pdf to learn monograph structure.
"use strict";
const fs = require("fs");
const pdfParseMod = require("pdf-parse");
const pdfParse =
  typeof pdfParseMod === "function" ? pdfParseMod : pdfParseMod.default;

const PDF =
  process.argv[2] || "C:/Users/Lenovo User/Downloads/nzf.pdf";

(async () => {
  const buf = fs.readFileSync(PDF);
  const data = await pdfParse(buf);
  const text = data.text || "";
  console.log("PAGES       :", data.numpages);
  console.log("TEXT LENGTH :", text.length);

  const probes = ["Paracetamol", "Amoxicillin", "Metformin", "Atorvastatin", "Ibuprofen"];
  for (const drug of probes) {
    const idx = text.indexOf(drug);
    console.log("\n--- " + drug + " (first at " + idx + ") ---");
    if (idx >= 0) {
      console.log(JSON.stringify(text.slice(Math.max(0, idx - 80), idx + 600)));
    }
  }

  console.log("\n--- FIRST 1500 CHARS ---");
  console.log(JSON.stringify(text.slice(0, 1500)));

  const lines = text.split(/\r?\n/);
  const allCaps = lines.filter(
    (l) => l.trim() && l === l.toUpperCase() && l.trim().length > 2,
  );
  console.log("\n--- SAMPLE ALL-CAPS LINES (first 25) ---");
  console.log(JSON.stringify(allCaps.slice(0, 25), null, 2));
})();