// NOTE: Requires the `docx` npm package.
// Install with: npm install docx
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
} from "docx";
import type { GeneratedMotion, GeneratedMotionSection } from "./documentGenerator";

export interface DocxExportOptions {
  motion: GeneratedMotion;
  caseNumber?: string;
  fileName?: string;
}

const FONT = "Times New Roman";
const FONT_SIZE = 24; // half-points: 24 = 12pt
const HEADING_SIZE = 24;
const LINE_SPACING_DOUBLE = 480; // twips: 480 = double-spacing
const ONE_INCH = convertInchesToTwip(1);

// ─── Helper: plain paragraph ────────────────────────────────────────────────

function bodyParagraph(text: string, bold = false, centered = false): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: FONT,
        size: FONT_SIZE,
        bold,
      }),
    ],
    alignment: centered ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { line: LINE_SPACING_DOUBLE },
    indent: { left: 0 },
  });
}

function headingParagraph(text: string, level: any = HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: HEADING_SIZE,
        bold: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING_DOUBLE, before: 240, after: 120 },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "", font: FONT, size: FONT_SIZE })],
    spacing: { line: LINE_SPACING_DOUBLE },
  });
}

// ─── Caption block ───────────────────────────────────────────────────────────

function buildCaption(caption: GeneratedMotion["caption"]): Paragraph[] {
  const border = {
    top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
  };

  const centeredBold = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text, font: FONT, size: FONT_SIZE, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING_DOUBLE },
      border,
    });

  const centeredNormal = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text, font: FONT, size: FONT_SIZE })],
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING_DOUBLE },
      border,
    });

  return [
    centeredBold(caption.court.toUpperCase()),
    emptyLine(),
    centeredNormal(caption.plaintiff),
    centeredNormal("v."),
    centeredNormal(caption.defendant),
    emptyLine(),
    centeredNormal(`Case No. ${caption.case_number}`),
    centeredNormal(`Judge: ${caption.judge}`),
    emptyLine(),
  ];
}

// ─── Section builder ─────────────────────────────────────────────────────────

function buildSection(section: GeneratedMotionSection): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Section heading
  if (section.title) {
    paragraphs.push(headingParagraph(section.title.toUpperCase()));
  }

  // Main content — split on newlines to preserve paragraph breaks
  if (section.content) {
    const lines = section.content.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      paragraphs.push(bodyParagraph(line));
    }
  }

  // Subsections with I., A., 1. hierarchy
  if (section.subsections?.length) {
    section.subsections.forEach((sub, subIdx) => {
      const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      const prefix = romanNumerals[subIdx] ?? String(subIdx + 1);

      paragraphs.push(emptyLine());
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${prefix}. ${sub.heading.toUpperCase()}`,
              font: FONT,
              size: HEADING_SIZE,
              bold: true,
            }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { line: LINE_SPACING_DOUBLE, before: 240 },
        })
      );

      // Sub-content
      const subLines = sub.content.split("\n").filter((l) => l.trim().length > 0);
      for (const line of subLines) {
        paragraphs.push(bodyParagraph(line));
      }
    });
  }

  paragraphs.push(emptyLine());
  return paragraphs;
}

// ─── Certificate of Service ──────────────────────────────────────────────────

function buildCertificateOfService(): Paragraph[] {
  return [
    emptyLine(),
    headingParagraph("CERTIFICATE OF SERVICE"),
    bodyParagraph(
      "I hereby certify that on this date, a true and correct copy of the foregoing was served upon all counsel of record via the Court's Electronic Case Filing (ECF) system, which will send notification of such filing to all registered participants."
    ),
    emptyLine(),
    bodyParagraph("Respectfully submitted,"),
    emptyLine(),
    bodyParagraph("_________________________________"),
    bodyParagraph("Attorney Name"),
    bodyParagraph("Bar Number:"),
    bodyParagraph("Firm Name"),
    bodyParagraph("Address"),
    bodyParagraph("Phone | Email"),
  ];
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportMotionToDocx(options: DocxExportOptions): Promise<void> {
  const { motion, caseNumber, fileName } = options;

  const allParagraphs: Paragraph[] = [];

  // 1. Caption block
  allParagraphs.push(...buildCaption(motion.caption));

  // 2. Bold centered document title
  allParagraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: motion.caption.document_title,
          font: FONT,
          size: FONT_SIZE,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE_SPACING_DOUBLE, before: 240, after: 240 },
    })
  );
  allParagraphs.push(emptyLine());

  // 3. Body sections
  for (const section of motion.sections) {
    allParagraphs.push(...buildSection(section));
  }

  // 4. Certificate of Service
  allParagraphs.push(...buildCertificateOfService());

  // ── Build docx Document ──────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "roman-numeral-list",
          levels: [
            {
              level: 0,
              format: NumberFormat.UPPER_ROMAN,
              text: "%1.",
              alignment: AlignmentType.LEFT,
            },
            {
              level: 1,
              format: NumberFormat.UPPER_LETTER,
              text: "%2.",
              alignment: AlignmentType.LEFT,
            },
            {
              level: 2,
              format: NumberFormat.DECIMAL,
              text: "%3.",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: ONE_INCH,
              right: ONE_INCH,
              bottom: ONE_INCH,
              left: ONE_INCH,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: FONT_SIZE,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: allParagraphs,
      },
    ],
  });

  // ── Generate blob and trigger download ───────────────────────────────────
  const blob = await Packer.toBlob(doc);

  const motionTypeSafe = motion.caption.document_title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);

  const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const caseNum = (caseNumber ?? motion.caption.case_number ?? "case")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 20);

  const autoFileName =
    fileName ?? `${caseNum}_${motionTypeSafe}_${dateStr}.docx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = autoFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
