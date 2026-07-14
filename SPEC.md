# claude-profile-cli 仕様書

複数の Claude Code アカウント(プロファイル)を切り替えて使うための CLI ツール。
`~/claude-profile-cli` に実体を持ち、`npm install -g .` でグローバルインストールして使う。

## データ構造

```
~/.claude-profiles/
  <profile>/
    config/   # CLAUDE_CONFIG_DIR として使う独立した設定・履歴ディレクトリ
    token     # `claude setup-token` で発行した長期 OAuth トークン (chmod 600)
```

- ルートディレクトリは環境変数 `CLAUDE_PROFILES_DIR` で上書き可能。未設定時は `~/.claude-profiles`。
- プロファイルディレクトリ・親ディレクトリは `chmod 700`、トークンファイルは `chmod 600` で保護する。
- 「プロファイルが存在する」とは `~/.claude-profiles/<profile>/` ディレクトリが存在すること。「セットアップ済み」とはそれに加えて `token` ファイルが存在すること。

## コマンド一覧

| コマンド | 役割 |
|---|---|
| `claude-profile-setup <profile>` | 新規プロファイルを作成し、トークンを発行・保存する |
| `claude-profile-list` | プロファイル一覧とセットアップ状態を表示する |
| `claude-profile-remove [profile]` | プロファイルを削除する(省略時は対話選択) |
| `ccp [profile] [claude args...]` | 指定プロファイルとして `claude` を起動する(profile省略時は対話選択) |

### `claude-profile-setup <profile>`

1. `~/.claude-profiles/<profile>/config` を作成し、親ディレクトリ・プロファイルディレクトリを `chmod 700`。
2. `claude setup-token` を実行し、ブラウザでの OAuth 認証を求める。
3. 認証完了後、非表示プロンプト(入力内容を画面に表示しない)でトークン文字列の貼り付けを求める。
4. 貼り付けられたトークンを `~/.claude-profiles/<profile>/token` に `chmod 600` で保存する。

- `<profile>` を省略するとエラーで終了する。
- `claude setup-token` が失敗、またはトークンが空の場合は途中で中断する。

### `claude-profile-list`

- `~/.claude-profiles` 配下のディレクトリを列挙し、各プロファイルについて次をタブ区切りで表示する。
  - プロファイル名
  - セットアップ状態(`✓` = token あり / `✗ (token未設定)` = token なし)
  - config ディレクトリの絶対パス
- プロファイルが1つもない場合は作成方法を案内するメッセージのみ表示する。

### `claude-profile-remove [profile]`

- `[profile]` を指定した場合はそのプロファイルを対象にする。省略した場合は既存プロファイル一覧から対話選択(`prompts` の select、token 未設定のプロファイルも選択可)。
- 指定/選択したプロファイルが存在しない場合はエラーで終了し、利用可能なプロファイル一覧を表示する。
- 削除前に確認プロンプト(`prompts` の confirm、デフォルト No)を表示し、`No`(Enter のみ含む)の場合は何もせず終了する。
- `Yes` の場合、`~/.claude-profiles/<profile>/` を再帰的に削除する。

### `ccp [profile] [claude args...]`

- 第1引数が `-` で始まらない場合、それをプロファイル名として扱い、残りの引数を `claude` にそのまま渡す。
- 第1引数が省略されている、または `-` で始まる場合、プロファイル名を対話選択(`prompts` の select)で決定し、渡された引数はすべて `claude` への引数として扱う。
  - 対話選択の選択肢には token 未設定のプロファイルも表示されるが、`(token未設定)` と表示され選択不可(disabled)になる。
  - 選択可能なプロファイルが1つもない場合はエラーメッセージを表示して終了する。
- 決定したプロファイルの `token` ファイルが存在しない場合はエラーで終了し、`claude-profile-setup <profile>` の実行を促す。
- トークンを読み込み、以下の環境変数を設定した上で `claude` を実行する。
  - `CLAUDE_CONFIG_DIR`: `~/.claude-profiles/<profile>/config`
  - `CLAUDE_CODE_OAUTH_TOKEN`: トークンの内容
- `claude` プロセスの終了コードをそのまま自身の終了コードとする。

## 内部モジュール構成

```
claude-profile-cli/
  package.json        # bin エントリ(claude-profile-setup / claude-profile-list / claude-profile-remove / ccp)、依存: prompts
  bin/
    claude-profile-setup.js
    claude-profile-list.js
    claude-profile-remove.js
    ccp.js
  lib/
    profiles.js        # profilesDir/profileBase/tokenPath/configDir/listProfiles
    pick-profile.js     # プロファイル対話選択の共通ロジック(select、onlyReadyオプション)
    prompt-hidden.js     # トークン入力用の非表示プロンプト(readlineの出力を抑制)
```

## シェル連携

`.zshrc` 側は次の2点のみを保持し、コマンド本体の実装は持たない。

```zsh
export CLAUDE_PROFILES_DIR="$HOME/.claude-profiles"

alias ccw='ccp work'
```

## インストールに関する注意

- npm のグローバル prefix は `~/.local`(`npm config set prefix "$HOME/.local"` 済み)に設定してある。これは volta 管理下の Node ではデフォルト prefix がバージョン固有ディレクトリ(例: `~/.volta/tools/image/node/<version>/bin`)になり、通常のシェルの `PATH` に含まれず `command not found` になるための回避策。`~/.local/bin` は `.zshrc` で常に `PATH` に含まれている。
- ソース変更を反映するには `~/claude-profile-cli` で `npm install -g .` を再実行する(ローカルパスからのグローバルインストールはソースディレクトリへのシンボリックリンクになるため、`bin` エントリの追加や依存関係の変更があった場合のみ再実行が必要)。
- 新しいコマンドを追加した直後は、既存のシェルで `rehash`(または新しいターミナルを開く)しないとコマンドハッシュテーブルに反映されない。
