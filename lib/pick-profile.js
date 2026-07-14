'use strict';

const fs = require('fs');
const prompts = require('prompts');
const { tokenPath, listProfiles } = require('./profiles');

async function pickProfile({ message = 'プロファイルを選択してください', onlyReady = false } = {}) {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.error('プロファイルがありません。claude-profile-setup <profile> で作成してください。');
    process.exit(1);
  }

  const { profile } = await prompts(
    {
      type: 'select',
      name: 'profile',
      message,
      choices: profiles.map((name) => {
        const ready = fs.existsSync(tokenPath(name));
        return {
          title: ready ? name : `${name} (token未設定)`,
          value: name,
          disabled: onlyReady && !ready,
        };
      }),
    },
    {
      onCancel: () => {
        console.error('キャンセルしました。');
        process.exit(1);
      },
    }
  );

  if (!profile) process.exit(1);
  return profile;
}

module.exports = { pickProfile };
