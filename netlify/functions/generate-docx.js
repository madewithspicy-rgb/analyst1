const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat
} = require('docx');

const ACCENT = "E8401A";
const LIGHT_BG = "FFF5F2";
const GRAY_BG = "F5F5F5";
const DARK = "1A1A1A";
const MUTED = "777777";
const GREEN_BG = "F0FFF4";
const GREEN = "22C55E";

const brd = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
const borders = { top: brd, bottom: brd, left: brd, right: brd };
const noBrd = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBrd, bottom: noBrd, left: noBrd, right: noBrd };
const accentLeft = { top: brd, bottom: brd, right: brd, left: { style: BorderStyle.SINGLE, size: 16, color: ACCENT } };
const greenLeft = { top: brd, bottom: brd, right: brd, left: { style: BorderStyle.SINGLE, size: 16, color: GREEN } };

function sp(before, after) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: before || 0, after: after || 0 } });
}

function priorityLabel(p) {
  if (p === "high") return { text: " ВЫСОКИЙ ПРИОРИТЕТ ", fill: ACCENT };
  if (p === "medium") return { text: " СРЕДНИЙ ПРИОРИТЕТ ", fill: "F59E0B" };
  return { text: " НИЗКИЙ ПРИОРИТЕТ ", fill: "22C55E" };
}

function buildDoc(d) {
  const children = [];
  const siteName = d.site_name || "Клиент";
  const siteUrl = d.url || "";

  // ── HEADER ──────────────────────────────────────────────────────────────────
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [6500, 2860],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          shading: { fill: ACCENT, type: ShadingType.CLEAR },
          margins: { top: 220, bottom: 220, left: 320, right: 320 },
          width: { size: 6500, type: WidthType.DXA },
          children: [
            new Paragraph({ children: [new TextRun({ text: "SPICY MEDIA", size: 28, bold: true, color: "FFFFFF", font: "Arial", characterSpacing: 80 })] }),
            new Paragraph({ children: [new TextRun({ text: "Рекомендации по конверсии сайта", size: 20, color: "FFCFBF", font: "Arial" })] }),
          ]
        }),
        new TableCell({
          borders: noBorders,
          shading: { fill: "111111", type: ShadingType.CLEAR },
          margins: { top: 220, bottom: 220, left: 220, right: 220 },
          width: { size: 2860, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: siteName, size: 24, bold: true, color: "FFFFFF", font: "Arial" })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: siteUrl, size: 17, color: "AAAAAA", font: "Arial" })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" }), size: 17, color: "AAAAAA", font: "Arial" })] }),
          ]
        })
      ]
    })]
  }));

  children.push(sp(160, 0));

  // ── META CHIPS ───────────────────────────────────────────────────────────────
  const score = Math.min(10, Math.max(1, parseInt(d.conversion_score) || 5));
  const metaItems = [
    ["Ниша", d.detected_niche || "—"],
    ["ЦА", d.detected_audience || "—"],
    ["Тон", d.detected_tone || "—"],
    ["Конверсионность", score + " / 10"],
  ];
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 2340, 2340, 2340],
    rows: [new TableRow({
      children: metaItems.map(([label, val]) => new TableCell({
        borders,
        shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        width: { size: 2340, type: WidthType.DXA },
        children: [
          new Paragraph({ children: [new TextRun({ text: label, size: 17, color: MUTED, font: "Arial" })] }),
          new Paragraph({ children: [new TextRun({ text: val, size: 20, bold: true, color: DARK, font: "Arial" })] }),
        ]
      }))
    })]
  }));

  children.push(sp(160, 0));

  // ── ASSESSMENT ───────────────────────────────────────────────────────────────
  if (d.overall_assessment) {
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [new TableRow({
        children: [new TableCell({
          borders: accentLeft,
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 220, right: 220 },
          width: { size: 9360, type: WidthType.DXA },
          children: [
            new Paragraph({ children: [new TextRun({ text: "ОБЩАЯ ОЦЕНКА", size: 17, bold: true, color: ACCENT, font: "Arial", characterSpacing: 60 })] }),
            new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: d.overall_assessment, size: 21, color: "333333", font: "Arial" })] }),
          ]
        })]
      })]
    }));
  }

  children.push(sp(280, 0));

  // ════════════════════════════════════════════════════════════════════════════
  // EXISTING BLOCKS
  // ════════════════════════════════════════════════════════════════════════════
  children.push(new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "ПРАВКИ ПО БЛОКАМ", size: 32, bold: true, color: DARK, font: "Arial", characterSpacing: 60 })]
  }));
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT }, bottom: noBrd, left: noBrd, right: noBrd },
      width: { size: 9360, type: WidthType.DXA },
      children: [new Paragraph({ children: [] })]
    })] })]
  }));

  const blocks = d.blocks || [];
  blocks.forEach(function(block, idx) {
    const pl = priorityLabel(block.priority);

    // Block header row
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [new TableRow({
        children: [new TableCell({
          borders: noBorders,
          shading: { fill: "1A1A1A", type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 220, right: 220 },
          width: { size: 9360, type: WidthType.DXA },
          children: [new Paragraph({
            children: [
              new TextRun({ text: "Блок " + block.number + "  ", size: 20, color: "888888", font: "Arial" }),
              new TextRun({ text: (block.name || "").toUpperCase(), size: 22, bold: true, color: "FFFFFF", font: "Arial", characterSpacing: 40 }),
              new TextRun({ text: "   " }),
              new TextRun({ text: pl.text, size: 17, bold: true, color: "FFFFFF", font: "Arial",
                shading: { fill: pl.fill, type: ShadingType.CLEAR } }),
            ]
          })]
        })]
      })]
    }));

    // Problem
    if (block.current_problem) {
      children.push(new Paragraph({
        spacing: { before: 120, after: 80 },
        indent: { left: 0 },
        children: [
          new TextRun({ text: "Проблема: ", size: 20, bold: true, color: ACCENT, font: "Arial" }),
          new TextRun({ text: block.current_problem, size: 20, color: "555555", font: "Arial" }),
        ]
      }));
    }

    // Changes
    const changes = block.changes || [];
    changes.forEach(function(change) {
      children.push(new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: "▸ " + (change.element || ""), size: 20, bold: true, color: DARK, font: "Arial" }),
        ]
      }));
      if (change.action) {
        children.push(new Paragraph({
          spacing: { before: 0, after: 60 },
          indent: { left: 280 },
          children: [new TextRun({ text: change.action, size: 20, color: "333333", font: "Arial" })]
        }));
      }
      if (change.copy_en) {
        children.push(new Table({
          width: { size: 9000, type: WidthType.DXA },
          columnWidths: [9000],
          margins: { top: 0, bottom: 80, left: 280, right: 0 },
          rows: [new TableRow({
            children: [new TableCell({
              borders: { top: brd, bottom: brd, right: brd, left: { style: BorderStyle.SINGLE, size: 10, color: "FFAA88" } },
              shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 180, right: 180 },
              width: { size: 9000, type: WidthType.DXA },
              children: [
                new Paragraph({ children: [new TextRun({ text: "EN copy", size: 16, bold: true, color: ACCENT, font: "Arial" })] }),
                new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: change.copy_en, size: 20, color: DARK, font: "Arial", italics: true })] }),
              ]
            })]
          })]
        }));
      }
    });

    children.push(sp(80, 0));

    // Divider between blocks (except last)
    if (idx < blocks.length - 1) {
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({ children: [new TableCell({
          borders: { top: noBrd, bottom: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" }, left: noBrd, right: noBrd },
          width: { size: 9360, type: WidthType.DXA },
          children: [new Paragraph({ children: [] })]
        })] })]
      }));
      children.push(sp(80, 0));
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // NEW BLOCKS TO ADD
  // ════════════════════════════════════════════════════════════════════════════
  const newBlocks = d.new_blocks || [];
  if (newBlocks.length > 0) {
    children.push(sp(280, 0));
    children.push(new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: "НОВЫЕ БЛОКИ", size: 32, bold: true, color: DARK, font: "Arial", characterSpacing: 60 })]
    }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [new TableRow({ children: [new TableCell({
        borders: { top: { style: BorderStyle.SINGLE, size: 4, color: GREEN }, bottom: noBrd, left: noBrd, right: noBrd },
        width: { size: 9360, type: WidthType.DXA },
        children: [new Paragraph({ children: [] })]
      })] })]
    }));

    newBlocks.forEach(function(block, idx) {
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
          children: [new TableCell({
            borders: noBorders,
            shading: { fill: "0F3320", type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 220, right: 220 },
            width: { size: 9360, type: WidthType.DXA },
            children: [new Paragraph({
              children: [
                new TextRun({ text: "Новый блок " + (block.number || "") + "  ", size: 20, color: "88CC99", font: "Arial" }),
                new TextRun({ text: (block.name || "").toUpperCase(), size: 22, bold: true, color: "FFFFFF", font: "Arial", characterSpacing: 40 }),
                new TextRun({ text: "   " }),
                new TextRun({ text: " ДОБАВИТЬ ", size: 17, bold: true, color: "FFFFFF", font: "Arial",
                  shading: { fill: GREEN, type: ShadingType.CLEAR } }),
              ]
            })]
          })]
        })]
      }));

      if (block.reason) {
        children.push(new Paragraph({
          spacing: { before: 100, after: 80 },
          children: [
            new TextRun({ text: "Зачем: ", size: 20, bold: true, color: GREEN, font: "Arial" }),
            new TextRun({ text: block.reason, size: 20, color: "555555", font: "Arial" }),
          ]
        }));
      }

      const content = block.content || [];
      content.forEach(function(item) {
        children.push(new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [new TextRun({ text: "▸ " + (item.element || ""), size: 20, bold: true, color: DARK, font: "Arial" })]
        }));
        if (item.copy_en) {
          children.push(new Table({
            width: { size: 9000, type: WidthType.DXA },
            columnWidths: [9000],
            margins: { top: 0, bottom: 80, left: 280, right: 0 },
            rows: [new TableRow({
              children: [new TableCell({
                borders: { top: brd, bottom: brd, right: brd, left: { style: BorderStyle.SINGLE, size: 10, color: GREEN } },
                shading: { fill: GREEN_BG, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 180, right: 180 },
                width: { size: 9000, type: WidthType.DXA },
                children: [
                  new Paragraph({ children: [new TextRun({ text: "EN copy", size: 16, bold: true, color: GREEN, font: "Arial" })] }),
                  new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: item.copy_en, size: 20, color: DARK, font: "Arial", italics: true })] }),
                ]
              })]
            })]
          }));
        }
      });

      if (idx < newBlocks.length - 1) children.push(sp(100, 0));
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TASKS
  // ════════════════════════════════════════════════════════════════════════════
  const tasks = d.tasks || [];
  if (tasks.length > 0) {
    children.push(sp(300, 0));
    children.push(new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: "СПИСОК ЗАДАЧ", size: 32, bold: true, color: DARK, font: "Arial", characterSpacing: 60 })]
    }));

    const whoColors = { "PM": "3B82F6", "Designer": "8B5CF6", "Developer": "F59E0B" };
    const taskRows = tasks.map(function(t) {
      const col = whoColors[t.who] || "888888";
      return new TableRow({
        children: [
          new TableCell({
            borders,
            shading: { fill: col + "18", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            width: { size: 1600, type: WidthType.DXA },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: t.who || "", bold: true, size: 20, color: col, font: "Arial" })]
            })]
          }),
          new TableCell({
            borders,
            margins: { top: 100, bottom: 100, left: 180, right: 180 },
            width: { size: 7760, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: t.task || "", size: 20, color: DARK, font: "Arial" })] })]
          })
        ]
      });
    });

    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1600, 7760],
      rows: taskRows
    }));
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  children.push(sp(400, 0));
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [new TableCell({
      borders: noBorders,
      shading: { fill: "111111", type: ShadingType.CLEAR },
      margins: { top: 140, bottom: 140, left: 240, right: 240 },
      width: { size: 9360, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Spicy Media  •  Документ сформирован автоматически  •  Только для внутреннего использования", size: 17, color: "666666", font: "Arial" })]
      })]
    })] })]
  }));

  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22, color: DARK } } }
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
        }
      },
      children: children
    }]
  });
}

exports.handler = async function (event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: headers, body: "Method Not Allowed" };

  var body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  if (!body.data) return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "No data provided" }) };

  try {
    var doc = buildDoc(body.data);
    var buffer = await Packer.toBuffer(doc);
    var base64 = buffer.toString("base64");
    return {
      statusCode: 200,
      headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
      body: JSON.stringify({ docx: base64 }),
    };
  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "DOCX generation failed: " + err.message }) };
  }
};
