import fs from 'node:fs';
import prompts from 'prompts';
import { PickProfileOptionsSchema, type PickProfileOptions } from './schemas';
import { listProfiles, tokenPath } from './profiles';
import { moduleLogger } from './logging';

const log = moduleLogger('pick-profile');

/**
 * 既存プロファイルから対話選択する。
 * `onlyReady: true` のとき token 未設定は選択不可。
 */
export const pickProfile = async (rawOptions: PickProfileOptions = {}): Promise<string> => {
  const options = PickProfileOptionsSchema.parse(rawOptions);
  const profiles = listProfiles();
  if (profiles.length === 0) {
    log.error('no profiles available');
    console.error('プロファイルがありません。claude-profile setup <profile> で作成してください。');
    process.exit(1);
  }

  const { profile } = await prompts(
    {
      type: 'select',
      name: 'profile',
      message: options.message ?? 'プロファイルを選択してください',
      choices: profiles.map((name) => {
        const ready = fs.existsSync(tokenPath(name));
        return {
          title: ready ? name : `${name} (token未設定)`,
          value: name,
          disabled: (options.onlyReady ?? false) && !ready,
        };
      }),
    },
    {
      onCancel: () => {
        log.info('profile pick cancelled');
        console.error('キャンセルしました。');
        process.exit(1);
      },
    }
  );

  if (!profile || typeof profile !== 'string') process.exit(1);
  log.debug('profile picked', { profile });
  return profile;
};
