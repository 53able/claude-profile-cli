import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** プロファイル格納ルート (`CLAUDE_PROFILES_DIR` で上書き可) */
export const profilesDir = (): string =>
  process.env.CLAUDE_PROFILES_DIR ?? path.join(os.homedir(), '.claude-profiles');

/** 単一プロファイルのベースディレクトリ */
export const profileBase = (profile: string): string => path.join(profilesDir(), profile);

/** 長期 OAuth トークンファイルのパス */
export const tokenPath = (profile: string): string => path.join(profileBase(profile), 'token');

/** `CLAUDE_CONFIG_DIR` として使う設定ディレクトリ */
export const configDir = (profile: string): string => path.join(profileBase(profile), 'config');

/** 登録済みプロファイル名の一覧 */
export const listProfiles = (): string[] => {
  try {
    return fs.readdirSync(profilesDir()).filter((name: string) => {
      return fs.statSync(path.join(profilesDir(), name)).isDirectory();
    });
  } catch {
    return [];
  }
};
