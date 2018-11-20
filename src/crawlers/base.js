const debug = require('debug')('silknow:crawlers:base');
const axios = require('axios');
const axiosRetry = require('axios-retry');

class BaseCrawler {
  constructor() {
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
}

module.exports = BaseCrawler;
