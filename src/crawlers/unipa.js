const debug = require('debug')('silknow:crawlers:unipa');
const csv = require('csv');
const fs = require('fs-extra');
const path = require('path');

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
        .map(f => path.join(this.resourcesPath, f))
        .map(filePath => this.parseFile(filePath))
    );
  }

  async parseFile(filePath) {
    return new Promise((resolve, reject) => {
      debug('Parsing file %s', filePath);
      const parser = csv.parse(
        {
          delimiter: ','
        },
        async (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          const recordNumber = path.basename(filePath, '.csv');
          await this.parseRecord(data, recordNumber);
          resolve();
        }
      );
      fs.createReadStream(filePath).pipe(parser);
    });
  }

  async parseRecord(recordData, recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    debug('Writing record %s', recordNumber);
    const record = new Record(recordNumber);

    recordData.forEach(row => {
      record.addField(row[0], row[1]);

      if (row[0] === 'Images (names of the images in the document)') {
        const imagesIds = row[1].split(';');
        imagesIds
          .map(imageId => imageId.trim())
          .forEach(imageId => {
            record.addImage({
              id: imageId
            });
          });
      }
    });

    return this.writeRecord(record);
  }
}

UnipaCrawler.id = 'unipa';

module.exports = UnipaCrawler;
