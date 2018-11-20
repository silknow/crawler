const debug = require('debug')('silknow:crawlers:met-museum');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url');

const BaseCrawler = require('../base');
const Utils = require('../../helpers/utils');

class MetMuseumCrawler extends BaseCrawler {
  constructor() {
    super();

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'https://www.metmuseum.org/api/collection/collectionlisting?artist=&department=12&era=&geolocation=&material=Silk%7CTextiles&pageSize=0&showOnly=withImage&sortBy=AccessionNumber';
    this.paging.offset = 'offset';
    this.paging.limit = 'perPage';
    this.limit = 100;
  }

  async onSearchResult(result) {
    const resultCount = result.totalResults;
    this.totalPages = Math.ceil(resultCount / this.limit);

    for (const record of result.results) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }

      // Download the images
      const imageUrl = record.largeImage
        ? `https://images.metmuseum.org/CRDImages/${record.largeImage}`
        : record.image;
      if (imageUrl) {
        try {
          await this.downloadImage(imageUrl);
        } catch (e) {
          debug('Could not download image %s: %s', imageUrl, e.message);
        }
      }
    }

    this.currentOffset += result.results.length;

    return Promise.resolve();
  }

  async downloadRecord(record) {
    const recordNumber = record.accessionNumber;
    const fileName = `${recordNumber}.json`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      MetMuseumCrawler.id,
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
      response = await axios.get(`https://www.metmuseum.org/${record.url}`);
    } catch (err) {
      return Promise.reject(err);
    }

    const $ = cheerio.load(response.data);

    // Details items
    const items = [];
    $('.artwork__tombstone--row').each((i, elem) => {
      const label = $(elem)
        .find('.artwork__tombstone--label')
        .first()
        .text();

      const value = $(elem)
        .find('.artwork__tombstone--value')
        .first()
        .text();

      items.push({
        label,
        value
      });
    });
    record.items = items;

    // Provenance
    $('.component__accordions > .accordion').each((i, elem) => {
      if (
        $(elem)
          .find('.accordion__header')
          .first()
          .text()
          .trim() === 'Provenance'
      ) {
        record.provenance = $(elem)
          .find('.accordion__content')
          .first()
          .text()
          .trim();
      }
    });

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
      MetMuseumCrawler.id,
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

MetMuseumCrawler.id = 'met-museum';

module.exports = MetMuseumCrawler;
