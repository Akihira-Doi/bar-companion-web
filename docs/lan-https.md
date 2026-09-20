# LAN内HTTPS接続の設定

同じWi-Fiに接続した端末から、開発中のBar CompanionへHTTPSで接続するための手順です。
開発用証明書の作成には無料の `mkcert` を使用します。

## 1. 前提

- MacのLAN内IPアドレスを固定する
- この例では `192.168.1.210` を使用する
- サーバーをインターネットへ直接公開しない

## 2. mkcertの準備

```bash
brew install mkcert
mkcert -install
```

## 3. サーバー証明書の作成

```bash
mkdir -p certs

mkcert \
  -cert-file certs/lan-cert.pem \
  -key-file certs/lan-key.pem \
  localhost 127.0.0.1 ::1 192.168.1.210
```

`certs/` は `.gitignore` の対象です。証明書と秘密鍵はGitHubへ登録しません。

## 4. .envの設定

既存の `.env` に次の2行を追加します。

```dotenv
HTTPS_CERT_PATH=certs/lan-cert.pem
HTTPS_KEY_PATH=certs/lan-key.pem
```

両方を削除または未設定にすると、従来どおりHTTPで起動します。

## 5. 起動と接続

```bash
npm start
```

Macでは次のURLを開きます。

```text
https://localhost:3000
```

同じWi-Fi上の端末では次のURLを開きます。

```text
https://192.168.1.210:3000
```

## 6. iPad・Androidで認証局を信頼する

認証局の保存場所を確認します。

```bash
mkcert -CAROOT
```

端末へ渡してよいファイルは、その中の `rootCA.pem` だけです。
`rootCA-key.pem` は認証局の秘密鍵なので、Macの外へコピーしてはいけません。

### iPad

1. `rootCA.pem` をAirDropなどでiPadへ送る
2. 設定画面でダウンロード済みプロファイルを開いてインストールする
3. 「一般」→「情報」→「証明書信頼設定」を開く
4. mkcertの認証局に対して完全な信頼を有効にする
5. 「プライバシーとセキュリティ」→「音声認識」でSafariを有効にする

Safariで `service-not-allowed` エラーが発生し、「この端末では音声認識サービスを利用できません」と表示される場合は、手順5の権限を確認します。キーボードの音声入力とSafariのマイクが動作していても、この音声認識権限が無効だとWeb Speech APIは利用できません。

### Android

1. `rootCA.pem` をAndroid端末へ安全にコピーする
2. 設定のセキュリティ項目から「証明書をインストール」を開く
3. CA証明書として `rootCA.pem` をインストールする

AndroidではメーカーとOSバージョンによってメニュー名が異なります。

## 7. テスト終了後

常用しない端末からは、インストールした開発用認証局を削除します。
Macから `rootCA-key.pem` を持ち出さず、第三者へ渡さないでください。

HTTPS接続に成功しても、音声認識の対応状況はOSとブラウザによって異なります。
