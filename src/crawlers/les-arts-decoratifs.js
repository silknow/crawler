const debug = require('debug')('silknow:crawlers:les-arts-decoratifs');
const cheerio = require('cheerio');
const path = require('path');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class LesArtsDecoratifsCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.url =
      'http://collections.madparis.fr/textile?f[0]=field_hasmainmedia%3AAvec%20image%28s%29';
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
      const recordUrl = $(elem).find('a.selection-add').first().attr('href');
      if (recordUrl) {
        const recordNumber = path.basename(url.parse(recordUrl).pathname);
        records.push(recordNumber);
      }
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
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const recordUrl = `http://collections.lesartsdecoratifs.fr/print/${recordNumber}`;
    let response;
    try {
      response = await this.axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = new Record(recordNumber, recordUrl);

    const $ = cheerio.load(response.data);

    // Fields
    $('.content .field').each((i, elem) => {
      const fieldType =
        $(elem)
          .attr('class')
          .trim()
          .split(/\s+/)
          .filter((cls) => cls.indexOf('field-name-') === 0)
          .map((cls) => cls.substr('field-name-'.length))
          .shift() || null;

      const fieldLabel = $(elem).find('.field-label').first().text().trim();

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
                record.addImage({
                  id: '',
                  url: imageUrl,
                });
                fieldItems.push(imageUrl);
              });
          }

          if (fieldItems.length === 0) {
            // Replace <br> with newlines
            $(item).find('br').replaceWith('\n');
            fieldItems.push($(item).text());
          }
        })
        .get();

      record.addField(fieldLabel || fieldType || '', fieldItems);
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }
}

LesArtsDecoratifsCrawler.id = 'les-arts-decoratifs';

module.exports = LesArtsDecoratifsCrawler;
