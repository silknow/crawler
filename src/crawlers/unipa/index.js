const debug = require('debug')('silknow:crawlers:unpa');
const csv = require('csv');
const fs = require('fs');
const path = require('path');

const Utils = require('../../helpers/utils');

// This crawler does not extend BaseCrawler because it relies on CSV
// files instead of HTTP requests.

class UnipaCrawler {
  constructor() {
    this.resourcesPath = path.resolve(
      process.cwd(),
      'data',
      UnipaCrawler.id,
      'resources'
    );
  }

  start() {
    return new Promise(async (resolve, reject) => {
      // Create record directory path
      try {
        await Utils.createPath(this.resourcesPath);
      } catch (e) {
        reject(e);
      }

      fs.readdir(this.resourcesPath, async (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        for (let i = 0; i < files.length; i += 1) {
          const filePath = path.join(this.resourcesPath, files[i]);
          await this.parseFile(filePath);
        }

        resolve();
      });
    });
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
          await this.writeRecord(data, recordNumber);
          resolve();
        }
      );
      fs.createReadStream(filePath).pipe(parser);
    });
  }

  async writeRecord(recordData, recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    debug('Writing record %s', recordNumber);
    const record = {
      id: recordNumber,
      fields: [],
      images: []
    };

    recordData.forEach(row => {
      record.fields.push({
        label: row[0],
        value: row[1]
      });

      if (row[0] === 'Images (names of the images in the document)') {
        const imagesIds = row[1].split(';');
        imagesIds.map(imageId => imageId.trim()).forEach(imageId => {
          record.images.push({
            id: imageId
          });
        });
      }
    });

    // Save the record
    return this.writeRecord(record);
  }
}

UnipaCrawler.id = 'unipa';

module.exports = UnipaCrawler;
