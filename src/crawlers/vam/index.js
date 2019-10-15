const debug = require('debug')('silknow:crawlers:vam');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const url = require('url');

const BaseCrawler = require('../base');
const Record = require('../record');

class VamCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'https://www.vam.ac.uk/api/json/museumobject/search?after=1400&before=1900&materialsearch=silk&images=1';
    this.paging.offset = 'offset';
    this.paging.limit = 'limit';
    this.limit = 45;

    this.imagesQueue = [];
  }

  async onSearchResult(result) {
    const resultCount = result.meta.result_count;
    this.totalPages = Math.ceil(resultCount / this.limit);

    for (const recordData of result.records) {
      try {
        await this.downloadRecord(recordData.fields.object_number);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += result.records.length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const recordUrl = `https://www.vam.ac.uk/api/json/museumobject/${recordNumber}`;
    let response;
    try {
      response = await axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = new Record(recordNumber, recordUrl);

    // Map the output to a normalized structure for the converter
    const { fields } = response.data[0];
    record.fields = Object.keys(fields)
      .filter(key => ['string', 'number'].includes(typeof fields[key]))
      .map(key => ({ label: key, value: fields[key] }));

    // Categories
    if (Array.isArray(fields.categories)) {
      record.addField(
        'categories',
        fields.categories.map(category => category.fields.name)
      );
    }

    // Materials
    if (Array.isArray(fields.materials)) {
      record.addField(
        'materials',
        fields.materials.map(material => material.fields.name)
      );
    }

    // Techniques
    if (Array.isArray(fields.techniques)) {
      record.addField(
        'techniques',
        fields.techniques.map(technique => technique.fields.name)
      );
    }

    // Collections
    if (Array.isArray(fields.collections)) {
      record.addField(
        'collections',
        fields.collections.map(collection => collection.fields.name)
      );
    }

    // Images
    if (Array.isArray(fields.image_set)) {
      record.images = fields.image_set.map(image => ({
        id: image.fields.image_id,
        url: url.resolve(
          'http://media.vam.ac.uk/media/thira/',
          image.fields.local
        )
      }));
    }

    // Download the images
    for (const image of response.data[0].fields.image_set) {
      const imageUrl = url.resolve(
        'http://media.vam.ac.uk/media/thira/',
        image.fields.local
      );
      const imageId = image.fields.image_id;
      try {
        await this.downloadFile(imageUrl, `${imageId}.jpg`);
      } catch (e) {
        debug('Could not download image %s: %s', image.url, e.message);
      }
    }

    // Save the record
    return this.writeRecord(record);
  }
}

VamCrawler.id = 'vam';

module.exports = VamCrawler;
