// scripts/generate-theme-catalog.cjs

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const themeListPath = path.join(
    rootDir,
    'data',
    'theme_list.json'
);

const themesDir = path.join(
    rootDir,
    'data',
    'themes'
);

const outputPath = path.join(
    rootDir,
    'data',
    'theme_catalog.json'
);

console.log('======================================');
console.log(' PicSpeak Theme Catalog Generator');
console.log('======================================');
console.log('');

// --------------------------------------
// theme_list.json 読み込み
// --------------------------------------

if (!fs.existsSync(themeListPath)) {
    console.error('❌ data/theme_list.json が見つかりません。');
    process.exit(1);
}

let themeList;

try {
    themeList = JSON.parse(
        fs.readFileSync(themeListPath, 'utf8')
    );
} catch (error) {
    console.error('❌ theme_list.json の読み込みに失敗しました。');
    console.error(error.message);
    process.exit(1);
}

if (!Array.isArray(themeList)) {
    console.error('❌ theme_list.json が配列ではありません。');
    process.exit(1);
}

console.log(`📋 theme_list.json: ${themeList.length} themes`);
console.log('');

// --------------------------------------
// 各テーマJSONを解析
// --------------------------------------

const catalog = [];
const errors = [];
const warnings = [];
const seenIds = new Set();

for (const listItem of themeList) {

    // 現在の theme_list.json は文字列ID
    // 将来オブジェクト形式になっても一応対応
    const fileId =
        typeof listItem === 'string'
            ? listItem
            : listItem && listItem.id;

    if (!fileId) {
        errors.push(
            `theme_list.json にIDがない項目があります: ${JSON.stringify(listItem)}`
        );
        continue;
    }

    if (seenIds.has(fileId)) {
        errors.push(`重複ID: ${fileId}`);
        continue;
    }

    seenIds.add(fileId);

    const themePath = path.join(
        themesDir,
        `${fileId}.json`
    );

    if (!fs.existsSync(themePath)) {
        errors.push(
            `ファイルが見つかりません: data/themes/${fileId}.json`
        );
        continue;
    }

    let rawData;

    try {
        rawData = JSON.parse(
            fs.readFileSync(themePath, 'utf8')
        );
    } catch (error) {
        errors.push(
            `JSON解析エラー: ${fileId}.json → ${error.message}`
        );
        continue;
    }

    // 旧テーマ
    // [
    //   {
    //     ...
    //   }
    // ]
    //
    // Level 2
    // {
    //   ...
    // }
    //
    // 両方に対応
    const data = Array.isArray(rawData)
        ? rawData[0]
        : rawData;

    if (!data || typeof data !== 'object') {
        errors.push(
            `データ形式が不正です: ${fileId}.json`
        );
        continue;
    }

    const imageSrc =
        data.imageSrc ||
        data.imageSrcA ||
        '';

    if (!imageSrc) {
        errors.push(
            `imageSrc がありません: ${fileId}.json`
        );
        continue;
    }

    // --------------------------------------
    // 重要:
    // id はJSON内部の data.id ではなく、
    // theme_list.json のIDを使う。
    //
    // 例:
    // 301.json 内部ID = theme_301
    // しかし取得URLは 301.json
    // → catalog の id は "301"
    // --------------------------------------

    const catalogItem = {
        id: fileId,
        imageSrc: imageSrc,
        titleEn: data.titleEn || 'No Title',
        titleJa: data.titleJa || '名称未設定',
        category: data.category || 'other'
    };

    catalog.push(catalogItem);

    // 情報確認用Warning
    if (!data.titleEn) {
        warnings.push(`${fileId}: titleEn なし`);
    }

    if (!data.titleJa) {
        warnings.push(`${fileId}: titleJa なし`);
    }

    if (!data.category) {
        warnings.push(`${fileId}: category なし`);
    }
}

// --------------------------------------
// エラーがあった場合は生成しない
// --------------------------------------

if (errors.length > 0) {

    console.error('');
    console.error('❌ エラーが見つかりました。');
    console.error('');

    errors.forEach(error => {
        console.error(`  - ${error}`);
    });

    console.error('');
    console.error(
        'theme_catalog.json は生成していません。'
    );

    process.exit(1);
}

// --------------------------------------
// 件数確認
// --------------------------------------

if (catalog.length !== themeList.length) {

    console.error('');
    console.error(
        `❌ 件数が一致しません。`
    );

    console.error(
        `theme_list: ${themeList.length}`
    );

    console.error(
        `catalog: ${catalog.length}`
    );

    process.exit(1);
}

// --------------------------------------
// theme_catalog.json 出力
// --------------------------------------

try {

    fs.writeFileSync(
        outputPath,
        JSON.stringify(catalog, null, 2) + '\n',
        'utf8'
    );

} catch (error) {

    console.error(
        '❌ theme_catalog.json の保存に失敗しました。'
    );

    console.error(error.message);

    process.exit(1);
}

// --------------------------------------
// 結果表示
// --------------------------------------

console.log('✅ theme_catalog.json を生成しました。');
console.log('');

console.log(
    `📦 Themes: ${catalog.length}`
);

const level1Count = catalog.filter(
    item => item.category === 'other'
).length;

const level2Count =
    catalog.length - level1Count;

console.log(
    `📘 Legacy / Level 1: ${level1Count}`
);

console.log(
    `📕 Level 2: ${level2Count}`
);

console.log('');

console.log(
    '出力先: data/theme_catalog.json'
);

console.log('');

if (warnings.length > 0) {

    console.log(
        `ℹ️ 補足: ${warnings.length}件の旧形式項目に`
    );

    console.log(
        'title/category の不足があります。'
    );

    console.log(
        'これらには既存仕様と同じ既定値を使用しました。'
    );

    console.log('');
}

console.log('======================================');
console.log(' 完了');
console.log('======================================');