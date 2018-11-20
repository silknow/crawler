const debug = require('debug')('silknow:crawlers:mfa-boston');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const camelCase = require('camelcase');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url');

const BaseCrawler = require('../base');
const Utils = require('../../helpers/utils');

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

    this.totalPages = parseInt(
      $('.pager-last')
        .first()
        .text()
        .trim(),
      10
    );

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
    const fileName = `${recordNumber}.json`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      MfaBostonCrawler.id,
      'records',
      fileName
    );

    // check if file already exists
    if (fs.existsSync(filePath)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Create record directory path
    try {
      await Utils.createPath(path.dirname(filePath));
    } catch (e) {
      return Promise.reject(e);
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    let response;
    try {
      response = await axios.get(
        `https://www.mfa.org/collections/object/${recordNumber}`
      );
    } catch (err) {
      return Promise.reject(err);
    }

    const record = {
      fields: {},
      images: []
    };

    const $ = cheerio.load(response.data);

    // Item details (in first grid)
    const grid = $('.node-object .content .grid-6').first();
    record.title = $(grid)
      .find('h2')
      .first()
      .text()
      .trim();
    record.subtitle = $(grid)
      .find('h2')
      .next('h3')
      .text()
      .trim();
    record.teaser = $(grid)
      .find('h2')
      .nextAll('hr')
      .first()
      .prev('p')
      .text()
      .trim();

    // Description (in second grid)
    record.description = $('.node-object .content .grid-6 .body')
      .first()
      .text()
      .trim();

    // Fields (in both grids)
    $('.node-object .content .grid-6')
      .find('h4')
      .each((i, elem) => {
        const label = $(elem)
          .text()
          .trim();

        const value = $(elem)
          .next('p')
          .text()
          .trim();

        const fieldKey = camelCase(label);
        record.fields[fieldKey] = value;
      });

    // Images (in main slider)
    $(
      '.node-object .content .slider .slideshow > .carousel-content .object img'
    ).each((i, elem) => {
      const imageUrl = $(elem).attr('src');
      record.images.push(imageUrl);
    });

    // Download the images
    for (const imageUrl of record.images) {
      try {
        await this.downloadImage(imageUrl);
      } catch (e) {
        debug('Could not download image %s: %s', imageUrl, e.message);
      }
    }

    // Save the record
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(record), err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async downloadImage(imageUrl) {
    const filePath = path.resolve(
      process.cwd(),
      'data',
      MfaBostonCrawler.id,
      'files',
      path.basename(url.parse(imageUrl).pathname)
    );

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      debug('Skipping existing image %s', imageUrl);
      return Promise.resolve();
    }

    debug('Downloading image %s', imageUrl);

    return Utils.downloadFile(imageUrl, filePath);
  }
}

MfaBostonCrawler.id = 'mfa-boston';

module.exports = MfaBostonCrawler;
