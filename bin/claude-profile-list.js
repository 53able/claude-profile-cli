#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { listProfiles, tokenPath, configDir } = require('../lib/profiles');

function main() {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log('プロファイルはまだありません。claude-profile-setup <profile> で作成してください。');
    return;
  }

  for (const profile of profiles) {
    const ready = fs.existsSync(tokenPath(profile));
    const mark = ready ? '✓' : '✗ (token未設定)';
    console.log(`${profile}\t${mark}\t${configDir(profile)}`);
  }
}

main();
