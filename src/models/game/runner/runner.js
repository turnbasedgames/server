const { NodeVM } = require('vm2');
const axios = require('axios');

const logger = require('../../../logger');

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

module.exports = { getUserCode };
