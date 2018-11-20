const debug = require('debug')('silknow:crawlers:risd-museum');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const url = require('url');

const BaseCrawler = require('../base');
const Utils = require('../../helpers/utils');

class RisdMuseumCrawler extends BaseCrawler {
  constructor() {
    super();

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'https://risdmuseum.org/art_design/objects/tags/medium/silk';
    this.paging.offset = 'first';
    this.limit = 99;
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);

    if ($('.paginator .show_more').length > 0) {
      this.totalPages += 1;
    }

    const records = [];
    $('.search-result .search-result-info').each((i, elem) => {
      const recordUrl = $(elem).attr('data-href');
      const recordNumber = parseInt(
        path.basename(url.parse(recordUrl).pathname),
        10
      );
      records.push(recordNumber);
    });

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('.search-result').length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    const fileName = `${recordNumber}.json`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      RisdMuseumCrawler.id,
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
        `https://risdmuseum.org/art_design/objects/${recordNumber}`
      );
    } catch (err) {
      return Promise.reject(err);
    }

    const record = {
      fields: [],
      exhibitions: [],
      publications: [],
      images: []
    };

    const $ = cheerio.load(response.data);

    // Item details
    record.view = $('.content-object .view').length > 0;
    record.title = $('.content-object .title')
      .first()
      .text()
      .trim();
    record.tombstone = $('.content-object .tombstone')
      .first()
      .text()
      .trim();

    // Fields
    $('.content-object .sidebar .sidebar-block h1').each((i, h1) => {
      const label = $(h1)
        .text()
        .trim();
      const values = [];

      $(h1)
        .next('.object-details')
        .find('a')
        .each((j, a) => {
          values.push(
            $(a)
              .text()
              .trim()
          );
        });

      record.fields.push({
        label,
        values
      });
    });

    $('.content-object .related-exhibition-item').each((i, item) => {
      const itemTitle = $(item)
        .find('.related-exhibition-item-title')
        .first()
        .text()
        .trim();
      const itemDate = $(item)
        .find('.related-exhibition-item-date')
        .first()
        .text()
        .trim();
      const itemText = $(item)
        .find('.related-exhibition-item-text')
        .first()
        .text()
        .trim();

      record.exhibitions.push({
        title: itemTitle,
        date: itemDate,
        text: itemText
      });
    });

    $('.content-object .related-publication-item').each((i, item) => {
      const itemTitle = $(item)
        .find('.related-publication-item-title')
        .first()
        .text()
        .trim();
      const itemSubtitle = $(item)
        .find('.related-publication-item-subtitle')
        .first()
        .text()
        .trim();
      const itemText = $(item)
        .find('.related-publication-item-text')
        .first()
        .text()
        .trim();
      const itemImage = $(item)
        .find('.related-publication-item-image img')
        .first()
        .attr('src');
      const itemDetails = [];

      $(item)
        .find('.related-publication-item-details h2')
        .each((j, h2) => {
          const label = $(h2)
            .text()
            .trim();
          const value = $(h2)
            .next('span')
            .text()
            .trim();
          itemDetails.push({
            label,
            value
          });
        });

      record.publications.push({
        title: itemTitle,
        subtitle: itemSubtitle,
        text: itemText,
        image: new url.URL(itemImage, 'https://risdmuseum.org/').href,
        details: itemDetails
      });
    });

    // Images
    $('#slideshow img').each((i, elem) => {
      const imageUrl = $(elem).attr('data-src');
      const imageCaption = $(elem).attr('data-caption');

      record.images.push({
        url: new url.URL(imageUrl, 'https://risdmuseum.org/').href,
        caption: imageCaption
      });
    });

    // Download the images
    for (const image of record.images) {
      try {
        await this.downloadImage(image.url);
      } catch (e) {
        debug('Could not download image %s: %s', image.url, e.message);
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
      RisdMuseumCrawler.id,
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

RisdMuseumCrawler.id = 'risd-museum';

module.exports = RisdMuseumCrawler;
