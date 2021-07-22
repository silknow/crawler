const debug = require('debug')('silknow:crawlers:louvre');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class LouvreCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.url =
      'https://collections.louvre.fr/recherche?datingStartYear=1400&datingEndYear=1900&collection%5B0%5D=5&typology%5B0%5D=5&material%5B0%5D=soie';
    this.request.method = 'get';
    this.paging.page = 'page';
    this.paging.limit = 'limit';
    this.limit = 100;
    this.startPage = 1;
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);

    // Re-calculate pagination
    this.currentOffset += this.limit;
    if ($('.pagination__total.nav__pagination__nbr').length > 0) {
      this.totalPages = parseInt(
        $('.pagination__total.nav__pagination__nbr').text().trim(),
        10
      );
    }

    const records = [];
    $('.search__list .card--search.card__link').each((i, link) => {
      const recordUrl = url.resolve(
        'https://collections.louvre.fr',
        $(link).attr('href')
      );
      const urlSplit = url.parse(recordUrl).pathname.split('/');
      const recordNumber = urlSplit[urlSplit.length - 1];
      records.push({ recordUrl, recordNumber });
    });

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    return Promise.resolve();
  }

  async downloadRecord({ recordUrl, recordNumber }) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      const record = await this.getRecord(recordNumber);
      return Promise.resolve(record);
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const response = await this.axios.get(recordUrl, {
      headers: this.request.headers,
    });

    const $ = cheerio.load(response.data);

    const record = new Record(recordNumber, recordUrl);

    // Add fields
    record.addField('title', this.parseText($('.notice__title.h_1').text()));
    record.addField('date', this.parseText($('.notice__date').text()));
    record.addField('author', this.parseText($('.notice__author').text()));
    record.addField('mnr', this.parseText($('.notice__mnr').text()));
    record.addField('place', this.parseText($('.notice__place ').text()));

    let isCarouselText = false;
    $('.notice__fullcartel__group').each((i, row) => {
      let label = $(row).find('.part__label').text().trim();
      if (label.length === 0) {
        label = $(row)
          .parents('.notice__fullcartel__part--closing')
          .find('.part__title')
          .text()
          .trim();
        isCarouselText = true;
      }
      if (label.length === 0) return;

      const values = [];
      $(row)
        .find('.part__content a')
        .each((j, a) => {
          values.push(...this.parseText($(a).text()));
        });

      $(row)
        .find('.part__content')
        .contents()
        .each((j, elem) => {
          let text = null;
          if (elem.type === 'text') {
            text = elem.data;
          } else if (isCarouselText) {
            text = $(elem).text();
          }
          if (text !== null) {
            values.push(...this.parseText(text).filter((x) => x !== '-'));
          }
        });

      record.addField(label, values);
    });

    // Images
    $('.notice__medias__outer picture img').each((i, img) => {
      const imageUrl = $(img).attr('data-full-src');
      const caption = $(img).attr('data-caption');

      const image = {
        url: imageUrl,
      };
      if (caption.includes('©')) {
        image.license = caption;
      } else {
        image.text = caption;
      }

      record.addImage(image);
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    await this.writeRecord(record);

    return Promise.resolve(record);
  }

  parseText(text) {
    return text
      .split(/\n/g)
      .map((x) => x.trim())
      .filter((x) => x);
  }
}

LouvreCrawler.id = 'louvre';

module.exports = LouvreCrawler;
