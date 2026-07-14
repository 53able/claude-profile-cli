/**
 * SPEC「ヘルプ・バージョン」節の振る舞いテスト。
 *
 * ```sh
 * npm run build && npx tsc -p tsconfig.test.json && node --test test-out/cli-meta.test.js
 * ```
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, test } from 'node:test';
import { version } from '../package.json';
import { isMetaRequest, resolveCommandKey } from '../lib/cli.js';

const repoRoot = path.resolve(__dirname, '..');
const cliEntry = path.join(repoRoot, 'bin', 'claude-profile.js');

/** ビルド済み CLI を起動して結果を返す */
const runCli = (args: string[]) =>
  spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROFILES_DIR: path.join(repoRoot, 'test-out', 'unused-profiles') },
  });

describe('resolveCommandKey', () => {
  test('既知のサブコマンド名を返す', () => {
    assert.equal(resolveCommandKey('run'), 'run');
    assert.equal(resolveCommandKey('list'), 'list');
  });

  test('不明な名前は undefined を返す', () => {
    assert.equal(resolveCommandKey('nope'), undefined);
  });
});

describe('isMetaRequest', () => {
  test('先頭がメタフラグなら true', () => {
    assert.equal(isMetaRequest(['--help']), true);
    assert.equal(isMetaRequest(['-h']), true);
    assert.equal(isMetaRequest(['--version']), true);
    assert.equal(isMetaRequest(['-V']), true);
  });

  test('サブコマンド引数内のフラグは false', () => {
    assert.equal(isMetaRequest(['work', '--help']), false);
  });
});

describe('claude-profile メタ引数 (CLI)', () => {
  test('--version で package version を表示する', () => {
    const result = runCli(['--version']);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), version);
  });

  test('-V で package version を表示する', () => {
    const result = runCli(['-V']);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), version);
  });

  test('--help で全体ヘルプを表示する', () => {
    const result = runCli(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /claude-profile-cli/);
    assert.match(result.stdout, /Commands:/);
  });

  test('不明なサブコマンドはエラーで help 実行を促す', () => {
    const result = runCli(['nope']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown command: nope/);
    assert.match(result.stderr, /claude-profile help/);
  });
});
