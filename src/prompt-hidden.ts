import readline from 'node:readline';

type HiddenReadline = readline.Interface & {
  _writeToOutput: (stringToWrite: string) => void;
  output: NodeJS.WriteStream;
};

/**
 * 入力内容を画面に表示しないプロンプト。
 * トークン貼り付け用。
 */
export const promptHidden = (query: string): Promise<string> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout }) as HiddenReadline;
    const muted = { value: false };

    rl._writeToOutput = (stringToWrite: string) => {
      if (!muted.value) rl.output.write(stringToWrite);
    };

    rl.question(query, (answer: string) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });

    muted.value = true;
  });
