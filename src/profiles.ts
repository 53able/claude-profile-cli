import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProfileNameSchema } from './schemas';

const PROFILE_NAME_EXAMPLES = 'work, my-profile';

/** プロファイル名が不正な理由を返す */
const profileNameReason = (profile: string): string => {
  if (profile.length === 0) return '名前が空です。';
  if (profile.includes('..')) return '`..` は使えません。';
  if (profile.includes('/') || profile.includes('\\')) return 'スラッシュ (/, \\) は使えません。';
  if (profile.startsWith('.')) return 'ドット (.) で始めることはできません。';
  if (!/^[a-zA-Z0-9]/.test(profile)) return '英字または数字で始めてください。';
  if (/[^a-zA-Z0-9._-]/.test(profile)) {
    return '使えない文字が含まれています。使えるのは英数字・._- のみです。';
  }
  return '英字または数字で始まり、英数字・._- のみ使用できます。';
};

/** バリデーション失敗時にユーザーへ表示するメッセージ */
export const formatProfileValidationMessage = (profile: string): string => {
  const lines = [
    `無効なプロファイル名です: ${profile}`,
    profileNameReason(profile),
    `例: ${PROFILE_NAME_EXAMPLES}`,
  ];
  const existing = listProfiles();
  if (existing.length > 0) lines.push(`既存のプロファイル: ${existing.join(' ')}`);
  return lines.join('\n');
};

/** プロファイル名の検証に失敗したときに投げる */
export class ProfileValidationError extends Error {
  constructor(profile: string) {
    super(formatProfileValidationMessage(profile));
    this.name = 'ProfileValidationError';
  }
}

/** プロファイル格納ルート (`CLAUDE_PROFILES_DIR` で上書き可) */
export const profilesDir = (): string =>
  process.env.CLAUDE_PROFILES_DIR ?? path.join(os.homedir(), '.claude-profiles');

/** `profilesDir` 配下に解決されることを保証する */
const assertUnderProfilesRoot = (resolved: string, profile: string): void => {
  const root = path.resolve(profilesDir());
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  const contained = resolved === root || resolved.startsWith(prefix);
  if (!contained) throw new ProfileValidationError(profile);
};

/** 単一プロファイルのベースディレクトリ */
export const profileBase = (profile: string): string => {
  const parsed = ProfileNameSchema.safeParse(profile);
  if (!parsed.success) throw new ProfileValidationError(profile);

  const base = path.resolve(profilesDir(), parsed.data);
  assertUnderProfilesRoot(base, profile);
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
