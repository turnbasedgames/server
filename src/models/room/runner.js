const { NodeVM } = require('vm2');
const axios = require('axios');

const logger = require('../../logger');

async function getUserCode(game) {
  logger.info('getting game code', { url: game.githubURL, id: game.id });
  const githubURL = new URL(game.githubURL);
  const [owner, repo] = githubURL.pathname.match(/[^/]+/g);
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${game.commitSHA}/index.js`;
  const { data: userCodeRaw } = await axios.get(url);

  const vm = new NodeVM({});
  const userCode = vm.run(userCodeRaw);
  return userCode;
}

// async function main() {
//   const userCode = await getUserCode({
//     githubURL: 'https://github.com/turnbasedgames/tictactoe',
//     commitSHA: 'master',
//   });

//   const boardstate = userCode.onRoomStart();
//   logger.info(JSON.stringify(boardstate, null, 2));
// }

// main();

/**
 * 1. start game
 * 2. in game
 *  a. player joining
 *  b. player makes move
 *  c. determine game is over
 * 3. end game
 */

module.exports = { getUserCode };
