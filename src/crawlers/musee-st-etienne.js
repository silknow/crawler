const debug = require('debug')('silknow:crawlers:musee-st-etienne');
const csv = require('csv');
const fs = require('fs-extra');
const path = require('path');

const BaseCrawler = require('./base');
const Record = require('../models/record');
const Utils = require('../helpers/utils');

class MuseeStEtienneCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.resourcesPath = path.resolve(
      process.cwd(),
      'data',
      MuseeStEtienneCrawler.id,
      'resources'
    );
  }

  async start() {
    await Utils.createPath(this.resourcesPath);
    const files = fs.readdirSync(this.resourcesPath);
    return Promise.all(
      files
        .filter((f) => f.endsWith('.tsv'))
        .map((f) => path.join(this.resourcesPath, f))
        .map((filePath) => this.parseFile(filePath))
    );
  }

  async parseFile(filePath) {
    return new Promise((resolve, reject) => {
      debug('Parsing file %s', filePath);
      const parser = csv.parse(
        {
          bom: true,
          columns: true,
          quote: null,
          delimiter: '\t',
        },
        async (err, data) => {
          if (err) {
            reject(err);
            return;
          }

          for (const d of data) {
            const recordData = JSON.parse(JSON.stringify(d));
            await this.parseRecord(recordData);
          }

          resolve();
        }
      );
      fs.createReadStream(filePath).pipe(parser);
    });
  }

  async parseRecord(recordData) {
    const recordNumber = recordData["Numéro d'inventaire"];
    if (typeof recordNumber !== 'string' || recordNumber.length === 0) {
      debug('Invalid record number "%s"', recordNumber);
      return Promise.resolve();
    }
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    debug('Writing record %s', recordNumber);
    const record = new Record(recordNumber);

    Object.entries(recordData).forEach(([key, value]) => {
      record.addField(key, value);
    });

    let i = 0;
    let hasImage = true;
    while (hasImage) {
      i += 1;
      let j = 0;
      let hasSubImage = true;
      hasImage = false;
      while (hasSubImage) {
        j += 1;
        const imageUrl = recordData[`Z${i}C${j}_Nom du fichier`];
        if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
          hasSubImage = false;
          break;
        }

        const imageId = recordData[`Z${i}C${j}_Référence`];
        const imageLicense = recordData[`Z${i}C${j}_Z1C1_Mention obligatoire`];

        if (typeof imageUrl === 'string' && imageUrl.length > 0) {
          console.log('add image', imageUrl);
          record.addImage({
            id: imageId,
            url: `file://${path.join(
              this.resourcesPath,
              'media',
              path.basename(imageUrl)
            )}`,
            license: imageLicense,
          });
        }

        hasImage = true;
      }
    }

    // Download the images
    await this.downloadRecordImages(record);

    // Remove local URLs since they are useless
    record.getImages().forEach((image) => delete image.url);

    return this.writeRecord(record);
  }
}

MuseeStEtienneCrawler.id = 'musee-st-etienne';

module.exports = MuseeStEtienneCrawler;
