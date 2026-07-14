/**
 * SPEC「claude-profile setup」節の振る舞いテスト。
 *
 * ```sh
 * npm run build && npx tsc -p tsconfig.test.json && node --test test-out/cli-setup.test.js
 * ```
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

const repoRoot = path.resolve(__dirname, '..');
const cliEntry = path.join(repoRoot, 'bin', 'claude-profile.js');

/** 一時プロファイルルートを用意してテストを実行する */
const withTempProfilesDir = (run: (dir: string) => void): void => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-setup-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

/** PATH 先頭に置くダミー claude スクリプトを作成する */
const withFakeClaude = (exitCode: number, run: (binDir: string) => void): void => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-bin-'));
  const claudePath = path.join(binDir, 'claude');
  fs.writeFileSync(claudePath, `#!/bin/sh\nexit ${exitCode}\n`);
  fs.chmodSync(claudePath, 0o755);
  try {
    run(binDir);
  } finally {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
};

type RunCliOptions = {
  profilesRoot: string;
  pathPrefix?: string;
  input?: string;
};

/** ビルド済み CLI を起動して結果を返す */
const runCli = (args: string[], options: RunCliOptions) =>
  spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: options.input ?? '',
    env: {
      ...process.env,
      CLAUDE_PROFILES_DIR: options.profilesRoot,
      PATH: options.pathPrefix ? `${options.pathPrefix}:${process.env.PATH}` : process.env.PATH,
    },
  });

/** パーミッション下3桁を返す */
const modeBits = (target: string): number => fs.statSync(target).mode & 0o777;

describe('claude-profile setup (CLI)', () => {
  test('profile 省略時は setup ヘルプを表示して終了する', () => {
    withTempProfilesDir((dir) => {
      const result = runCli(['setup'], { profilesRoot: dir });
      assert.equal(result.status, 1);
      assert.match(result.stdout, /claude-profile setup <profile>/);
    });
  });

  test('profile が - で始まるときは setup ヘルプを表示して終了する', () => {
    withTempProfilesDir((dir) => {
      const result = runCli(['setup', '--foo'], { profilesRoot: dir });
      assert.equal(result.status, 1);
      assert.match(result.stdout, /claude-profile setup <profile>/);
    });
  });

  test('claude setup-token 失敗時は中断する', () => {
    withTempProfilesDir((dir) => {
      withFakeClaude(1, (binDir) => {
        const result = runCli(['setup', 'work'], { profilesRoot: dir, pathPrefix: binDir });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /claude setup-token が失敗しました/);
        assert.equal(fs.existsSync(path.join(dir, 'work', 'token')), false);
      });
    });
  });

  test('トークンが空のときは中断する', () => {
    withTempProfilesDir((dir) => {
      withFakeClaude(0, (binDir) => {
        const result = runCli(['setup', 'work'], { profilesRoot: dir, pathPrefix: binDir, input: '\n' });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /トークンが空です/);
        assert.equal(fs.existsSync(path.join(dir, 'work', 'token')), false);
      });
    });
  });

  test('トークン保存時に config/token のパーミッションを設定する', () => {
    withTempProfilesDir((dir) => {
      withFakeClaude(0, (binDir) => {
        const result = runCli(['setup', 'work'], {
          profilesRoot: dir,
          pathPrefix: binDir,
          input: 'oauth-token-value\n',
        });
        assert.equal(result.status, 0);

        const profileDir = path.join(dir, 'work');
        const tokenFile = path.join(profileDir, 'token');

        assert.equal(fs.readFileSync(tokenFile, 'utf8'), 'oauth-token-value');
        assert.equal(modeBits(dir), 0o700);
        assert.equal(modeBits(profileDir), 0o700);
        assert.equal(modeBits(tokenFile), 0o600);
        assert.match(result.stdout, /保存しました/);
      });
    });
  });
});
