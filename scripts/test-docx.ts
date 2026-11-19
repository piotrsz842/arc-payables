/**
 * Test that .docx headings survive: builds a small Google-Docs-style .docx
 * (Title, heading 1-3, normal paragraphs, a list) and reads it back.
 * No API calls. Run: npm run test-docx [-- file.docx]
 */
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { extractDocument } from "../lib/documents.js";
import { splitNote } from "../lib/notes.js";

async function sampleDocx(): Promise<Buffer> {
  const p = (style: string | null, text: string) =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const li = (text: string) => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const body = [
    p("Title", "CPSC 221 Final Review"),
    p("Heading1", "Hash tables"),
    p(null, "A hash table maps keys to buckets with a hash function, so lookups take constant time on average when the table is not too full."),
    p("Heading2", "Load factor and resizing"),
    p(null, "The prof stressed the load factor n over m. Above 0.75 we double the array and rehash every key, which keeps inserts amortized O(1)."),
    li("Common mistake: forgetting to rehash all keys"),
    li("Exam tip: explain why doubling, not adding a constant"),
    p("Heading3", "Open addressing"),
    p(null, "Linear probing causes primary clustering; double hashing spreads keys out by using a second hash for the step size."),
    p("Heading1", "Heaps"),
    p(null, "A binary heap is a complete tree stored in an array; the children of index i are at 2i plus 1 and 2i plus 2."),
  ].join("");
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const style = (id: string, name: string) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/></w:style>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // Google Docs style names are lowercase ("heading 1"); "Title" is capitalised.
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles ${W}>${style("Title", "Title")}${style("Heading1", "heading 1")}${style("Heading2", "heading 2")}${style("Heading3", "heading 3")}${style("ListParagraph", "List Paragraph")}</w:styles>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

const buffer = process.argv[2] ? readFileSync(process.argv[2]) : await sampleDocx();
const doc = await extractDocument(new File([new Uint8Array(buffer)], "guide.docx"));
console.log(`title: ${doc.title}`);
const text = doc.text;
console.log("---- extracted ----\n" + text + "\n-------------------");
const sections = splitNote(text);
console.log(`${sections.length} sections:`);
for (const s of sections) console.log(`- ${s.split("\n")[0]} (${s.split(/\s+/).length} words)`);
