import { configureSync, getConsoleSink, getLogger, type Logger } from '@logtape/logtape';
import { LogLevelSchema, type LogLevel } from './schemas';

const ROOT = 'claude-profile-cli';

/**
 * LogTape を初期化する。
 * ログレベルは `LOGTAPE_LEVEL` で上書き (未設定時は `warning`)。
 */
export const setupLogging = (): void => {
  const parsed = LogLevelSchema.safeParse(process.env.LOGTAPE_LEVEL);
  const lowestLevel: LogLevel = parsed.success ? parsed.data : 'warning';

  configureSync({
    sinks: { console: getConsoleSink() },
    loggers: [
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
      { category: [ROOT], lowestLevel, sinks: ['console'] },
    ],
  });
};

/** モジュール別ロガーを返す */
export const moduleLogger = (module: string): Logger => getLogger([ROOT, module]);
