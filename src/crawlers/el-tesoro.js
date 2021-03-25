const debug = require('debug')('silknow:crawlers:el-tesoro');
const fs = require('fs-extra');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const path = require('path');

const BaseCrawler = require('./base');
const Record = require('../models/record');
const Utils = require('../helpers/utils');

class ElTesoroCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.resourcesPath = path.resolve(
      process.cwd(),
      'data',
      ElTesoroCrawler.id,
      'resources'
    );

    this.tempPath = path.resolve(
      process.cwd(),
      'data',
      ElTesoroCrawler.id,
      'tmp'
    );
  }

  async start() {
    await Utils.createPath(this.resourcesPath);
    await Utils.createPath(this.tempPath);
    const files = fs.readdirSync(this.resourcesPath);
    return Promise.all(
      files
        .filter((f) => f.endsWith('.docx'))
        .map((f) => path.join(this.resourcesPath, f))
        .map((filePath) => this.parseFile(filePath))
    );
  }

  async parseFile(filePath) {
    return new Promise((resolve) => {
      debug('Parsing file %s', filePath);

      mammoth
        .convertToHtml({ path: filePath })
        .then(async (result) => {
          const html = result.value;
          const { messages } = result;

          if (Array.isArray(messages) && messages.length > 0) {
            console.info(messages);
          }

          const $ = cheerio.load(html);
          const rows = [];
          let currentRow = null;
          $('tr').each((i, tr) => {
            const $td = $(tr).find('td').first();

            // Detect new record
            if ($td.attr('colspan') === '3') {
              // Push previous record
              if (currentRow !== null) {
                rows.push(currentRow);
              }

              // Reset current row
              currentRow = { fields: {} };
            }

            // Image
            if ($td.attr('rowspan') === '10') {
              currentRow.image = $td.find('img').first().attr('src');

              // Record number
              currentRow.fields['Nº de Inventario'] = $td
                .next('td')
                .next('td')
                .text()
                .trim();
            } else {
              // Other fields
              currentRow.fields[$td.text().trim()] = $td
                .next('td')
                .text()
                .trim();
            }
          });

          for (const row of rows) {
            await this.parseRecord(row);
          }

          resolve();
        })
        .done();
    });
  }

  async parseRecord(recordData) {
    const recordNumber = recordData.fields['Nº de Inventario'];
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

    Object.entries(recordData.fields).forEach(([key, value]) => {
      record.addField(key, value);
    });

    const tempImages = [];
    if (recordData.image) {
      const base64Data = recordData.image.replace(
        /^data:image\/jpeg;base64,/,
        ''
      );
      const imageName = `${recordNumber}.jpg`;
      const imagePath = path.join(this.tempPath, imageName);
      fs.writeFileSync(
        path.join(this.tempPath, imageName),
        base64Data,
        'base64',
        (err) => {
          console.log(err);
        }
      );
      record.addImage({
        id: recordNumber,
        url: `file://${imagePath}`,
      });
      tempImages.push(imagePath);
    }

    // Download the images
    await this.downloadRecordImages(record);

    // Remove local URLs since they are useless
    record.getImages().forEach((image) => delete image.url);

    // Delete temporary images files
    tempImages.forEach((image) => fs.unlinkSync(image));

    return this.writeRecord(record);
  }
}

ElTesoroCrawler.id = 'el-tesoro';

module.exports = ElTesoroCrawler;
