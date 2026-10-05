# english-writing-feedback

大学入試英語の答案添削用Webページです。

- `ito/` — 伊都への恋文｜九州大学 自由英作文
- `bunkan/` — 待ってろ文キャン｜早稲田大学 文学部・文化構想学部 英文要約
- `mita/` — 三田キャンへの道｜慶應義塾大学 経済学部 自由英作文

Claude Artifact版を基に，Claude固有の `window.claude` 呼び出しを除き，添削用プロンプトを生徒自身のChatGPTへ渡す方式に変更しています。PDFのテキスト抽出には pdf.js 3.11.174 をCDNから読み込みます。手書き写真の自動OCRは公開ページ内では行いません。
