# キャラクターの追加方法

キャラクターは `data/characters.json` で管理します。初期版では管理画面から画像をアップロードせず、画像とJSONをGitで追加します。

## 1. 画像を準備する

推奨する二層構成:

- 背景画像: 人物が写っていない完成背景
- 人物画像: 背景が透明なPNG

背景と人物は、同じピクセル寸法・同じ縦横比にします。ファイル名には英小文字・数字・ハイフンを使用すると管理しやすくなります。

例:

```text
assets/characters/ao-background.png
assets/characters/ao-foreground.png
```

人物画像にはアルファチャンネル（透明部分）が必要です。macOSでは次のコマンドで確認できます。

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha \
  assets/characters/ao-background.png \
  assets/characters/ao-foreground.png
```

期待する結果:

- 2枚の `pixelWidth` と `pixelHeight` が同じ
- 背景は `hasAlpha: no` でもよい
- 人物は `hasAlpha: yes`

## 2. 画像を配置する

```bash
cp コピー元の背景.png assets/characters/キャラクターID-background.png
cp コピー元の人物.png assets/characters/キャラクターID-foreground.png
```

元画像を残したい場合は、移動ではなく `cp` を使用します。

## 3. characters.jsonへ登録する

`data/characters.json` の `characters` 配列へ追加します。

```json
{
  "id": "ao",
  "name": "アオ",
  "backgroundImage": "assets/characters/ao-background.png",
  "foregroundImage": "assets/characters/ao-foreground.png",
  "voice": "calm",
  "enabled": true
}
```

各項目:

- `id`: 重複しない内部ID。後から変更すると保存済みの選択が無効になる
- `name`: 設定画面に表示する名前
- `backgroundImage`: 背景画像のパス
- `foregroundImage`: 透過人物画像のパス
- `voice`: 将来キャラクター別音声設定に利用する予定の値
- `enabled`: `true` なら選択肢へ表示し、`false` なら非表示

JSONでは、前の項目との間にカンマが必要です。最後の項目の後ろにはカンマを付けません。

## 4. 1枚画像だけで登録する

背景と人物を分離していない場合は、`image` を使用できます。

```json
{
  "id": "sample",
  "name": "サンプル",
  "image": "assets/characters/sample.png",
  "voice": "friendly",
  "enabled": true
}
```

1枚画像では画像全体が背景レイヤーとして表示されるため、人物だけの待機アニメーションは付きません。

## 5. 既定キャラクターを変更する

`defaultCharacterId` を登録済みのIDへ変更します。

```json
{
  "defaultCharacterId": "ao"
}
```

利用者がすでに別のキャラクターを選んでいる端末では、保存済みの選択が優先されます。

## 6. 動作確認

```bash
npm run check
node -e 'JSON.parse(require("node:fs").readFileSync("data/characters.json", "utf8")); console.log("characters.json: OK")'
git diff --check
git status --short
```

ブラウザでは次を確認します。

1. 設定の選択肢に新しい名前が表示される
2. 選択すると背景と人物が切り替わる
3. 人物だけが待機アニメーションする
4. 再読み込み後も選択が維持される
5. 別のキャラクターへ戻せる

## 7. GitHubへ反映する

キャラクター追加も通常の機能変更と同様に、Issueと作業ブランチを作って進めます。

```bash
git add assets/characters/ data/characters.json
git status
git commit -m "feat: add CHARACTER_NAME character"
git push -u origin BRANCH_NAME
```

画像の利用権、生成AIサービスの利用条件、人物・キャラクターの権利を確認してからPublicリポジトリへ登録します。
