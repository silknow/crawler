const debug = require('debug')('silknow:crawlers:unipa');
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const BaseCrawler = require('./base');
const Record = require('../models/record');
const Utils = require('../helpers/utils');

class UnipaCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.resourcesPath = path.resolve(
      process.cwd(),
      'data',
      UnipaCrawler.id,
      'resources'
    );
  }

  async start() {
    await Utils.createPath(this.resourcesPath);
    const files = fs.readdirSync(this.resourcesPath);
    return Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(this.resourcesPath, f))
        .map(filePath => this.parseFile(filePath))
    );
  }

  async parseFile(filePath) {
    debug('Parsing file %s', filePath);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      const data = JSON.parse(line);
      const recordNumber = data.created;
      await this.parseRecord(data, recordNumber);
    }
  }

  async parseRecord(recordData, recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    debug('Writing record %s', recordNumber);
    const record = new Record(recordNumber);

    Object.entries(recordData)
      .filter(([key]) => key !== 'image')
      .forEach(([key, value]) => record.addField(key, value));

    record.addImage({
      id: path.basename(recordData.image, path.extname(recordData.image)),
      url: `file://${path.join(
        this.resourcesPath,
        'images',
        path.basename(recordData.image)
      )}`
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Remove local URLs since they are useless
    record.images.forEach(image => delete image.url);

    return this.writeRecord(record);
  }
}

UnipaCrawler.id = 'unipa';

module.exports = UnipaCrawler;
