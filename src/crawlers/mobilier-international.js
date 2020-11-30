const debug = require('debug')('silknow:crawlers:mobilier-international');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class MobilierInternationalCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.method = 'get';
    this.request.url =
      'https://collection.mobiliernational.culture.gouv.fr/api/search';
    this.request.params = {
      product_type_ids: ['94', '97', '98'], // Tapisserie, Tissu précieux, Vêtement et accessoire
      period_start_year: '1500', // Start Year: 1500
      period_end_year: '1860', // End Year: 1860
      material_ids: ['97', '98', '103', '105', '106', '108', '96'], // Soie, Brocatelle, Damas, Lampas, Reps, Satin, Velours,
    };
    this.startPage = 1;
    this.limit = 25;

    this.paging.page = 'page';
  }

  async onSearchResult(result) {
    // Re-calculate pagination
    this.currentOffset += this.limit;
    this.totalPages = Math.ceil(result.totalHits / this.limit);

    for (const hit of result.hits) {
      await this.downloadRecord(hit);
    }

    return Promise.resolve();
  }

  async downloadRecord(recordData) {
    const recordNumber = `${recordData.id}`;

    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      const record = await this.getRecord(recordNumber);
      return Promise.resolve(record);
    }

    const recordUrl = url.resolve(
      'https://collection.mobiliernational.culture.gouv.fr/objet/',
      recordData.inventory_id
    );

    const record = new Record(recordNumber, recordUrl);

    // Add properties as fields
    Object.keys(recordData)
      .filter((key) => key !== 'images')
      .forEach((key) => {
        const value = recordData[key];
        if (typeof value !== 'object') {
          record.addField(key, recordData[key]);
        } else if (Array.isArray(value)) {
          value.forEach((subValue) => {
            if (typeof subValue !== 'object') {
              record.addField(key, [subValue]);
            }
          });
        }
      });

    // Images
    recordData.images.forEach((image) => {
      record.addImage({
        id: '',
        license: image.license,
        author: image.photographer,
        url: url.resolve(
          'https://collection.mobiliernational.culture.gouv.fr/media/xl/',
          image.path
        ),
      });
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    await this.writeRecord(record);

    return Promise.resolve(record);
  }
}

MobilierInternationalCrawler.id = 'mobilier-international';

module.exports = MobilierInternationalCrawler;
