/**
 * SPEC「データ構造」「claude-profile list」節の振る舞いテスト。
 *
 * ```sh
 * npm run build && npx tsc -p tsconfig.test.json && node --test test-out/profiles-list.test.js
 * ```
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  listProfiles,
  profilesDir,
} from '../lib/profiles.js';

const repoRoot = path.resolve(__dirname, '..');
const cliEntry = path.join(repoRoot, 'bin', 'claude-profile.js');

/** 一時プロファイルルートを用意してテストを実行する */
const withTempProfilesDir = (run: (dir: string) => void): void => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-profiles-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

/** ビルド済み CLI を起動して結果を返す */
const runCli = (args: string[], profilesRoot: string) =>
  spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROFILES_DIR: profilesRoot },
  });

/** テスト用プロファイルを作成する */
const seedProfile = (root: string, name: string, options: { token?: boolean } = {}): void => {
  fs.mkdirSync(path.join(root, name, 'config'), { recursive: true });
  if (options.token) {
    fs.writeFileSync(path.join(root, name, 'token'), 'test-token', { mode: 0o600 });
  }
};

describe('profilesDir / listProfiles', () => {
  const savedProfilesDir = process.env.CLAUDE_PROFILES_DIR;

  afterEach(() => {
    if (savedProfilesDir === undefined) delete process.env.CLAUDE_PROFILES_DIR;
    else process.env.CLAUDE_PROFILES_DIR = savedProfilesDir;
  });

  test('CLAUDE_PROFILES_DIR でルートを上書きする', () => {
    withTempProfilesDir((dir) => {
      process.env.CLAUDE_PROFILES_DIR = dir;
      assert.equal(profilesDir(), dir);
    });
  });

  test('ルートが無いとき listProfiles は空配列を返す', () => {
    withTempProfilesDir((dir) => {
      process.env.CLAUDE_PROFILES_DIR = path.join(dir, 'missing');
      assert.deepEqual(listProfiles(), []);
    });
  });

  test('ディレクトリのみをプロファイル名として列挙する', () => {
    withTempProfilesDir((dir) => {
      process.env.CLAUDE_PROFILES_DIR = dir;
      seedProfile(dir, 'work', { token: true });
      seedProfile(dir, 'personal');
      fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore me');

      const names = [...listProfiles()].sort();
      assert.deepEqual(names, ['personal', 'work']);
    });
  });
});

describe('claude-profile list (CLI)', () => {
  test('プロファイルが無いとき setup 案内のみ表示する', () => {
    withTempProfilesDir((dir) => {
      const result = runCli(['list'], dir);
      assert.equal(result.status, 0);
      assert.equal(
        result.stdout.trim(),
        'プロファイルはまだありません。claude-profile setup <profile> で作成してください。'
      );
    });
  });

  test('token ありは ✓、なしは ✗ (token未設定) を表示する', () => {
    withTempProfilesDir((dir) => {
      seedProfile(dir, 'work', { token: true });
      seedProfile(dir, 'draft');

      const result = runCli(['list'], dir);
      assert.equal(result.status, 0);

      const lines = result.stdout.trim().split('\n').sort();
      assert.deepEqual(lines, [
        `draft\t✗ (token未設定)\t${path.join(dir, 'draft', 'config')}`,
        `work\t✓\t${path.join(dir, 'work', 'config')}`,
      ]);
    });
  });
});
