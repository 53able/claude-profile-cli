# claude-profile-cli

複数の Claude Code アカウント(プロファイル)を切り替えて使うための CLI ツールです。
プロファイルごとに独立した設定ディレクトリと長期 OAuth トークンを保持し、コマンド一つでアカウントを切り替えて `claude` を起動できます。

詳細な仕様は [SPEC.md](./SPEC.md) を参照してください。

## インストール

```sh
npm install -g @53able/claude-profile-cli
```

または GitHub から直接:

```sh
npm install -g github:53able/claude-profile-cli
```

ローカル開発時はリポジトリ直下で:

```sh
npm install -g .
```

## コマンド

`claude-profile` のサブコマンドで操作します。

| コマンド | 役割 |
|---|---|
| `claude-profile setup <profile>` | 新規プロファイルを作成し、トークンを発行・保存する |
| `claude-profile list` | プロファイル一覧とセットアップ状態を表示する |
| `claude-profile remove [profile]` | プロファイルを削除する (省略時は対話選択) |
| `claude-profile run [profile] [claude args...]` | 指定プロファイルとして `claude` を起動する (省略時は対話選択) |

### ヘルプ・バージョン

```sh
claude-profile              # 全体ヘルプ (バージョン付き)
claude-profile --help
claude-profile --version
claude-profile help setup   # コマンド別ヘルプ
```

## 使い方

```sh
# 新しいプロファイルを作成 (ブラウザでの認証 → トークン貼り付け)
claude-profile setup work

# プロファイル一覧を確認
claude-profile list

# プロファイルを指定して起動
claude-profile run work

# プロファイル名を省略すると対話選択
claude-profile run

# プロファイルを削除 (対話選択 + 確認あり)
claude-profile remove
```

各プロファイルの設定・トークンは `~/.claude-profiles/<profile>/` 以下に保存されます (`CLAUDE_PROFILES_DIR` 環境変数で変更可能)。

## ライセンス

MIT
