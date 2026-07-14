'use strict';

const readline = require('readline');

function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;

    rl._writeToOutput = function writeToOutput(stringToWrite) {
      if (!muted) rl.output.write(stringToWrite);
    };

    rl.question(query, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });

    muted = true;
  });
}

module.exports = { promptHidden };
