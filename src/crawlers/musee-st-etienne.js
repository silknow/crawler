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

    const duplicateFields = {};
    Object.entries(recordData).forEach(([key]) => {
      if (key.indexOf('_') > -1) return;

      // E.g., "Autre numéro_2"
      let i = 1;
      // eslint-disable-next-line no-plusplus
      while (i++) {
        // console.log('i=', i);
        const nextKey = `${key}_${i}`;
        if (!Object.keys(recordData).includes(nextKey)) {
          break;
        }

        // E.g., "Fonction / Rôle_2_2"
        let j = 1;
        // eslint-disable-next-line no-plusplus
        while (j++) {
          const nextNextKey = `${key}_${i}_${j}`;
          if (!Object.keys(recordData).includes(nextNextKey)) {
            break;
          }
          const nextNextValue = recordData[nextNextKey].trim();
          if (nextNextValue.length > 0) {
            if (!Array.isArray(duplicateFields[key])) {
              duplicateFields[key] = [];
            }
            if (!duplicateFields[key].includes(nextNextValue)) {
              duplicateFields[key].push(nextNextValue);
            }
          }
        }

        const nextValue = recordData[nextKey];
        if (!Array.isArray(duplicateFields[key])) {
          duplicateFields[key] = [];
        }
        if (!duplicateFields[key].includes(nextValue)) {
          duplicateFields[key].push(nextValue);
        }
      }
    });

    Object.entries(duplicateFields).forEach(([key, values]) => {
      values
        .map((value) => value.trim())
        .filter((value) => value)
        .forEach((value) => {
          record.addField(key, value);
        });
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
