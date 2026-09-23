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

## 7. 作業ブランチを作る

キャラクター追加もIssueと作業ブランチを作って進めます。最初に現在地と未保存ファイルを確認します。

```bash
cd /Users/doiakihira2/Documents/GitHub/bar-companion-web
git status --short --branch
git switch main
git pull --ff-only origin main
git switch -c feature/キャラクターID-character
```

例:

```bash
git switch -c feature/26-add-sakura-character
```

`git status`に今回と関係ないファイルが表示された場合は、削除したり一緒に追加したりせず、先にそのファイルの扱いを確認します。

## 8. 追加したファイルだけをGitへ登録する

今回追加した画像と`characters.json`だけを明示して登録します。

```bash
git add \
  assets/characters/キャラクターID-background.png \
  assets/characters/キャラクターID-foreground.png \
  data/characters.json
```

まばたき、口、リアクション画像も追加した場合は、そのファイル名を一つずつ追加します。次のようなフォルダ全体の指定は、関係ない未追跡画像まで入る可能性があるため避けます。

```bash
# 原則として使用しない
git add assets/characters/
```

登録対象を確認します。

```bash
git status --short
git diff --cached --stat
git diff --cached -- data/characters.json
```

- `A`: 新しく追加するファイル
- `M`: 変更したファイル
- `??`: まだGitへ登録していないファイル
- 今回と関係ないファイルが`A`や`M`になっていないことを確認する

## 9. CommitしてGitHubへPushする

確認した変更をMacのGit履歴へCommitします。

```bash
git commit -m "feat: add CHARACTER_NAME character"
git push -u origin feature/キャラクターID-character
```

例:

```bash
git commit -m "feat: add Sakura character"
git push -u origin feature/26-add-sakura-character
```

この時点ではGitHubへ作業ブランチが保存されただけで、本番環境はまだ変わりません。Renderは正式版の`main`を公開しているためです。

## 10. Pull Requestを作る

GitHubで次のリポジトリを開きます。

```text
https://github.com/Akihira-Doi/bar-companion-web
```

1. `Compare & pull request`を押す
2. `base: main`になっていることを確認する
3. `compare:`が作業ブランチになっていることを確認する
4. `Files changed`で画像と`data/characters.json`を確認する
5. APIキー、`.env`、関係ない画像が含まれていないことを確認する
6. `Create pull request`を押す

`Create pull request`は確認依頼を作る操作で、まだ正式版への統合ではありません。

## 11. Pull RequestをmainへMergeする

内容に問題がなければ、次の順に押します。

1. `Merge pull request`
2. `Confirm merge`

これで変更が正式版`main`へ入り、Renderが更新を自動検知して本番環境の作り直しを開始します。

Merge後に`Delete branch`が表示された場合、GitHub上の作業ブランチは削除して構いません。`main`へ入った画像や履歴は消えません。

## 12. Renderの自動Deployを確認する

Bar CompanionのRender管理画面を開きます。

```text
https://dashboard.render.com/web/srv-daom5dugekts73aq66gg
```

これは所有者用の管理画面です。スタッフや一般利用者へ渡すURLではありません。

1. `Events`または`Deploys`を開く
2. MergeしたCommitの公開処理が始まっていることを確認する
3. `Building`または`In progress`なら待つ
4. `Live`または`Deploy succeeded`になったことを確認する

通常は`main`更新後に自動Deployされます。自動で始まらない場合だけ、`Manual Deploy`から最新CommitをDeployします。新しいWeb ServiceやBlueprintを作り直す必要はありません。

Deployが失敗した場合は`Logs`を開き、最後のエラーを確認します。APIキーやパスワードが表示されている場合は、その部分を隠してから画面を共有します。失敗時にWeb Serviceを削除してはいけません。

## 13. 本番環境で画像を確認する

Deploy成功後、利用者用の本番URLを開きます。

```text
https://bar-companion.onrender.com
```

1. `APP_PASSWORD`でログインする
2. 設定画面を開く
3. 新しいキャラクターを選択する
4. 背景、人物、まばたき、口、リアクションを確認する
5. ページを再読み込みし、選択が維持されることを確認する
6. AndroidとMacの両方で表示を確認する

無料プランが休止していた場合、最初の表示には時間がかかることがあります。1〜2分待ってから再読み込みします。

古い画像が表示される場合はブラウザキャッシュの可能性があります。通常の再読み込みを行い、それでも変わらなければプライベートブラウズで本番URLを開いて確認します。

## 14. Macのmainを最新に戻す

GitHubでMergeした後、Mac側も正式版へ戻して最新状態を取得します。

```bash
git switch main
git pull --ff-only origin main
git status --short --branch
```

期待する表示:

```text
## main...origin/main
```

以前から残している未追跡ファイルがある場合は、その下に`?? ファイル名`が表示されることがあります。`main...origin/main`であればCommit履歴はGitHubと同期しています。

## 15. 完了条件

- ローカル検査が成功した
- 作業ブランチへCommitした
- GitHubへPushした
- Pull Requestの変更ファイルを確認した
- `main`へMergeした
- RenderのDeployが成功した
- `https://bar-companion.onrender.com`で新しい画像を確認した
- MacとAndroidで表示崩れがない
- Macの`main`をGitHubと同期した

画像の利用権、生成AIサービスの利用条件、人物・キャラクターの権利を確認してからPublicリポジトリへ登録します。
