const debug = require('debug')('silknow:crawlers:les-arts-decoratifs');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url');

const BaseCrawler = require('../base');
const Utils = require('../../helpers/utils');

class LesArtsDecoratifsCrawler extends BaseCrawler {
  constructor() {
    super();

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'http://collections.lesartsdecoratifs.fr/textile?f[0]=field_hasmainmedia%3AAvec%20image%28s%29';
    this.paging.page = 'page';
    this.paging.limit = 'items_per_page';
    this.limit = 60;
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);
    const resultsCount = parseInt($('#nbr_results').text(), 10);
    this.totalPages = Math.ceil(resultsCount / this.limit);

    const records = [];
    $('.view-id-ensembles_childs_search > .view-content td').each((i, elem) => {
      const recordUrl = $(elem)
        .find('a.selection-add')
        .first()
        .attr('href');
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

    this.currentOffset += $(
      '.view-id-ensembles_childs_search > .view-content td'
    ).length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    const fileName = `${recordNumber}.json`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      LesArtsDecoratifsCrawler.id,
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
        `http://collections.lesartsdecoratifs.fr/print/${recordNumber}`
      );
    } catch (err) {
      return Promise.reject(err);
    }

    const recordData = [];
    const images = [];

    const $ = cheerio.load(response.data);

    $('.content .field').each((i, elem) => {
      const fieldType =
        $(elem)
          .attr('class')
          .trim()
          .split(/\s+/)
          .filter(cls => cls.indexOf('field-name-') === 0)
          .map(cls => cls.substr('field-name-'.length))
          .shift() || null;

      const fieldLabel = $(elem)
        .find('.field-label')
        .first()
        .text();

      const fieldItems = [];
      $(elem)
        .find('.field-item')
        .each((j, item) => {
          if ($(item).children('a').length > 0) {
            $(item)
              .children('a')
              .each((k, link) => {
                fieldItems.push($(link).text());
              });
          }

          if ($(item).children('img').length > 0) {
            $(item)
              .children('img')
              .each((k, img) => {
                const imageUrl = $(img).attr('src');
                images.push(imageUrl);
                fieldItems.push(imageUrl);
              });
          }

          if (fieldItems.length === 0) {
            fieldItems.push($(item).text());
          }
        })
        .get();

      recordData.push({
        type: fieldType,
        label: fieldLabel.length > 0 ? fieldLabel : undefined,
        items: fieldItems
      });
    });

    // Download the images
    for (const imageUrl of images) {
      try {
        await this.downloadImage(imageUrl);
      } catch (e) {
        debug('Could not download image %s: %s', imageUrl, e.message);
      }
    }

    // Save the record
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(recordData), err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async downloadImage(imageUrl) {
    const filePath = path.resolve(
      process.cwd(),
      'data',
      LesArtsDecoratifsCrawler.id,
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

LesArtsDecoratifsCrawler.id = 'les-arts-decoratifs';

module.exports = LesArtsDecoratifsCrawler;
