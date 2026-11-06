# PicSpeak — Eiken Oral Quest（英検二次面接教材）

2026-11-07 作成。**3級、準2級、2級、準1級のオリジナル面接教材各30カード、計120カード**（面接質問540問＋音読／ナレーション）です。公式問題や公式採点基準の転載ではありません。

## 新しい級別トレーニング画面（開発ブランチのみ）

- **`eiken-oralquest.html`**：Oral Questから級選択（3級／準2級／2級／準1級）→30ステージ→音読・写真描写・面接質問へ進みます。
- 画面では「基礎10→実践10→模擬10」を区切って表示します。録音に対応するブラウザでは音声認識、非対応環境では直接入力が使えます。
- ヒントは必要な箇所だけ表示。実践・模擬レベルでは回答後に模範解答を確認します。
- 完了したステージは端末内のlocalStorageに保存します（ログインや公式合否判定には連動しません）。
- 現時点では画像が未作成のため、イラストを必要とする問題は場面説明による代替練習です。画像完成まで本番同様の視覚問題にはなりません。
- 画像制作の[全120件のファイル名・画像生成プロンプト一覧](IMAGE_GUIDE.md)、[CSV](image_prompts.csv)、[JSON](image_prompts.json)を参照してください。
- 従来の20シーンのOral Questは、級選択画面下の「従来の写真練習」から引き続き利用できる構成です。
- **本番公開は未実施です。** 開発ブランチの確認後に承認が必要です。

## 状態

- **教材テキストと級別UIの開発版を準備済み**。既存の `data/oralquest/`（20シーン）および `js/oralquest_game.js` は変更していません。
- 本番非公開。新データは開発ブランチのみです。
- イラストは未作成。すべての `imageSrc` は `null` で、`visual` に英語の制作指示があります。
- 級別専用UIは新規の独立ページで作成済み。画像の実表示・実機での音声認識・教材全件のE2Eテストは画像作成後に行います。
- 各セットは模範解答を付けていますが、自由回答の唯一の正解ではありません。公式の合格点・CSE換算を模した数値は設定していません。

## 各級の面接順序

- **3級**：約30語の音読→本文1問→イラスト2問→個人質問2問（約5分、カード30枚・質問150問）
- **準2級**：約50語の音読→本文1問→人物動作1問→状況説明1問→意見2問（約6分、カード30枚・質問150問）
- **2級**：約60語の音読→本文1問→3コマの説明→意見2問（約7分、カード30枚・質問120問）
- **準1級**：4コマ説明（準備60秒・ナレーション120秒）→意見4問（約8分、カード30枚・質問120問）

## 難易度の進め方（各級共通）

- **Stage 01–10 / guided**：必要なヒントと模範例を使った基礎練習。
- **Stage 11–20 / practice**：自分で回答した後に模範例を確認。
- **Stage 21–30 / mock**：本番同様に進め、終了するまでヒントを非表示にする想定。

各ステージは級に対応する面接一式を収録しています。練習レベルを上げても、質問の順序や構成は級の試験形式を保ちます。

## データの扱い

- `id` は不変キー。番号は各級01〜30。
- `passage` は3級・準2級・2級のみ。
- `storyLeadIn` は2級・準1級の絵の物語を始める文。
- `visual.artDirection` や `visual.panels[].description` に制作指示。画像作成後に `imageSrc` を入れます。
- `questions[].modelAnswers` は参考表現で、意味が合う多様な回答を許容すること。
- `band` はUI支援レベルを表し、試験の公式区分ではありません。

## 内容確認用の原稿（先生向け）

画像を作る前に、各級の全文・質問・模範解答・イラスト制作指示をまとめてチェックできます。

- [3級：30ステージ](review_grade3.md)
- [準2級：30ステージ](review_grade_pre2.md)
- [2級：30ステージ](review_grade2.md)
- [準1級：30ステージ](review_grade_pre1.md)

## 全120ステージの題名

### 3級

01. Library Day
02. School Garden
03. A Rainy Morning
04. Weekend Cooking
05. At the Zoo
06. Music Club
07. Community Clean-up
08. A New Bicycle
09. Farmers' Market
10. After-school Sports
11. Bus Stop
12. Family Picnic
13. Pet Care
14. School Festival
15. Train Travel
16. Healthy Breakfast
17. Outdoor Art
18. Summer Camp
19. Town Museum
20. Helping Neighbors
21. Recycling Paper
22. Learning Languages
23. Safety at Night
24. Online Lessons
25. Winter Activities
26. Community Sports Day
27. Visiting the Dentist
28. Lost and Found
29. Bird Watching
30. Preparing for a Trip

### 準2級

01. Community Bike Sharing
02. Digital School Notices
03. Local Food Festivals
04. Reading to Younger Children
05. Plastic-free Lunches
06. Small Science Museums
07. Public Water Stations
08. Community Language Exchange
09. Repairing Old Clothes
10. Morning Walking Groups
11. Online Shopping Returns
12. Healthy School Snacks
13. Tourist Information Volunteers
14. Borrowing Sports Equipment
15. Weather Alert Apps
16. Farm Visits for Students
17. Quiet Spaces in Libraries
18. Food Donation Boxes
19. Local History Walking Tours
20. Sharing Textbooks
21. Planting Trees in Town
22. Learning Through Podcasts
23. Neighborhood Emergency Drills
24. Community Music Events
25. Helping at Animal Shelters
26. Using Public Gardens
27. Reusing School Uniforms
28. Accessible Playgrounds
29. Preparing for Job Interviews
30. Protecting Rivers

### 2級

01. School Solar Projects
02. Online Medical Advice
03. Reusable Packaging
04. Community Study Hubs
05. Urban Farming
06. Flexible Working Hours
07. Reducing Food Waste at Cafes
08. Public Transport for Seniors
09. Digital Art Exhibitions
10. Disaster Preparation Apps
11. Ethical Tourism
12. Student-led Research
13. Public Electric Buses
14. Intergenerational Learning
15. Healthy Sleep Habits
16. Local Renewable Energy
17. Using Robots in Care Homes
18. Learning Financial Skills
19. Protecting Local Wildlife
20. Remote Language Exchanges
21. Reducing Noise in Cities
22. Digital Privacy at School
23. Affordable Cultural Activities
24. Flexible Public Libraries
25. Responsible AI in Education
26. Community Health Campaigns
27. Safe Cycling Infrastructure
28. Supporting Small Bookstores
29. Water-saving Technologies
30. Supporting Students with Disabilities

### 準1級

01. A Neighborhood Recycling Plan
02. Making a Museum Accessible
03. An Empty Community Center
04. A New Remote-Work Policy
05. Preparing for Severe Floods
06. A School Counseling Program
07. Cleaning a Coastal Wetland
08. A Mobile Health Clinic
09. Greener Rooftops in a City
10. Clearer Food Allergy Labels
11. An Automated Hiring System
12. Collecting Old Electronics
13. Bridging the Digital Divide
14. Introducing Inclusive School Uniforms
15. Rethinking Public Transit Fares
16. Caregiving and Employment
17. Protecting Urban Biodiversity
18. False Information During an Emergency
19. Tourism and Housing Prices
20. Lifelong Education for Workers
21. Choosing a Community Energy Site
22. Checking Fairness in Educational AI
23. A Community Food Cooperative
24. Facial Recognition at a Station
25. Restoring a Historic Theater
26. Responding to Extreme Heat
27. Giving Students a Voice
28. Protecting Platform Workers
29. A Smart-City Data Project
30. Autonomous Delivery on Sidewalks

## 教材検査

`node tests/eiken_oralquest_content.test.cjs` を実行します。対象はデータ構造・面接質問数・語数・画像未設定の確認です。

## 参考：英検協会公式の形式説明（教材本文はすべて新規作成）

- https://www.eiken.or.jp/eiken/exam/grade_3/solutions.html
- https://www.eiken.or.jp/eiken/exam/grade_p2/solutions.html
- https://www.eiken.or.jp/eiken/exam/grade_2/solutions.html
- https://www.eiken.or.jp/eiken/exam/grade_p1/solutions.html

**次の制作工程**：120セット分の図案確認 → オリジナルイラスト制作 → 画像とカードの対応付け → UI統合 → 読み上げ・音声認識・採点・iPad実機テスト → 承認後に公開。
