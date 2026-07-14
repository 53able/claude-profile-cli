import { z } from 'zod';

/** サブコマンド名 */
export const CommandKeySchema = z.enum(['setup', 'list', 'remove', 'run']);
export type CommandKey = z.infer<typeof CommandKeySchema>;

/** `pickProfile` のオプション */
export const PickProfileOptionsSchema = z.object({
  message: z.string().optional(),
  onlyReady: z.boolean().optional(),
});
export type PickProfileOptions = z.infer<typeof PickProfileOptionsSchema>;

/** LogTape のログレベル (`LOGTAPE_LEVEL` 環境変数) */
export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warning', 'error', 'fatal']);
export type LogLevel = z.infer<typeof LogLevelSchema>;
