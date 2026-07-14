'use strict';

const fs = require('fs');
const { spawnSync } = require('child_process');
const prompts = require('prompts');
const { version } = require('../package.json');
const { profilesDir, profileBase, tokenPath, configDir, listProfiles } = require('./profiles');
const { pickProfile } = require('./pick-profile');
const { promptHidden } = require('./prompt-hidden');

const META_FLAGS = new Set(['--help', '-h', '--version', '-V']);

const OPTIONS_TEXT = `Options:
  -h, --help      ヘルプを表示
  -V, --version   バージョンを表示`;

const splitCcpArgs = (argv) => {
  const hasProfile = argv.length > 0 && !argv[0].startsWith('-');
  return hasProfile
    ? { profileArg: argv[0], claudeArgs: argv.slice(1) }
    : { profileArg: undefined, claudeArgs: argv };
};

const COMMANDS = {
  setup: {
    names: ['setup', 'claude-profile-setup'],
    usage: 'claude-profile setup <profile>',
    summary: '新規プロファイルを作成し、トークンを発行・保存する',
    run: async (argv) => {
      const profile = argv[0];
      const missingProfile = !profile || profile.startsWith('-');
      if (missingProfile) {
        printCommandHelp('setup');
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
    },
  },
  list: {
    names: ['list', 'claude-profile-list'],
    usage: 'claude-profile list',
    summary: 'プロファイル一覧とセットアップ状態を表示する',
    run: async () => {
      const profiles = listProfiles();
      if (profiles.length === 0) {
        console.log('プロファイルはまだありません。claude-profile setup <profile> で作成してください。');
        return;
      }

      for (const profile of profiles) {
        const ready = fs.existsSync(tokenPath(profile));
        const mark = ready ? '✓' : '✗ (token未設定)';
        console.log(`${profile}\t${mark}\t${configDir(profile)}`);
      }
    },
  },
  remove: {
    names: ['remove', 'claude-profile-remove'],
    usage: 'claude-profile remove [profile]',
    summary: 'プロファイルを削除する (profile 省略時は対話選択)',
    run: async (argv) => {
      const arg = argv[0];
      const hasProfileArg = arg && !arg.startsWith('-');
      const profile = hasProfileArg
        ? arg
        : await pickProfile({ message: '削除するプロファイルを選択してください' });

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
        { onCancel: () => process.exit(1) }
      );

      if (!confirmed) {
        console.log('中断しました。');
        return;
      }

      fs.rmSync(base, { recursive: true, force: true });
      console.log(`削除しました: ${base}`);
    },
  },
  run: {
    names: ['run', 'ccp'],
    usage: 'claude-profile run [profile] [claude args...]',
    summary: '指定プロファイルとして claude を起動する (profile 省略時は対話選択)',
    run: async (argv) => {
      const { profileArg, claudeArgs } = splitCcpArgs(argv);
      const profile =
        profileArg ||
        (await pickProfile({ message: 'ログインするプロファイルを選択してください', onlyReady: true }));

      const file = tokenPath(profile);
      if (!fs.existsSync(file)) {
        console.error(`Profile '${profile}' is not set up yet. Run: claude-profile setup ${profile}`);
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
    },
  },
};

const COMMAND_BY_NAME = Object.fromEntries(
  Object.entries(COMMANDS).flatMap(([key, spec]) => spec.names.map((name) => [name, key]))
);

const isMetaRequest = (argv) => argv.length > 0 && META_FLAGS.has(argv[0]);

const resolveCommandKey = (name) => (name ? COMMAND_BY_NAME[name] : undefined);

const printVersion = () => {
  console.log(version);
};

const printCommandHelp = (commandKey) => {
  const spec = COMMANDS[commandKey];
  if (!spec) failUnknown(commandKey);

  console.log(`${spec.usage}

${spec.summary}

${OPTIONS_TEXT}
`);
};

const printRootHelp = () => {
  const lines = Object.values(COMMANDS).map((spec) => `  ${spec.usage.padEnd(44)} ${spec.summary}`);
  console.log(`claude-profile-cli ${version}

Usage:
  claude-profile [--help] [--version]
  claude-profile <command> [args...]
  claude-profile help [command]

Commands:
${lines.join('\n')}

${OPTIONS_TEXT}

Legacy commands (same behavior):
  claude-profile-setup, claude-profile-list, claude-profile-remove, ccp
`);
};

const handleMetaArgs = (argv, commandKey) => {
  if (!isMetaRequest(argv)) return false;
  if (argv[0] === '--version' || argv[0] === '-V') printVersion();
  else if (commandKey) printCommandHelp(commandKey);
  else printRootHelp();
  return true;
};

const failUnknown = (name) => {
  console.error(`Unknown command: ${name}`);
  console.error(`Run 'claude-profile help' for usage.`);
  process.exit(1);
};

const runCommand = async (commandKey, argv) => {
  await COMMANDS[commandKey].run(argv);
};

/** legacy bin エントリ用: claude-profile-setup 等 */
const runEntry = async (commandKey) => {
  const argv = process.argv.slice(2);
  if (handleMetaArgs(argv, commandKey)) return;
  await runCommand(commandKey, argv);
};

/** claude-profile メインエントリ用 */
const runMain = async () => {
  const argv = process.argv.slice(2);
  if (handleMetaArgs(argv)) return;

  const [command, ...rest] = argv;
  if (!command) {
    printRootHelp();
    return;
  }

  if (command === 'help') {
    const key = resolveCommandKey(rest[0]);
    if (rest[0] && !key) failUnknown(rest[0]);
    if (key) printCommandHelp(key);
    else printRootHelp();
    return;
  }

  const key = resolveCommandKey(command);
  if (!key) failUnknown(command);
  await runCommand(key, rest);
};

module.exports = { runEntry, runMain, COMMANDS, resolveCommandKey, isMetaRequest };

// node lib/cli.js
if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(isMetaRequest(['--help']), true);
  assert.strictEqual(isMetaRequest(['work', '--help']), false);
  assert.strictEqual(resolveCommandKey('ccp'), 'run');
  assert.strictEqual(resolveCommandKey('claude-profile-list'), 'list');
  assert.strictEqual(resolveCommandKey('nope'), undefined);
  console.log('ok');
}
