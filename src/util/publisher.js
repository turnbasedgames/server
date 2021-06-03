const { randomUUID } = require('crypto');
const { promisify } = require('util');

const logger = require('../logger');

class Publisher {
  constructor(publisher) {
    this.id = randomUUID();
    this.publisher = publisher;
    this.publishRaw = promisify(publisher.publish).bind(publisher);
    publisher.on('error', (err) => {
      logger.error('error in publisher redis client', { err, managerId: this.id });
    });
  }

  async publish(chan, msg) {
    const numListeners = await this.publishRaw(chan, msg);
    logger.info('published message', {
      managerId: this.id, chan, msg, numListeners,
    });
    return numListeners;
  }
}

module.exports = Publisher;
