"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "sum", "index.html"), "utf8");
const homepage = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, "sum/index.html must contain an inline script");
const script = scriptMatch[1];

function createHarness() {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const elements = Object.fromEntries(ids.map(id => [id, {
    value: "", checked: false, hidden: false, textContent: "",
    validity: { badInput: false }, addEventListener() {}
  }]));
  for (const [id, value] of Object.entries({
    examPoints: "40", approxWords: "100", minWords: "80",
    maxWords: "120", withinWords: "100",
    problem: "Mind wandering may be helpful or harmful.",
    answer: "注意がそれることには益も害もある。"
  })) elements[id].value = value;
  const selections = { kind: "ja", wordmode: "within", outputFormat: "screen" };
  const units = Array.from({ length: 8 }, () => ({ textContent: "" }));
  const document = {
    getElementById(id) {
      assert(elements[id], "Unknown element id: " + id);
      return elements[id];
    },
    querySelector(query) {
      for (const [name, value] of Object.entries(selections)) {
        if (query === 'input[name="' + name + '"]:checked') return { value };
      }
      throw new Error("Unknown querySelector: " + query);
    },
    querySelectorAll(query) { return query === ".word-unit" ? units : []; }
  };
  const context = vm.createContext({ document, window: {}, navigator: {} });
  vm.runInContext(script, context, { timeout: 4000 });
  return {
    elements, selections, units,
    call(name) { return vm.runInContext(name + "()", context, { timeout: 4000 }); }
  };
}

test("HTML includes the official label and all six menus in the required order", () => {
  assert.match(html, /選り抜きの庵/);
  assert.match(html, /<p class="kicker">日本文＆英文<\/p>/);
  assert.match(html, /<h1>選り抜きの庵│要約問題<\/h1>/);
  assert.match(html, /大学・年度を問わず、独自の基準に基づき添削します。/);
  assert.match(homepage, /<h2>選り抜きの庵 <span class="new-mark">new!<\/span><\/h2><p>日本文＆英文│要約問題<\/p>/);
  const order = [...homepage.matchAll(/class="card [^"]+" href="\.\/([^/]+)\//g)].map(m => m[1]);
  assert.deepEqual(order, ["misc", "trans", "sum", "ito", "buncan", "mita"]);
  assert.match(homepage, /入試英語の添削ツール でつ/);
});

test("input IDs are unique and script references exist", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const match of script.matchAll(/el\("([^"]+)"\)/g)) {
    assert(ids.includes(match[1]), "Missing #" + match[1]);
  }
});

test("Japanese and English switch labels; switching back clears quotation checkbox", () => {
  const h = createHarness();
  assert.equal(h.elements.paraphraseBox.hidden, true);
  h.selections.kind = "en";
  h.call("refresh");
  assert.equal(h.elements.paraphraseBox.hidden, false);
  assert.equal(h.elements.answerLabel.textContent, "英文要約の答案（テキスト）");
  assert(h.units.every(u => u.textContent === "words"));
  h.elements.paraphrase.checked = true;
  h.selections.kind = "ja";
  h.call("refresh");
  assert.equal(h.elements.paraphraseBox.hidden, true);
  assert.equal(h.elements.paraphrase.checked, false);
  assert(h.units.every(u => u.textContent === "字"));
});

test("word limit modes and their boundary calculations", () => {
  const h = createHarness();
  h.selections.wordmode = "approx";
  const cases = [
    ["30", true, 30, 30],
    ["50", false, 45, 55],
    ["80", false, 70, 90],
    ["100", false, 90, 110],
    ["150", false, 135, 165]
  ];
  for (const [target, exempt, low, high] of cases) {
    h.elements.approxWords.value = target;
    const w = h.call("wordRules");
    assert.equal(w.exempt, exempt);
    assert.equal(w.freeLow, low);
    assert.equal(w.freeHigh, high);
  }
  h.selections.wordmode = "range";
  h.elements.minWords.value = "80";
  h.elements.maxWords.value = "120";
  assert.equal(h.call("wordRules").exempt, false);
  h.elements.minWords.value = "120";
  h.elements.maxWords.value = "80";
  assert.equal(h.call("wordRules"), null);
  h.selections.wordmode = "within";
  h.elements.withinWords.value = "10";
  assert.equal(h.call("wordRules").exempt, false);
});

test("100 characters within incurs no lower-bound deduction and has a 15-point cap penalty", () => {
  const h = createHarness();
  const prompt = h.call("makePrompt");
  assert(prompt.includes("100字以内"));
  assert(prompt.includes("上限を超えたら超過量によらず一律－15点"));
  assert(prompt.includes("下限は設けず"));
});

test("score-free operation does not request numerical grading", () => {
  const h = createHarness();
  for (const input of ["0", ""]) {
    h.elements.examPoints.value = input;
    const prompt = h.call("makePrompt");
    assert(prompt.includes("【得点なし添削：最優先指示】"));
    assert(prompt.includes("最終得点は一切表示しない"));
  }
});

test("paraphrase ON/OFF, 20-word and 21-word clause rules", () => {
  const h = createHarness();
  h.selections.kind = "en";
  h.call("refresh");
  let prompt = h.call("makePrompt");
  assert(prompt.includes("引用を含め，表現の流用を理由に一切減点しない（Q=0）"));
  h.elements.paraphrase.checked = true;
  h.elements.withinWords.value = "20";
  prompt = h.call("makePrompt");
  assert(prompt.includes("今回の指定上限は20 words以下のため"));
  assert(prompt.includes("文全体の完全引用はMの50％減点"));
  h.elements.withinWords.value = "21";
  prompt = h.call("makePrompt");
  assert(prompt.includes("今回の画面指定上限は20 wordsを超えるため"));
  assert(prompt.includes("接続詞だけの置換では，引用違反を回避できない"));
  h.selections.wordmode = "none";
  assert(h.call("makePrompt").includes("画面では語数指定なし。設問に20 words以下の指定"));
});

test("Japanese character count and English whitespace-split word count", () => {
  const h = createHarness();
  assert.equal(vmCount(h, "countJapaneseChars", "ＡI、２人。"), 6);
  assert.equal(vmCount(h, "countJapaneseChars", "あ い\nう　え"), 4);
  assert.equal(vmCount(h, "countWords", "Mind-wandering can help."), 3);
});
function vmCount(h, fn, text) {
  h.elements.answer.value = text;
  const origKind = h.selections.kind;
  h.selections.kind = fn === "countWords" ? "en" : "ja";
  h.call("refresh");
  const match = h.call("makePrompt").match(/【入力欄全体の参考(?:語数|字数)[^\n]*\n(\d+)/);
  h.selections.kind = origKind;
  return Number(match && match[1]);
}

test("Word and PDF output modes are file-first", () => {
  const h = createHarness();
  for (const [format, expected] of [
    ["word", "Word（.docx）"], ["pdf", "PDF（.pdf）"],
    ["both", "Word（.docx）とPDF（.pdf）"]
  ]) {
    h.selections.outputFormat = format;
    const prompt = h.call("makePrompt");
    assert(prompt.includes("指定形式：" + expected));
    assert(prompt.includes("画面への全文表示ではなく"));
    assert(prompt.includes("字数・語数条件"));
  }
});

test("photo/PDF input accepted only when explicitly marked", () => {
  const h = createHarness();
  h.elements.problem.value = "";
  assert.throws(() => h.call("makePrompt"), /英文本文/);
  h.elements.problemFile.checked = true;
  assert(h.call("makePrompt").includes("あり（ChatGPT側で添付を確認）"));
  h.elements.answer.value = "";
  assert.throws(() => h.call("makePrompt"), /要約答案/);
  h.elements.answerFile.checked = true;
  assert(h.call("makePrompt").includes("画像答案を含むため画面側では未計数"));
});
