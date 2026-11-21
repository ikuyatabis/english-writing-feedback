"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const pages = [
  ["伊都への恋文", "ito"],
  ["待ってろ文キャン", "buncan"],
  ["三田キャンへの道", "mita"],
  ["持ち込み診療所", "misc"],
  ["ことのは研究室", "trans"],
  ["より抜き図書館", "sum"],
  ["英検の庵", "eiken"]
];
const modes = ["screen", "word", "pdf", "both"];
const expectedMenu = [
  ["screen", "画面結果のみ（標準）※最速です"],
  ["word", "Word"],
  ["pdf", "PDF"],
  ["both", "Word＋PDF"]
];

function getExportFunction(html, page) {
  const marker = "function getExportInstruction(){";
  const start = html.indexOf(marker);
  assert(start >= 0, page + ": output instruction function is missing");
  assert.equal(html.indexOf(marker, start + marker.length), -1, page + ": multiple output functions");
  const end = html.indexOf("\n}\n", start);
  assert(end > start, page + ": output instruction function has no ending");
  const source = html.slice(start, end + 2);
  new vm.Script(source, { filename: page + "/index.html" });
  return source;
}

function getOutputInstruction(source, mode) {
  const document = {
    querySelector(selector) {
      assert.equal(selector, 'input[name="outputFormat"]:checked');
      return { value: mode };
    }
  };
  return vm.runInNewContext(
    source + "\ngetExportInstruction();",
    { document },
    { timeout: 3000 }
  );
}

function checkMenu(html, page) {
  const radios = [...html.matchAll(/<input\b[^>]*\bname="outputFormat"[^>]*>/g)];
  assert.equal(radios.length, 4, page + ": exactly four output radios required");
  const actual = radios.map(([tag]) => {
    const value = tag.match(/\bvalue="([^"]+)"/);
    assert(value, page + ": missing radio value");
    return value[1];
  });
  assert.deepEqual(actual, expectedMenu.map(([value]) => value), page + ": radio order");
  assert(/\bchecked\b/.test(radios[0][0]), page + ": screen must be the default");
  assert.equal(radios.filter(([tag]) => /\bchecked\b/.test(tag)).length, 1);
  const labels = [...html.matchAll(/<label\b[^>]*>\s*<input\b[^>]*\bname="outputFormat"[^>]*>\s*([^<]*)<\/label>/g)];
  assert.deepEqual(labels.map(x => x[1].trim()), expectedMenu.map(([, label]) => label), page + ": user-facing labels");
}

const commonWordRequirements = [
  "【Word書式：共通仕様】",
  "JIS B5（182×257mm）縦",
  "余白は上下左右とも15mm",
  "本文幅は約152mm",
  "通常本文（表の外）は10.5ptに固定する",
  "ページ数や内容量を理由に10pt・9.5ptなどへ縮小しない",
  "自然な位置で次ページに送る",
  "表内の文字サイズは後述の表専用規定を優先する",
  "英語面の修正一覧は明細行の全セルを8pt",
  "その他の表の本文は日本語中心なら10pt，英語中心なら8pt",
  "見出し行は原則10.5pt",
  "日本語本文はＭＳ 明朝（太字は禁止）",
  "ＭＳ ゴシック＋太字",
  "通常本文の英字・数字はCentury",
  "Century Schoolbook Bold",
  "表の見出し行は全列の見出しセルを中央揃え（MSゴシック・太字）",
  "見出しの「減点」も例外なく中央揃え",
  "「減点」列は，見出しは中央揃え，明細の減点数値は右揃え"
  "項目が変わる箇所では必ず改行",
  "別項目の見出し前に空行を１行",
  "英作文段落冒頭の字下げは段落書式でなく半角スペース２個",
  "文末ピリオドの後で同じ段落の次文が続く場合だけ２個"
];

for (const [name, directory] of pages) {
  const html = fs.readFileSync(path.join(root, directory, "index.html"), "utf8");
  const functionSource = getExportFunction(html, directory);
  for (const mode of modes) {
    test(name + " / " + mode + ": export instruction contract", () => {
      checkMenu(html, directory);
      const prompt = getOutputInstruction(functionSource, mode);
      assert.equal(typeof prompt, "string");
      if (mode === "screen") {
        assert.equal(prompt, "", "screen-only must not append file output instructions");
        return;
      }

      assert(prompt.includes("【添削結果の出力形式：最優先】"));
      assert(prompt.includes("【ファイル出力：Word経由でPDF生成】"));
      assert(prompt.includes("完成ファイルがあれば本文を画面に重複表示しない"));
      assert(!prompt.includes("本文は原則10.5pt（収まらないときは10pt"));
      for (const item of commonWordRequirements) {
        assert(prompt.includes(item), name + " / " + mode + ": missing " + item);
      }

      const requiredFormat = {
        word: "指定形式：Word（.docx）",
        pdf: "指定形式：PDF（.pdf）",
        both: "指定形式：PDF（.pdf）とWord（.docx）"
      };
      assert(prompt.includes(requiredFormat[mode]));
      const needsPdf = mode === "pdf" || mode === "both";
      assert.equal(prompt.includes("【PDF書式：Wordから変換】"), needsPdf);
      assert.equal(prompt.includes("PDFを直接作り直して代用しない"), needsPdf);

      if (mode === "word") {
        assert(prompt.includes("Wordのみ指定時は完成.docxのみを提供する"));
      } else if (mode === "pdf") {
        assert(prompt.includes("PDFのみ指定時は完成.docxをPDFに変換して.pdfのみを提供"));
        assert(prompt.includes("作業用.docxのリンクは提示しない"));
      } else {
        assert(prompt.includes("PDF＋Word指定時は完成した同一.docxとそのWordから変換した.pdfを両方提供"));
      }
    });
  }
}

// The sample's score-first layout is clinic-specific; do not override other pages' rubrics.
test("Clinic score is displayed first without changing other content display orders", () => {
  const clinic = fs.readFileSync(path.join(root, "misc", "index.html"), "utf8");
  const scoreFirst = '最初の見出し「１．採点結果・減点内訳」の直後';
  assert(clinic.includes(scoreFirst), "clinic must state the score-first rule");
  assert(clinic.includes('「得点：〈最終得点〉／〈満点〉点」'));
  assert(clinic.includes("採点を保留する場合は得点を示さない"));
  for (const [name, directory] of pages) {
    if (directory === "misc") continue;
    const html = fs.readFileSync(path.join(root, directory, "index.html"), "utf8");
    assert(!html.includes(scoreFirst), name + ": must retain its own result display order");
  }
  const eiken = fs.readFileSync(path.join(root, "eiken", "index.html"), "utf8");
  assert(eiken.includes("【表示順】①形式・語数・設問条件の確認"));
});
