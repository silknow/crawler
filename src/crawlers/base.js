const debug = require('debug')('silknow:crawlers:base');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const http = require('http');
const https = require('https');
const fs = require('fs');
const filenamify = require('filenamify');
const imageType = require('image-type');
const path = require('path');
const readChunk = require('read-chunk');

const Utils = require('../helpers/utils');
const Record = require('../models/record');

class BaseCrawler {
  constructor(argv) {
    this.argv = argv || {};

    this.currentOffset = 0;
    this.totalPages = 0;
    this.limit = 20;
    this.startPage = 0;
    this.currentPage = null;

    this.request = {
      url: null,
      data: null,
      method: 'get',
      params: {},
    };

    this.paging = {
      page: null,
      offset: null,
      limit: null,
    };

    this.axios = axios.create({
      timeout: 60000,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      maxRedirects: 10,
      maxContentLength: 50 * 1000 * 1000,
    });

    axiosRetry(this.axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay,
      shouldResetTimeout: true,
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.code === 'ECONNABORTED'
        );
      },
    });
  }

  start() {
    this.currentOffset = 0;
    this.currentPage = this.startPage;
    this.totalPages = this.startPage;

    return this.downloadNextPage();
  }

  async downloadNextPage() {
    this.currentPage =
      this.startPage + Math.ceil(this.currentOffset / this.limit);

    debug(
      'Crawling search page %s/%s (offset = %s, limit = %s)',
      this.currentPage,
      this.totalPages,
      this.currentOffset,
      this.limit
    );

    if (this.paging.page) {
      this.request.params[this.paging.page] = this.currentPage;
    }
    if (this.paging.offset) {
      this.request.params[this.paging.offset] = this.currentOffset;
    }
    if (this.paging.limit) {
      this.request.params[this.paging.limit] = this.limit;
    }

    if (this.request.url) {
      debug('Request: %o', this.request);

      let response;
      try {
        response = await this.axios(this.request);
      } catch (err) {
        return Promise.reject(err);
      }

      // Process the search result
      try {
        await this.onSearchResult(response.data);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    if (this.currentPage >= this.totalPages) {
      debug('Done crawling pages (%s/%s)', this.currentPage, this.totalPages);
      return Promise.resolve();
    }

    return this.downloadNextPage();
  }

  // Downloads a file from an URL and returns the file path */
  async downloadFile(fileUrl, fileName, options) {
    options = options || {};

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

    return Utils.downloadFile(fileUrl, filePath, {
      ...options,
      axios: options.axios || this.axios,
    });
  }

  getRecordPath(recordId) {
    if (typeof recordId !== 'string') {
      throw new Error(`Record id: expected string, got ${typeof recordId}`);
    }
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
    if (this.argv.force) return false;
    return fs.existsSync(this.getRecordPath(recordId));
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
    await Utils.createPath(path.dirname(filePath));

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(record), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async downloadRecordImages(record, options) {
    const sanitizedRecordNumber = filenamify(record.getId());
    for (const [index, image] of record.getImages().entries()) {
      image.localFilename = `${sanitizedRecordNumber}_${index}.jpg`;
      try {
        const filePath = await this.downloadFile(
          image.url,
          image.localFilename,
          options
        );
        const fileBuffer = await readChunk(filePath, 0, 12);
        if (imageType(fileBuffer) === null) {
          // Not a valid image
          debug('Could not detect image type for %s', image.url);
          image.hasError = true;
        }
      } catch (e) {
        debug('Could not download image %s: %s', image.url, e.message);
        image.hasError = true;
      }
    }
  }
}

module.exports = BaseCrawler;
