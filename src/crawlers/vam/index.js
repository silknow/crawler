const debug = require('debug')('silknow:crawlers:vam');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const fs = require('fs');
const path = require('path');

const BaseCrawler = require('../base');
const Utils = require('../../helpers/utils');

class VamCrawler extends BaseCrawler {
  constructor() {
    super();

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

    for (const record of result.records) {
      try {
        await this.downloadRecord(record.fields.object_number);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += result.records.length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    const fileName = `${recordNumber}.json`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      VamCrawler.id,
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
        `https://www.vam.ac.uk/api/json/museumobject/${recordNumber}`
      );
    } catch (err) {
      return Promise.reject(err);
    }

    // Download the images
    for (const image of response.data[0].fields.image_set) {
      const imagePath = image.fields.local;
      try {
        await this.downloadImage(imagePath);
      } catch (e) {
        debug('Could not download image %s: %s', imagePath, e.message);
      }
    }

    // Save the record
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(response.data), err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async downloadImage(imagePath) {
    const url = `http://media.vam.ac.uk/media/thira/${imagePath}`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      VamCrawler.id,
      'files',
      imagePath
    );

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      debug('Skipping existing image %s', url);
      return Promise.resolve();
    }

    debug('Downloading image %s', url);

    return Utils.downloadFile(url, filePath);
  }
}

VamCrawler.id = 'vam';

module.exports = VamCrawler;
