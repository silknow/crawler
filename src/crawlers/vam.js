const debug = require('debug')('silknow:crawlers:vam');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class VamCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.urlsList = [
      'https://api.vam.ac.uk/v2/objects/search?page_size=100&images_exist=true&year_made_from=1400&year_made_to=1900&id_collection=THES48601&id_technique=AAT53642&id_material=AAT243428',
      'https://api.vam.ac.uk/v2/objects/search?page_size=100&q=silk&images_exist=true&id_material=x30308&id_collection=THES48601&year_made_from=1400&year_made_to=1900',
      'https://api.vam.ac.uk/v2/objects/search?page_size=100&q=textile%20design&images_exist=true&id_material=AAT243428&year_made_from=1400&year_made_to=1900&id_collection=THES48601',
    ];
    this.paging.page = 'page';
    this.limit = 100;
    this.startPage = 1;
  }

  async start() {
    this.request.url = this.urlsList.shift();
    return super.start();
  }

  async onSearchResult(result) {
    this.totalPages = result.info.pages;

    for (const recordData of result.records) {
      try {
        await this.downloadRecord(recordData.systemNumber);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += result.records.length;

    if (result.info.page >= this.totalPages) {
      this.request.url = this.urlsList.shift();
      if (typeof this.request.url !== 'undefined') {
        debug('Next URL: %s', this.request.url);
        this.currentOffset = 0;
        this.currentPage = this.startPage;
        this.totalPages = this.startPage + 1;
      }
    }

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const recordUrl = `https://api.vam.ac.uk/v2/museumobject/${recordNumber}`;
    let response;
    try {
      response = await this.axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = new Record(
      recordNumber,
      `https://collections.vam.ac.uk/item/${recordNumber}`
    );

    // Map the output to a normalized structure for the converter
    const fields = response.data.record;
    record.fields = Object.keys(fields)
      .filter((key) => ['string', 'number'].includes(typeof fields[key]))
      .map((key) => ({ label: key, value: fields[key] }));

    // Array fields
    Object.entries(fields).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((val) => {
          if (
            // Simple array fields (techniques, materials, categories, ...)
            typeof val.id !== 'undefined' &&
            typeof val.text !== 'undefined'
          ) {
            record.addField(key, val.text);
          } else if (
            // Title field
            typeof val.title !== 'undefined'
          ) {
            record.addField(key, val.title);
          } else if (
            // Artist Maker fields
            typeof val.name !== 'undefined' &&
            typeof val.association !== 'undefined'
          ) {
            record.addField(
              key,
              [val.name.text, val.association.text, val.note].join(' | ')
            );
          } else if (
            // Place fields
            typeof val.place !== 'undefined' &&
            typeof val.association !== 'undefined'
          ) {
            record.addField(
              key,
              [val.place.text, val.association.text, val.note].join(' | ')
            );
          } else if (
            // Date fields
            typeof val.date !== 'undefined' &&
            typeof val.association !== 'undefined'
          ) {
            record.addField(
              key,
              [val.date.text, val.association.text, val.note].join(' | ')
            );
          } else if (
            // Bibliography fields
            typeof val.reference !== 'undefined'
          ) {
            record.addField(
              key,
              [val.free, val.reference.text, val.details].join(' | ')
            );
          }
        });
      } else if (typeof val === 'object' && typeof value.text !== 'undefined') {
        record.addField(key, value.text);
      }
    });

    // Images
    if (Array.isArray(fields.images)) {
      fields.images.forEach((image) => {
        record.addImage({
          id: image,
          url: `https://framemark.vam.ac.uk/collections/${image}/full/2200,/0/default.jpg`,
        });
      });
    }

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }
}

VamCrawler.id = 'vam';

module.exports = VamCrawler;
