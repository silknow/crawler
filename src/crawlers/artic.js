const debug = require('debug')('silknow:crawlers:artic');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class ArticCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.placesList = ['France', 'Italy', 'Spain', 'England'];

    this.request.method = 'get';
    this.request.url = 'https://www.artic.edu/collection';
    this.request.params = {
      department_ids: 'Textiles',
      material_ids: 'silk (fiber)',
      is_public_domain: '1',
      'date-start': '1400',
      'date-end': '1900',
      classification_ids: 'weaving;textile',
    };
    this.startPage = 1;
    this.limit = 54;
    this.paging.page = 'page';
  }

  async start() {
    this.request.params.place_ids = this.placesList.shift();
    return super.start();
  }

  async onSearchResult(result) {
    // Re-calculate pagination
    this.currentOffset += this.limit;

    const records = [];
    const $ = cheerio.load(result);

    $('#artworksList .m-listing .m-listing__link').each((i, link) => {
      // e.g., https://www.artic.edu/artworks/463/the-petitions-right-part
      const recordUrl = $(link).attr('href');
      const recordNumber = url.parse(recordUrl).pathname.split('/')[2];
      records.push({ recordUrl, recordNumber });
    });

    for (const recordData of records) {
      await this.downloadRecord(recordData);
    }

    if (records.length === 0) {
      // No more results, update current place and start again from 0
      const place = this.placesList.shift();
      if (typeof place !== 'undefined') {
        console.log('Switching to place', place);
        this.request.params.place_ids = place;
        this.currentOffset = 0;
        this.currentPage = this.startPage;
        this.totalPages = this.startPage + 1;
      }
    } else {
      // We do not know how many pages there are, so we just increment it
      this.totalPages += 1;
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

    // Add title
    record.addField('title', $('.f-headline-editorial').text().trim());

    // Add description
    $('.title.f-secondary').each((i, elem) => {
      record.addField('description', $(elem).text().trim());
    });

    // Add fields
    $('.deflist').each((i, dl) => {
      $(dl)
        .find('dd')
        .each((j, dd) => {
          const $dt = $(dd).prev('dt');
          const $span = $dt.find('span').first();
          let label;
          if ($span.length) {
            label = $span.text().trim();
          } else {
            label = $dt.text().trim();
          }
          record.addField(label, $(dd).text().trim());
        });
    });

    // Publication History
    const $publicationHistory = $('#panel_publication-history').first();
    if ($publicationHistory.length) {
      const publicationList = [];
      if ($publicationHistory.find('li').length > 0) {
        $publicationHistory.find('li').each((i, elem) => {
          publicationList.push($(elem).text().trim());
        });
      } else {
        publicationList.push($publicationHistory.text().trim());
      }
      record.addField('publication-history', publicationList);
    }

    // Exhibition History
    const $exhibitionHistory = $('#panel_exhibition-history').first();
    if ($exhibitionHistory.length) {
      const exhibitionList = [];
      if ($exhibitionHistory.find('li').length > 0) {
        $exhibitionHistory.find('li').each((i, elem) => {
          exhibitionList.push($(elem).text().trim());
        });
      } else {
        exhibitionList.push($exhibitionHistory.text().trim());
      }
      record.addField('exhibition-history', exhibitionList);
    }

    // Images
    const licenseText = $('.m-article-header__img-credit').text().trim();
    $('.m-article-header__img img').each((i, img) => {
      const imageUrl = $(img).attr('data-pin-media');
      record.addImage({
        url: imageUrl,
        license: licenseText,
      });
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    await this.writeRecord(record);

    return Promise.resolve(record);
  }
}

ArticCrawler.id = 'artic';

module.exports = ArticCrawler;
