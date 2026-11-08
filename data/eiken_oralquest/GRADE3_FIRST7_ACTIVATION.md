# Oral Quest — 英検3級 Stage 01–07 教材登録（開発版）

更新日：2026-11-08

## 現在の到達点

- オリジナルの手描き画像 **7枚**（Stage 01〜07）、各1536×1024 WebP。
- 各ステージの音読本文と英検3級の模擬面接 **5問**、模範解答、画像内容一致の練習用ルーブリックは `grade3.json` と `scoring_rubrics/e3_001.json`〜`e3_007.json` に登録済み。
- 画像と配点・質問の一致を再確認。Stage 02（School Garden）とStage 04（Weekend Cooking）は、以前の誤った写真版ファイルを正式な手描き版に差し替え済み。
- 画像はChatGPT Libraryの `/PicSpeak/OralQuest/grade3/` と、ユーザーがダウンロードできる**7ステージ独立教材ZIP**に収録されている。
- **2026-11-08に7枚すべてのWebPバイナリをGitHub開発ブランチへ登録済み**。Git blob SHA とファイルサイズを確認し、`grade3.json` の Stage 01〜07 の `visual.imageSrc` を正式な相対パスに設定しました。
- 既存の英検3級画面は Stage 01〜07 の画像を読み込み、ステージ一覧にはサムネイルを表示します。Stage 08〜30は「制作中」として無効化。ほかの級はそのまま。
- **本番環境・mainブランチは未変更**。

## 画像本体の登録（完了）・今後の確認手順

1. 7ステージ独立教材ZIPを展開する。
2. `assets/images/eiken_oralquest/grade3/` にある `e3_001.webp`〜`e3_007.webp` の7ファイルを、PicSpeakリポジトリの同一パスにコピーする。
3. `data/eiken_oralquest/grade3_first7_asset_registry.json` に記録したSHA256と実際のファイルを照合する。
4. **登録完了**：7枚のGitHub画像コミットは `6fdb9010d1a90c1952476d3f5c41325279410279`。**mainにはマージしていません**。
5. `eiken-oralquest.html` の級別画面で3級→Stage 01〜07を開き、画像が表示されるか、音読、No.1〜5、採点が機能するか実機で確認する。GitHub上の画像実体は検証済みですが、Vercelプレビューの実機確認は別途必要です。
6. 本番反映は別途明示的な承認を得てから。

ZIPの `install_into_picspeak.py` は、ローカルGitチェックアウトが正しい開発ブランチにある場合のみ画像をコピーして `imageSrc` を設定できるが、コミット・プッシュ・本番公開は行わない。

## 内容の対応

| Stage | 題名 | No. 2 | No. 3 |
|---|---|---|---|
| 01 | Library Day | What is the boy doing? | How many books is the girl carrying? |
| 02 | School Garden | What is the girl doing? | Where is the bucket? |
| 03 | A Rainy Morning | What is the girl holding? | Where is the bicycle? |
| 04 | Weekend Cooking | What is the father doing? | How many plates are on the table? |
| 05 | At the Zoo | What is the keeper doing? | How many children are watching? |
| 06 | Music Club | What is the girl doing? | Where is the drum? |
| 07 | Community Clean-up | What are the students doing? | How many empty bottles are on the ground? |

この採点は画像内容と文字起こしの一致を確認する練習用評価であり、英検公式の採点、発音・文法・流暢さの精密評価ではない。
