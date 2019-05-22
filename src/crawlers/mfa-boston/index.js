const debug = require('debug')('silknow:crawlers:mfa-boston');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const camelCase = require('camelcase');
const cheerio = require('cheerio');
const path = require('path');
const url = require('url');

const BaseCrawler = require('../base');

class MfaBostonCrawler extends BaseCrawler {
  constructor() {
    super();

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'https://www.mfa.org/collections/search?search_api_views_fulltext=&title=&culture=&artist=&creditline=&accession=&provenance=&medium=&sort=search_api_aggregation_4&order=asc&f%5B0%5D=field_checkbox%3A1&f%5B1%5D=field_collections%3A5&f%5B2%5D=field_collections%3A10';
    this.paging.page = 'page';
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);

    if ($('.pager-last').length > 0) {
      this.totalPages = parseInt(
        $('.pager-last')
          .first()
          .text()
          .trim(),
        10
      );
    }

    const records = [];
    $('.view-id-search_objects .views-row > a').each((i, elem) => {
      const recordUrl = $(elem).attr('href');
      const recordNumber = path.basename(url.parse(recordUrl).pathname);
      records.push(recordNumber);
    });

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('.view-id-search_objects .views-row').length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const recordUrl = `https://www.mfa.org/collections/object/${recordNumber}`;
    let response;
    try {
      response = await axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = {
      id: recordNumber,
      url: recordUrl,
      fields: [],
      images: []
    };

    const $ = cheerio.load(response.data);

    // Item details (in first grid)
    const grid = $('.node-object .content .grid-6').first();
    record.fields.push({
      label: 'title',
      value: $(grid)
        .find('h2')
        .first()
        .text()
        .trim()
    });
    record.fields.push({
      label: 'subtitle',
      value: $(grid)
        .find('h2')
        .next('h3')
        .text()
        .trim()
    });
    record.fields.push({
      label: 'teaser',
      value: $(grid)
        .find('h2')
        .nextAll('hr')
        .first()
        .prev('p')
        .text()
        .trim()
    });

    // Description (in second grid)
    record.fields.push({
      label: 'description',
      value: $('.node-object .content .grid-6 .body')
        .first()
        .text()
        .trim()
    });

    // Fields (in both grids)
    $('.node-object .content .grid-6')
      .find('h3, h4')
      .each((i, elem) => {
        const text = $(elem)
          .text()
          .trim();

        const value = $(elem)
          .next('p')
          .text()
          .trim();

        const label = camelCase(text);
        record.fields.push({
          label,
          value
        });
      });

    // Images (in main slider)
    $(
      '.node-object .content .slider .slideshow > .carousel-content .object img'
    ).each((i, elem) => {
      const imageUrl = $(elem).attr('src');
      record.images.push({
        id: '',
        url: imageUrl
      });
    });

    // Download the images
    for (const image of record.images) {
      try {
        await this.downloadFile(image.url);
      } catch (e) {
        debug('Could not download image %s: %s', image.url, e.message);
      }
    }

    // Save the record
    return this.writeRecord(record);
  }
}

MfaBostonCrawler.id = 'mfa-boston';

module.exports = MfaBostonCrawler;
