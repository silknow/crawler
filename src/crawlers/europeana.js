const debug = require('debug')('silknow:crawlers:europeana');
const cheerio = require('cheerio');
const url = require('url');
const querystring = require('querystring');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class EuropeanaCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.paramsList = [
      {
        qf: [
          'collection:fashion',
          'TYPE:"IMAGE"',
          'proxy_dcterms_medium.en:"Material: silk"',
          'YEAR:[1400 TO 1900]',
          'proxy_dc_format.en:"Technique: satin"',
          'proxy_dc_format.en:"Technique: lampas"',
          'proxy_dc_format.en:"Technique: taffeta"',
          'proxy_dc_format.en:"Technique: velvet"',
          'proxy_dc_format.en:"Technique: muslin"',
          'proxy_dc_format.en:"Technique: brocatelle"',
          'proxy_dc_format.en:"Technique: damask (silk)"',
        ],
        query: 1,
        view: 'grid',
      },
      {
        qf: [
          'TYPE:"IMAGE"',
          'proxy_dcterms_medium.en:"Material: silk"',
          'YEAR:[1400 TO 1900]',
        ],
        query: 'fabric',
        view: 'grid',
      },
    ];

    this.request.method = 'get';
    this.request.paramsSerializer = (params) => querystring.stringify(params);
    this.request.url = 'https://www.europeana.eu/en/search';
    this.startPage = 1;
    this.limit = 24;
    this.paging.page = 'page';
  }

  async start() {
    const searchParams = new URLSearchParams();
    const params = this.paramsList.shift();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((val) => {
          searchParams.append(key, val);
        });
      } else {
        searchParams.append(key, value);
      }
    });
    this.request.params = params;
    return super.start();
  }

  async onSearchResult(result) {
    // Re-calculate pagination
    this.currentOffset += this.limit;

    // Europeana has a limit of 1000 first results
    if (this.currentOffset > 1000) {
      return Promise.resolve();
    }

    const records = [];
    const $ = cheerio.load(result);

    $('.content-card .card-link').each((i, link) => {
      const recordUrl = url.resolve(
        'https://www.europeana.eu',
        $(link).attr('href')
      );
      const urlSplit = url.parse(recordUrl).pathname.split('/');
      const recordNumber = `${urlSplit[3]}-${urlSplit[4]}`;
      records.push({ recordUrl, recordNumber });
    });

    for (const recordData of records) {
      await this.downloadRecord(recordData);
    }

    if (records.length === 0) {
      // No more results, update current params and start again from 0
      const params = this.paramsList.shift();
      if (typeof params !== 'undefined') {
        console.log('Switching to params', params);
        this.request.params = params;
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
    record.addField('title', $('.info-panel h1').text().trim());
    record.addField('description', $('.description').text().trim());

    // Add fields
    $('.tab-pane[data-qa="all metadata tab"] .metadata-row').each((i, row) => {
      const label = $(row).find('label').text().trim();
      const values = [];
      $(row)
        .find('li')
        .each((j, li) => {
          values.push($(li).text().trim());
        });
      record.addField(label, values);
    });

    // Images
    const licenseText = $('.item-hero .attribution .license').text().trim();
    $('.item-hero img').each((i, img) => {
      const imageUrl = $(img).parent().attr('href');
      if (imageUrl && !imageUrl.startsWith('data:')) {
        record.addImage({
          url: imageUrl,
          license: licenseText,
        });
      }
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    await this.writeRecord(record);

    return Promise.resolve(record);
  }
}

EuropeanaCrawler.id = 'europeana';

module.exports = EuropeanaCrawler;
