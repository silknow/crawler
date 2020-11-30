const debug = require('debug')('silknow:crawlers:smithsonian');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class SmithsonianCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.url =
      'https://www.si.edu/search/collection-images?page=1&edan_q=silk%20fabric&edan_fq%5B0%5D=object_type%3A%22Textiles%22&edan_fq%5B1%5D=media_usage%3A%22CC0%22';
    this.paging.page = 'page';
    this.limit = 24;
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);
    const resultsCount = parseInt(
      $('.search-tabs .active-tab span')
        .text() // "(147)"
        .replace(/[()]/, ''), // "147"
      10
    );
    this.totalPages = Math.ceil(resultsCount / this.limit);

    const records = [];
    $('.edan-search-result').each((i, elem) => {
      const recordNumber = $(elem).attr('id');
      records.push(recordNumber);
    });

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('.edan-search-result').length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const recordUrl = url.resolve('https://www.si.edu/object/', recordNumber);
    let response;
    try {
      response = await this.axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = new Record(recordNumber, recordUrl);

    const $ = cheerio.load(response.data);

    // Title
    record.addField(
      'title',
      $('.page-title h1')
        .text()
        .trim()
    );

    // Fields
    $('.recordDetails dl').each((i, dl) => {
      let label = $(dl)
        .find('dt')
        .first()
        .text()
        .trim();
      if (!label.length) {
        label =
          $(dl)
            .attr('class')
            .trim()
            .split(/\s+/)
            .filter(cls => cls.indexOf('field-') === 0)
            .map(cls => cls.substr('field-'.length))
            .shift() || '';
      }
      $(dl)
        .find('dd')
        .each((j, dd) => {
          record.addField(
            label,
            $(dd)
              .text()
              .trim()
          );
        });
    });

    // Images
    $('.edan-media-wrapper .image img').each((i, img) => {
      record.addImage({
        id: '',
        url: $(img).attr('data-src'),
        title: $(img).attr('title'),
        description: $(img).attr('alt')
      });
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }
}

SmithsonianCrawler.id = 'smithsonian';

module.exports = SmithsonianCrawler;
