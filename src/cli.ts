import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import prompts from 'prompts';
import { version } from '../package.json';
import { pickProfile } from './pick-profile';
import { promptHidden } from './prompt-hidden';
import { configDir, listProfiles, profileBase, profilesDir, tokenPath } from './profiles';
import { moduleLogger, setupLogging } from './logging';
import { CommandKeySchema, type CommandKey } from './schemas';

const log = moduleLogger('cli');

const META_FLAGS = new Set(['--help', '-h', '--version', '-V']);

const OPTIONS_TEXT = `Options:
  -h, --help      ヘルプを表示
  -V, --version   バージョンを表示`;

type SplitRunArgs = {
  profileArg: string | undefined;
  claudeArgs: string[];
};

/** `run` 用: 第1引数がプロファイル名か claude 引数かを分離 */
const splitRunArgs = (argv: string[]): SplitRunArgs => {
  const hasProfile = argv.length > 0 && !argv[0].startsWith('-');
  return hasProfile
    ? { profileArg: argv[0], claudeArgs: argv.slice(1) }
    : { profileArg: undefined, claudeArgs: argv };
};

type CommandSpec = {
  usage: string;
  summary: string;
  run: (argv: string[]) => Promise<void>;
};

const COMMANDS: Record<CommandKey, CommandSpec> = {
  setup: {
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
        log.error('claude setup-token failed', { profile, status: result.status });
        console.error('claude setup-token が失敗しました。');
        process.exit(result.status ?? 1);
      }

      const token = await promptHidden('トークンを貼り付けて Enter を押してください: ');
      if (!token) {
        log.error('empty token on setup', { profile });
        console.error('トークンが空です。中断しました。');
        process.exit(1);
      }

      const file = tokenPath(profile);
      fs.writeFileSync(file, token, { mode: 0o600 });
      fs.chmodSync(file, 0o600);

      log.info('profile token saved', { profile, file });

      console.log(`保存しました: ${file}`);
      console.log(`次から 'claude-profile run ${profile}' でこのプロファイルとして claude を起動できます。`);
    },
  },
  list: {
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
        log.error('profile not found for remove', { profile, available: listProfiles() });
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
        log.info('profile remove cancelled', { profile });
        console.log('中断しました。');
        return;
      }

      fs.rmSync(base, { recursive: true, force: true });
      log.info('profile removed', { profile, base });
      console.log(`削除しました: ${base}`);
    },
  },
  run: {
    usage: 'claude-profile run [profile] [claude args...]',
    summary: '指定プロファイルとして claude を起動する (profile 省略時は対話選択)',
    run: async (argv) => {
      const { profileArg, claudeArgs } = splitRunArgs(argv);
      const profile =
        profileArg ??
        (await pickProfile({ message: 'ログインするプロファイルを選択してください', onlyReady: true }));

      const file = tokenPath(profile);
      if (!fs.existsSync(file)) {
        log.error('profile not set up for run', { profile });
        console.error(`Profile '${profile}' is not set up yet. Run: claude-profile setup ${profile}`);
        process.exit(1);
      }

      const token = fs.readFileSync(file, 'utf8').trim();
      log.info('launching claude', { profile, configDir: configDir(profile), args: claudeArgs });
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

/** `--help` / `--version` などメタ引数か */
export const isMetaRequest = (argv: string[]): boolean => argv.length > 0 && META_FLAGS.has(argv[0]);

/** コマンド名を検証して返す。不明なら `undefined` */
export const resolveCommandKey = (name: string): CommandKey | undefined => {
  const parsed = CommandKeySchema.safeParse(name);
  return parsed.success ? parsed.data : undefined;
};

const printVersion = (): void => {
  console.log(version);
};

const printCommandHelp = (commandKey: CommandKey): void => {
  const spec = COMMANDS[commandKey];
  console.log(`${spec.usage}

${spec.summary}

${OPTIONS_TEXT}
`);
};

const printRootHelp = (): void => {
  const lines = Object.entries(COMMANDS).map(
    ([, spec]) => `  ${spec.usage.padEnd(44)} ${spec.summary}`
  );
  console.log(`claude-profile-cli ${version}

Usage:
  claude-profile [--help] [--version]
  claude-profile <command> [args...]
  claude-profile help [command]

Commands:
${lines.join('\n')}

${OPTIONS_TEXT}
`);
};

const handleMetaArgs = (argv: string[]): boolean => {
  if (!isMetaRequest(argv)) return false;
  if (argv[0] === '--version' || argv[0] === '-V') printVersion();
  else printRootHelp();
  return true;
};

const failUnknown = (name: string): never => {
  log.error('unknown command', { command: name });
  console.error(`Unknown command: ${name}`);
  console.error(`Run 'claude-profile help' for usage.`);
  process.exit(1);
  throw new Error('unreachable');
};

const runCommand = async (commandKey: CommandKey, argv: string[]): Promise<void> => {
  await COMMANDS[commandKey].run(argv);
};

/** CLI エントリポイント */
export const runMain = async (): Promise<void> => {
  setupLogging();
  const argv = process.argv.slice(2);
  log.debug('argv parsed', { argv });
  if (handleMetaArgs(argv)) return;

  const [command, ...rest] = argv;
  if (!command) {
    printRootHelp();
    return;
  }

  if (command === 'help') {
    const key = resolveCommandKey(rest[0] ?? '');
    if (rest[0] && !key) failUnknown(rest[0]);
    if (key) printCommandHelp(key);
    else printRootHelp();
    return;
  }

  const maybeKey = resolveCommandKey(command);
  if (maybeKey) {
    log.debug('command resolved', { command: maybeKey });
    await runCommand(maybeKey, rest);
    return;
  }
  failUnknown(command);
};

export { COMMANDS };
