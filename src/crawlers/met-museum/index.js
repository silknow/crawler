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
      response = await axios.get(`https://www.metmuseum.org${record.url}`);
    } catch (err) {
      return Promise.reject(err);
    }

    const $ = cheerio.load(response.data);

    const fields = [];

    // properties to label-value array
    Object.keys(record).forEach(label => {
      const value = record[label];
      fields.push({ label, value });
      delete record[label];
    });

    // Resolve relative URLs
    fields.forEach(field => {
      switch (field.label) {
        case 'image':
        case 'regularImage':
        case 'largeImage':
          field.value = url.resolve(
            'https://images.metmuseum.org/CRDImages/',
            field.value
          );
          break;
        case 'url':
          field.value = url.resolve('https://www.metmuseum.org/', field.value);
          break;
        default:
          break;
      }
    });

    // Add details fields from the web page
    $('.artwork__tombstone--row').each((i, elem) => {
      const label = $(elem)
        .find('.artwork__tombstone--label')
        .first()
        .text();

      const value = $(elem)
        .find('.artwork__tombstone--value')
        .first()
        .text();

      fields.push({
        label,
        value
      });
    });

    // Image license
    const license = $('.utility-menu__item-link-text')
      .text()
      .trim();
    if (license.length > 0) {
      fields.push({
        label: 'Rights on images',
        value: license
      });
    }

    // Facets
    $('.artwork__facets').each((i, elem) => {
      const label = $(elem)
        .find('label')
        .first()
        .text();

      $(elem)
        .find('a')
        .each((j, link) => {
          const value = $(link).text();
          fields.push({
            label,
            value
          });
        });
    });

    // Provenance
    $('.component__accordions > .accordion').each((i, elem) => {
      if (
        $(elem)
          .find('.accordion__header')
          .first()
          .text()
          .trim() === 'Provenance'
      ) {
        fields.push({
          label: 'provenance',
          value: $(elem)
            .find('.accordion__content')
            .first()
            .text()
            .trim()
        });
      }
    });

    // Related objects
    const relatedObjects = [];
    $('.component__related-objects .card--collection').each((i, elem) => {
      const relatedObjectFields = [];

      // Title and URL
      const $link = $(elem)
        .find('.card__title a')
        .first();
      relatedObjectFields.push({
        label: 'title',
        value: $link.text()
      });
      relatedObjectFields.push({
        label: 'url',
        value: url.resolve('https://www.metmuseum.org/', $link.attr('href'))
      });

      // Image
      const imageSrc = $(elem)
        .find('.card__standard-image img')
        .first()
        .attr('data-src')
        .replace(/\/CRDImages\/(.+)\/(.+)\//, '/CRDImages/$1/web-large/');
      const imageUrl = url.resolve('https://www.metmuseum.org/', imageSrc);
      relatedObjectFields.push({
        label: 'image',
        value: imageUrl
      });

      // Other fields
      $(elem)
        .find('.card__meta-item')
        .each((j, item) => {
          const label = $(item)
            .find('.card__meta-label')
            .first()
            .text();
          const value = $(item)
            .find('.card__meta-data')
            .first()
            .text();
          relatedObjectFields.push({
            label,
            value
          });
        });

      relatedObjects.push({
        fields: relatedObjectFields
      });
    });

    fields.push({
      label: 'Related objects',
      value: relatedObjects
    });

    // Download related objects images
    for (const object of relatedObjects) {
      for (const field of object.fields) {
        if (field.label === 'image') {
          try {
            await this.downloadImage(field.value);
          } catch (e) {
            debug('Could not download image %s: %s', field.value, e.message);
          }
        }
      }
    }

    // Save the record
    record.fields = fields;
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
