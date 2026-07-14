#!/usr/bin/env node
'use strict';

const fs = require('fs');
const prompts = require('prompts');
const { profileBase, listProfiles } = require('../lib/profiles');
const { pickProfile } = require('../lib/pick-profile');

async function main() {
  const arg = process.argv[2];
  const profile = arg || (await pickProfile({ message: '削除するプロファイルを選択してください' }));

  const base = profileBase(profile);
  if (!fs.existsSync(base)) {
    console.error(`Profile '${profile}' は存在しません。`);
    console.error(`Available profiles: ${listProfiles().join(' ')}`);
    process.exit(1);
  }

  const { confirmed } = await prompts(
    {
      type: 'confirm',
      name: 'confirmed',
      message: `'${profile}' の config とトークンを完全に削除します。よろしいですか?`,
      initial: false,
    },
    {
      onCancel: () => process.exit(1),
    }
  );

  if (!confirmed) {
    console.log('中断しました。');
    return;
  }

  fs.rmSync(base, { recursive: true, force: true });
  console.log(`削除しました: ${base}`);
}

main();
