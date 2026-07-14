#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { spawnSync } = require('child_process');
const { profilesDir, profileBase, tokenPath, configDir } = require('../lib/profiles');
const { promptHidden } = require('../lib/prompt-hidden');

async function main() {
  const profile = process.argv[2];
  if (!profile) {
    console.error('Usage: claude-profile-setup <profile>');
    process.exit(1);
  }

  const base = profileBase(profile);
  fs.mkdirSync(configDir(profile), { recursive: true });
  fs.chmodSync(profilesDir(), 0o700);
  fs.chmodSync(base, 0o700);

  console.log(`1) このあと 'claude setup-token' がブラウザでの認証を求めます。`);
  console.log(`   プロファイル '${profile}' に使いたいアカウントでログインしてください。`);
  console.log(`2) 発行されたトークンをこのあとのプロンプトに貼り付けてください(画面には表示されません)。`);
  console.log();

  const result = spawnSync('claude', ['setup-token'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('claude setup-token が失敗しました。');
    process.exit(result.status ?? 1);
  }

  const token = await promptHidden('トークンを貼り付けて Enter を押してください: ');
  if (!token) {
    console.error('トークンが空です。中断しました。');
    process.exit(1);
  }

  const file = tokenPath(profile);
  fs.writeFileSync(file, token, { mode: 0o600 });
  fs.chmodSync(file, 0o600);

  console.log(`保存しました: ${file}`);
  console.log(`次から 'ccp ${profile}' でこのプロファイルとして claude を起動できます。`);
}

main();
