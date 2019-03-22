const debug = require('debug')('silknow:crawlers:vam');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const fs = require('fs');
const path = require('path');
const url = require('url');

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
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(response.data), err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

VamCrawler.id = 'vam';

module.exports = VamCrawler;
