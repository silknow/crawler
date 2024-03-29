const debug = require('debug')('silknow:crawlers:mfa-boston');
const cheerio = require('cheerio');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class MfaBostonCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.urlsList = [
      'https://collections.mfa.org/search/Objects/classifications%3ATextiles%3BimageExistence%3Atrue%3BcollectionTerms%3AEurope%2CTextiles%20and%20Fashion%20Arts/*/list',
      'https://collections.mfa.org/search/Objects/*/design%20weaving/list?filter=allClassifications%3AWatercolors%3BimageExistence%3Atrue',
    ];
    this.paging.page = 'page';
    this.limit = 12;

    // Disable http(s) agents for Mfa Boston because of an issue with some requests
    // (see: https://github.com/silknow/crawler/issues/10)
    this.axios.defaults.httpAgent = false;
    this.axios.defaults.httpsAgent = false;
  }

  async start() {
    this.request.url = this.urlsList.shift();
    return super.start();
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);

    if ($('#pageField').length > 0) {
      this.totalPages = parseInt($('#pageField').attr('max'), 10);
    }

    const records = [];
    $('#tlistview .list-item').each((i, elem) => {
      const recordNumber = $(elem).attr('data-emuseum-id');
      const recordUrl = `https://collections.mfa.org/objects/${recordNumber}`;
      records.push({ recordNumber, recordUrl });
    });

    for (const { recordNumber, recordUrl } of records) {
      try {
        await this.downloadRecord(recordNumber, recordUrl);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('#tlistview .list-item').length;

    if ($('#tlistview .list-item').length < this.limit) {
      this.request.url = this.urlsList.shift();
      if (typeof this.request.url !== 'undefined') {
        this.currentOffset = 0;
        this.currentPage = this.startPage;
        this.totalPages = this.startPage;
      }
    }

    return Promise.resolve();
  }

  async downloadRecord(recordNumber, recordUrl) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    let response;
    try {
      response = await this.axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = new Record(recordNumber, recordUrl);

    const $ = cheerio.load(response.data);

    // Fields (title, medium/techniques, dimensions, credit line, ...)
    $('.detailField').each((i, elem) => {
      if ($(elem).find('.detailFieldLabel').length > 0) {
        const label = $(elem).find('.detailFieldLabel').first().text().trim();
        const value = $(elem).find('.detailFieldValue').first().text().trim();
        record.addField(label, value);
      } else {
        const label = $(elem)
          .attr('class')
          .split(' ')
          .filter((c) => c.includes('Field') && c !== 'detailField')
          .pop();
        const value = $(elem).text().trim();
        record.addField(label, value);
      }
    });

    // Primary images
    $('#detailView img').each((i, elem) => {
      const link = $(elem).attr('src');
      const idMatch = link.match(/\/internal\/media\/dispatcher\/([0-9]+)\//);
      const image = {};
      if (idMatch) {
        image.id = idMatch[1];
        image.url = `https://collections.mfa.org/internal/media/dispatcher/${image.id}/resize%3Aformat%3Dfull`;
      }
      image.title = $(elem).attr('title');
      image.description = $(elem).attr('alt');
      if (image.url) {
        record.addImage(image);
      }
    });

    // Secondary images
    $('.secondarymedia-item').each((i, elem) => {
      const imageId = $(elem).find('> a').first().attr('data-media-id');
      const imageUrl = `https://collections.mfa.org/internal/media/dispatcher/${imageId}/resize%3Aformat%3Dfull`;
      record.addImage({
        id: imageId,
        url: imageUrl,
      });
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }
}

MfaBostonCrawler.id = 'mfa-boston';

module.exports = MfaBostonCrawler;
