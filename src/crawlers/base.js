const debug = require('debug')('silknow:crawlers:base');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const fs = require('fs');
const filenamify = require('filenamify');
const path = require('path');

const Utils = require('../helpers/utils');
const Record = require('./record');

class BaseCrawler {
  constructor(argv) {
    this.argv = argv;

    this.currentOffset = 0;
    this.totalPages = 0;
    this.limit = 20;

    this.request = {
      url: null,
      data: null,
      method: 'get',
      params: {}
    };

    this.paging = {
      page: null,
      offset: null,
      limit: null
    };

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });
  }

  start() {
    this.currentOffset = 0;

    return this.downloadNextPage();
  }

  async downloadNextPage() {
    const currentPage = Math.ceil(this.currentOffset / this.limit);

    debug(
      'Crawling search page %s/%s (offset = %s, limit = %s)',
      currentPage,
      this.totalPages,
      this.currentOffset,
      this.limit
    );

    if (this.paging.page) {
      this.request.params[this.paging.page] = currentPage;
    }
    if (this.paging.offset) {
      this.request.params[this.paging.offset] = this.currentOffset;
    }
    if (this.paging.limit) {
      this.request.params[this.paging.limit] = this.limit;
    }

    debug('Request: %o', this.request);

    let response;
    try {
      response = await axios(this.request);
    } catch (err) {
      return Promise.reject(err);
    }

    // Process the search result
    try {
      await this.onSearchResult(response.data);
    } catch (err) {
      return Promise.reject(err);
    }

    if (currentPage >= this.totalPages) {
      debug('Done crawling pages (%s/%s)', currentPage, this.totalPages);
      return Promise.resolve();
    }

    return this.downloadNextPage();
  }

  // Downloads a file from an URL and returns the file path */
  async downloadFile(fileUrl, fileName) {
    // Skip if --no-files is set
    if (this.argv.files === false) {
      return Promise.resolve();
    }

    fileName = filenamify(fileName || path.basename(fileUrl));

    const filePath = path.resolve(
      process.cwd(),
      'data',
      this.constructor.id,
      'files',
      fileName
    );

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      debug('Skipping existing file %s', fileUrl);
      return Promise.resolve(filePath);
    }

    debug('Downloading file %s as %s', fileUrl, fileName);

    return Utils.downloadFile(fileUrl, filePath);
  }

  getRecordPath(recordId) {
    const sanitizedRecordId = filenamify(recordId);
    const fileName = `${sanitizedRecordId}.json`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      this.constructor.id,
      'records',
      fileName
    );
    return filePath;
  }

  recordExists(recordId) {
    return !!this.argv.force || fs.existsSync(this.getRecordPath(recordId));
  }

  getRecord(recordId) {
    return new Promise((resolve, reject) => {
      fs.readFile(this.getRecordPath(recordId), 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(new Record(JSON.parse(data)));
      });
    });
  }

  async writeRecord(record, recordName) {
    recordName = recordName || record.id;

    // Skip if --no-records is set
    if (this.argv.records === false) {
      return Promise.resolve();
    }

    const filePath = this.getRecordPath(recordName);

    // Create record directory path
    try {
      await Utils.createPath(path.dirname(filePath));
    } catch (e) {
      return Promise.reject(e);
    }

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(record), err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async downloadRecordImages(record) {
    const sanitizedRecordNumber = filenamify(record.getId());
    for (const [index, image] of record.getImages().entries()) {
      try {
        const localFilename = `${sanitizedRecordNumber}_${index}.jpg`;

        await this.downloadFile(image.url, localFilename);
        image.localFilename = localFilename;
      } catch (e) {
        debug('Could not download image %s: %s', image.url, e.message);
      }
    }
  }
}

module.exports = BaseCrawler;
