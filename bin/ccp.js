#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { spawnSync } = require('child_process');
const { tokenPath, configDir } = require('../lib/profiles');
const { pickProfile } = require('../lib/pick-profile');

function splitArgs(argv) {
  if (argv.length === 0 || argv[0].startsWith('-')) {
    return { profileArg: undefined, claudeArgs: argv };
  }
  return { profileArg: argv[0], claudeArgs: argv.slice(1) };
}

async function main() {
  const { profileArg, claudeArgs } = splitArgs(process.argv.slice(2));
  const profile =
    profileArg ||
    (await pickProfile({ message: 'ログインするプロファイルを選択してください', onlyReady: true }));

  const file = tokenPath(profile);
  if (!fs.existsSync(file)) {
    console.error(`Profile '${profile}' is not set up yet. Run: claude-profile-setup ${profile}`);
    process.exit(1);
  }

  const token = fs.readFileSync(file, 'utf8').trim();
  const result = spawnSync('claude', claudeArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: configDir(profile),
      CLAUDE_CODE_OAUTH_TOKEN: token,
    },
  });

  process.exit(result.status ?? 1);
}

main();
