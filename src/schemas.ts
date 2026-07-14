import { z } from 'zod';

/** サブコマンド名 */
export const CommandKeySchema = z.enum(['setup', 'list', 'remove', 'run']);
export type CommandKey = z.infer<typeof CommandKeySchema>;

/**
 * プロファイル名。
 * 英字または数字で始まり、英数字・`.`・`_`・`-` のみ許可する。
 */
export const ProfileNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'invalid profile name');
export type ProfileName = z.infer<typeof ProfileNameSchema>;

/** `pickProfile` のオプション */
export const PickProfileOptionsSchema = z.object({
  message: z.string().optional(),
  onlyReady: z.boolean().optional(),
});
export type PickProfileOptions = z.infer<typeof PickProfileOptionsSchema>;

/** LogTape のログレベル (`LOGTAPE_LEVEL` 環境変数) */
export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warning', 'error', 'fatal']);
export type LogLevel = z.infer<typeof LogLevelSchema>;
