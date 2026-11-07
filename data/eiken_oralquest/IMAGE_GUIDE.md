# PicSpeak Oral Quest｜画像ファイル名・制作指示（全120教材）

> **2026-11-07更新：3級の画像については、以下の共通ルールより [新しい手描きイラスト設計](GRADE3_ART_REDESIGN.md) が優先します。** 旧写真Stage 01〜05は新シリーズには採用しません。3級用のプロンプト・ファイル名一覧はCSV/JSONに反映済みです。

このドキュメントは **画像を作るための設計書** です。2026-11-07時点で画像はまだ生成・登録していません。画像は各級30ステージ、計120枚の完成カードとして制作します。本文・質問は [級別教材JSON](README.md) を参照してください。

## プロンプトの原本

- **[image_prompts.csv](image_prompts.csv)**：120枚分、級・ステージ・ファイル名・完全な英語プロンプト（Excelやスプレッドシートで確認可能）
- **[image_prompts.json](image_prompts.json)**：120枚の正式なプロンプト、画面で用いる予定のパス、コマ別プロンプトを収録
- **[panel_prompts.csv](panel_prompts.csv)**：2～4コマを個別に制作する場合の270カット分のファイル名とプロンプト（任意）

## ビジュアル統一ルール

- 印象：**学校教材として見やすい、温かく上質なエディトリアルイラスト**。写実的すぎず、漫画的すぎず、自然な表情と正確な人物の動作を重視。
- **英文・日本語・番号・ロゴ・透かし・吹き出し・矢印は入れない。** コマ番号はアプリ側で表示する。
- 3級では「人数・色・数・位置関係」、準2級では「複数の動作と困った状況」、2級では「出来事の順序」、準1級では「問題→判断→行動→結果」が視覚だけで伝わることを優先。
- 1教材は完成画像1ファイル（`.webp`）。複数コマは1枚にまとめる。個別コマファイル（`_p1.webp`等）は、制作過程の素材であり、公開に必須ではない。
- 各級のJSONの `visual.plannedImageSrc` は予定パス、`visual.imageSrc` は未設定（`null`）。完成後に実際の相対パスを `imageSrc` に設定し、`status` を `ready` に変更する。
- 画像を生成する際はまずコマ数・人物の服装の一貫性・手足の形・必要な道具・質問と一致する視覚情報をチェックする。

## 級ごとの画像仕様

| 級 | 完成画像 | 1画像の構成 | 保存フォルダ |
|---|---:|---|---|
| 3級 | 30枚 | 4:3（単一場面） | `assets/images/eiken_oralquest/grade3/` |
| 準2級 | 30枚 | 16:9（A・Bの2コマ左右） | `assets/images/eiken_oralquest/pre2/` |
| 2級 | 30枚 | 16:9（3コマ横並び） | `assets/images/eiken_oralquest/grade2/` |
| 準1級 | 30枚 | 4:3（4コマ・2×2配置） | `assets/images/eiken_oralquest/pre1/` |

## 全120ファイル名（ステージ別）

### 3級（30枚）

| Stage | Topic | 完成ファイル名 |
|---:|---|---|
| 01 | Library Day | `assets/images/eiken_oralquest/grade3/e3_001.webp` |
| 02 | School Garden | `assets/images/eiken_oralquest/grade3/e3_002.webp` |
| 03 | A Rainy Morning | `assets/images/eiken_oralquest/grade3/e3_003.webp` |
| 04 | Weekend Cooking | `assets/images/eiken_oralquest/grade3/e3_004.webp` |
| 05 | At the Zoo | `assets/images/eiken_oralquest/grade3/e3_005.webp` |
| 06 | Music Club | `assets/images/eiken_oralquest/grade3/e3_006.webp` |
| 07 | Community Clean-up | `assets/images/eiken_oralquest/grade3/e3_007.webp` |
| 08 | A New Bicycle | `assets/images/eiken_oralquest/grade3/e3_008.webp` |
| 09 | Farmers' Market | `assets/images/eiken_oralquest/grade3/e3_009.webp` |
| 10 | After-school Sports | `assets/images/eiken_oralquest/grade3/e3_010.webp` |
| 11 | Bus Stop | `assets/images/eiken_oralquest/grade3/e3_011.webp` |
| 12 | Family Picnic | `assets/images/eiken_oralquest/grade3/e3_012.webp` |
| 13 | Pet Care | `assets/images/eiken_oralquest/grade3/e3_013.webp` |
| 14 | School Festival | `assets/images/eiken_oralquest/grade3/e3_014.webp` |
| 15 | Train Travel | `assets/images/eiken_oralquest/grade3/e3_015.webp` |
| 16 | Healthy Breakfast | `assets/images/eiken_oralquest/grade3/e3_016.webp` |
| 17 | Outdoor Art | `assets/images/eiken_oralquest/grade3/e3_017.webp` |
| 18 | Summer Camp | `assets/images/eiken_oralquest/grade3/e3_018.webp` |
| 19 | Town Museum | `assets/images/eiken_oralquest/grade3/e3_019.webp` |
| 20 | Helping Neighbors | `assets/images/eiken_oralquest/grade3/e3_020.webp` |
| 21 | Recycling Paper | `assets/images/eiken_oralquest/grade3/e3_021.webp` |
| 22 | Learning Languages | `assets/images/eiken_oralquest/grade3/e3_022.webp` |
| 23 | Safety at Night | `assets/images/eiken_oralquest/grade3/e3_023.webp` |
| 24 | Online Lessons | `assets/images/eiken_oralquest/grade3/e3_024.webp` |
| 25 | Winter Activities | `assets/images/eiken_oralquest/grade3/e3_025.webp` |
| 26 | Community Sports Day | `assets/images/eiken_oralquest/grade3/e3_026.webp` |
| 27 | Visiting the Dentist | `assets/images/eiken_oralquest/grade3/e3_027.webp` |
| 28 | Lost and Found | `assets/images/eiken_oralquest/grade3/e3_028.webp` |
| 29 | Bird Watching | `assets/images/eiken_oralquest/grade3/e3_029.webp` |
| 30 | Preparing for a Trip | `assets/images/eiken_oralquest/grade3/e3_030.webp` |

### 準2級（30枚）

| Stage | Topic | 完成ファイル名 |
|---:|---|---|
| 01 | Community Bike Sharing | `assets/images/eiken_oralquest/pre2/ep2_001.webp` |
| 02 | Digital School Notices | `assets/images/eiken_oralquest/pre2/ep2_002.webp` |
| 03 | Local Food Festivals | `assets/images/eiken_oralquest/pre2/ep2_003.webp` |
| 04 | Reading to Younger Children | `assets/images/eiken_oralquest/pre2/ep2_004.webp` |
| 05 | Plastic-free Lunches | `assets/images/eiken_oralquest/pre2/ep2_005.webp` |
| 06 | Small Science Museums | `assets/images/eiken_oralquest/pre2/ep2_006.webp` |
| 07 | Public Water Stations | `assets/images/eiken_oralquest/pre2/ep2_007.webp` |
| 08 | Community Language Exchange | `assets/images/eiken_oralquest/pre2/ep2_008.webp` |
| 09 | Repairing Old Clothes | `assets/images/eiken_oralquest/pre2/ep2_009.webp` |
| 10 | Morning Walking Groups | `assets/images/eiken_oralquest/pre2/ep2_010.webp` |
| 11 | Online Shopping Returns | `assets/images/eiken_oralquest/pre2/ep2_011.webp` |
| 12 | Healthy School Snacks | `assets/images/eiken_oralquest/pre2/ep2_012.webp` |
| 13 | Tourist Information Volunteers | `assets/images/eiken_oralquest/pre2/ep2_013.webp` |
| 14 | Borrowing Sports Equipment | `assets/images/eiken_oralquest/pre2/ep2_014.webp` |
| 15 | Weather Alert Apps | `assets/images/eiken_oralquest/pre2/ep2_015.webp` |
| 16 | Farm Visits for Students | `assets/images/eiken_oralquest/pre2/ep2_016.webp` |
| 17 | Quiet Spaces in Libraries | `assets/images/eiken_oralquest/pre2/ep2_017.webp` |
| 18 | Food Donation Boxes | `assets/images/eiken_oralquest/pre2/ep2_018.webp` |
| 19 | Local History Walking Tours | `assets/images/eiken_oralquest/pre2/ep2_019.webp` |
| 20 | Sharing Textbooks | `assets/images/eiken_oralquest/pre2/ep2_020.webp` |
| 21 | Planting Trees in Town | `assets/images/eiken_oralquest/pre2/ep2_021.webp` |
| 22 | Learning Through Podcasts | `assets/images/eiken_oralquest/pre2/ep2_022.webp` |
| 23 | Neighborhood Emergency Drills | `assets/images/eiken_oralquest/pre2/ep2_023.webp` |
| 24 | Community Music Events | `assets/images/eiken_oralquest/pre2/ep2_024.webp` |
| 25 | Helping at Animal Shelters | `assets/images/eiken_oralquest/pre2/ep2_025.webp` |
| 26 | Using Public Gardens | `assets/images/eiken_oralquest/pre2/ep2_026.webp` |
| 27 | Reusing School Uniforms | `assets/images/eiken_oralquest/pre2/ep2_027.webp` |
| 28 | Accessible Playgrounds | `assets/images/eiken_oralquest/pre2/ep2_028.webp` |
| 29 | Preparing for Job Interviews | `assets/images/eiken_oralquest/pre2/ep2_029.webp` |
| 30 | Protecting Rivers | `assets/images/eiken_oralquest/pre2/ep2_030.webp` |

### 2級（30枚）

| Stage | Topic | 完成ファイル名 |
|---:|---|---|
| 01 | School Solar Projects | `assets/images/eiken_oralquest/grade2/e2_001.webp` |
| 02 | Online Medical Advice | `assets/images/eiken_oralquest/grade2/e2_002.webp` |
| 03 | Reusable Packaging | `assets/images/eiken_oralquest/grade2/e2_003.webp` |
| 04 | Community Study Hubs | `assets/images/eiken_oralquest/grade2/e2_004.webp` |
| 05 | Urban Farming | `assets/images/eiken_oralquest/grade2/e2_005.webp` |
| 06 | Flexible Working Hours | `assets/images/eiken_oralquest/grade2/e2_006.webp` |
| 07 | Reducing Food Waste at Cafes | `assets/images/eiken_oralquest/grade2/e2_007.webp` |
| 08 | Public Transport for Seniors | `assets/images/eiken_oralquest/grade2/e2_008.webp` |
| 09 | Digital Art Exhibitions | `assets/images/eiken_oralquest/grade2/e2_009.webp` |
| 10 | Disaster Preparation Apps | `assets/images/eiken_oralquest/grade2/e2_010.webp` |
| 11 | Ethical Tourism | `assets/images/eiken_oralquest/grade2/e2_011.webp` |
| 12 | Student-led Research | `assets/images/eiken_oralquest/grade2/e2_012.webp` |
| 13 | Public Electric Buses | `assets/images/eiken_oralquest/grade2/e2_013.webp` |
| 14 | Intergenerational Learning | `assets/images/eiken_oralquest/grade2/e2_014.webp` |
| 15 | Healthy Sleep Habits | `assets/images/eiken_oralquest/grade2/e2_015.webp` |
| 16 | Local Renewable Energy | `assets/images/eiken_oralquest/grade2/e2_016.webp` |
| 17 | Using Robots in Care Homes | `assets/images/eiken_oralquest/grade2/e2_017.webp` |
| 18 | Learning Financial Skills | `assets/images/eiken_oralquest/grade2/e2_018.webp` |
| 19 | Protecting Local Wildlife | `assets/images/eiken_oralquest/grade2/e2_019.webp` |
| 20 | Remote Language Exchanges | `assets/images/eiken_oralquest/grade2/e2_020.webp` |
| 21 | Reducing Noise in Cities | `assets/images/eiken_oralquest/grade2/e2_021.webp` |
| 22 | Digital Privacy at School | `assets/images/eiken_oralquest/grade2/e2_022.webp` |
| 23 | Affordable Cultural Activities | `assets/images/eiken_oralquest/grade2/e2_023.webp` |
| 24 | Flexible Public Libraries | `assets/images/eiken_oralquest/grade2/e2_024.webp` |
| 25 | Responsible AI in Education | `assets/images/eiken_oralquest/grade2/e2_025.webp` |
| 26 | Community Health Campaigns | `assets/images/eiken_oralquest/grade2/e2_026.webp` |
| 27 | Safe Cycling Infrastructure | `assets/images/eiken_oralquest/grade2/e2_027.webp` |
| 28 | Supporting Small Bookstores | `assets/images/eiken_oralquest/grade2/e2_028.webp` |
| 29 | Water-saving Technologies | `assets/images/eiken_oralquest/grade2/e2_029.webp` |
| 30 | Supporting Students with Disabilities | `assets/images/eiken_oralquest/grade2/e2_030.webp` |

### 準1級（30枚）

| Stage | Topic | 完成ファイル名 |
|---:|---|---|
| 01 | A Neighborhood Recycling Plan | `assets/images/eiken_oralquest/pre1/ep1_001.webp` |
| 02 | Making a Museum Accessible | `assets/images/eiken_oralquest/pre1/ep1_002.webp` |
| 03 | An Empty Community Center | `assets/images/eiken_oralquest/pre1/ep1_003.webp` |
| 04 | A New Remote-Work Policy | `assets/images/eiken_oralquest/pre1/ep1_004.webp` |
| 05 | Preparing for Severe Floods | `assets/images/eiken_oralquest/pre1/ep1_005.webp` |
| 06 | A School Counseling Program | `assets/images/eiken_oralquest/pre1/ep1_006.webp` |
| 07 | Cleaning a Coastal Wetland | `assets/images/eiken_oralquest/pre1/ep1_007.webp` |
| 08 | A Mobile Health Clinic | `assets/images/eiken_oralquest/pre1/ep1_008.webp` |
| 09 | Greener Rooftops in a City | `assets/images/eiken_oralquest/pre1/ep1_009.webp` |
| 10 | Clearer Food Allergy Labels | `assets/images/eiken_oralquest/pre1/ep1_010.webp` |
| 11 | An Automated Hiring System | `assets/images/eiken_oralquest/pre1/ep1_011.webp` |
| 12 | Collecting Old Electronics | `assets/images/eiken_oralquest/pre1/ep1_012.webp` |
| 13 | Bridging the Digital Divide | `assets/images/eiken_oralquest/pre1/ep1_013.webp` |
| 14 | Introducing Inclusive School Uniforms | `assets/images/eiken_oralquest/pre1/ep1_014.webp` |
| 15 | Rethinking Public Transit Fares | `assets/images/eiken_oralquest/pre1/ep1_015.webp` |
| 16 | Caregiving and Employment | `assets/images/eiken_oralquest/pre1/ep1_016.webp` |
| 17 | Protecting Urban Biodiversity | `assets/images/eiken_oralquest/pre1/ep1_017.webp` |
| 18 | False Information During an Emergency | `assets/images/eiken_oralquest/pre1/ep1_018.webp` |
| 19 | Tourism and Housing Prices | `assets/images/eiken_oralquest/pre1/ep1_019.webp` |
| 20 | Lifelong Education for Workers | `assets/images/eiken_oralquest/pre1/ep1_020.webp` |
| 21 | Choosing a Community Energy Site | `assets/images/eiken_oralquest/pre1/ep1_021.webp` |
| 22 | Checking Fairness in Educational AI | `assets/images/eiken_oralquest/pre1/ep1_022.webp` |
| 23 | A Community Food Cooperative | `assets/images/eiken_oralquest/pre1/ep1_023.webp` |
| 24 | Facial Recognition at a Station | `assets/images/eiken_oralquest/pre1/ep1_024.webp` |
| 25 | Restoring a Historic Theater | `assets/images/eiken_oralquest/pre1/ep1_025.webp` |
| 26 | Responding to Extreme Heat | `assets/images/eiken_oralquest/pre1/ep1_026.webp` |
| 27 | Giving Students a Voice | `assets/images/eiken_oralquest/pre1/ep1_027.webp` |
| 28 | Protecting Platform Workers | `assets/images/eiken_oralquest/pre1/ep1_028.webp` |
| 29 | A Smart-City Data Project | `assets/images/eiken_oralquest/pre1/ep1_029.webp` |
| 30 | Autonomous Delivery on Sidewalks | `assets/images/eiken_oralquest/pre1/ep1_030.webp` |

## 画像を完成させたときの手順

1. `image_prompts.csv` から対象ステージのプロンプトを選ぶ。複数コマの生成が安定しなければ `panel_prompts.csv` の個別制作を利用する。
2. 仕上げたカードを対応する `assets/images/eiken_oralquest/<grade>/` 以下に、指定された `.webp` 名で保存する。
3. 対応する `data/eiken_oralquest/grade*.json` の `visual.imageSrc` に指定パスを設定する。未完成のカードの `imageSrc` は `null` のままにする。
4. ステージ画面と音読・ナレーション画面で表示と内容一致を確認する。特に3級の数字や位置、準2級の人物の動き、2級・準1級の時系列を検査する。
5. 画像制作後も自動で本番公開しない。承認が出てから別途公開する。
