const redis = require('redis');
const { promisify } = require('util');

const client = redis.createClient({
  url: process.env.REDIS_CONNECTION_URL,
});

const subscriber = client.duplicate();

const publisher = client.duplicate();
publisher.publishAsync = promisify(publisher.publish).bind(publisher);

module.exports = {
  subscriber,
  publisher,
};
