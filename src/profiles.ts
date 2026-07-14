import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProfileNameSchema } from './schemas';

/** プロファイル名の検証に失敗したときに投げる */
export class ProfileValidationError extends Error {
  constructor() {
    super('プロファイル名は英字または数字で始まり、英数字・._- のみ使用できます。');
    this.name = 'ProfileValidationError';
  }
}

/** プロファイル格納ルート (`CLAUDE_PROFILES_DIR` で上書き可) */
export const profilesDir = (): string =>
  process.env.CLAUDE_PROFILES_DIR ?? path.join(os.homedir(), '.claude-profiles');

/** `profilesDir` 配下に解決されることを保証する */
const assertUnderProfilesRoot = (resolved: string): void => {
  const root = path.resolve(profilesDir());
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  const contained = resolved === root || resolved.startsWith(prefix);
  if (!contained) throw new ProfileValidationError();
};

/** 単一プロファイルのベースディレクトリ */
export const profileBase = (profile: string): string => {
  const parsed = ProfileNameSchema.safeParse(profile);
  if (!parsed.success) throw new ProfileValidationError();

  const base = path.resolve(profilesDir(), parsed.data);
  assertUnderProfilesRoot(base);
  return base;
};

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
