const debug = require('debug')('silknow:crawlers:joconde');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('../base');

class JocondeCrawler extends BaseCrawler {
  constructor() {
    super();

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.method = 'get';
    this.request.responseType = 'arraybuffer';
    this.request.url = 'http://www2.culture.gouv.fr/public/mistral/joconde_fr';
    this.request.params = {
      ACTION: 'RETROUVER_TITLE',
      GRP: 0,
      SPEC: 5,
      SYN: 1,
      IMLY: 'CHECKED',
      MAX1: 1,
      MAX2: 1,
      MAX3: 200,
      REQ:
        "(('TEXTILE') :DOMN  ET  (('SOIE') :TECH  ET  (('RUBAN') :DENO ))) ET ('$FILLED$' :VIDEO)",
      DOM: 'All',
      USRNAME: 'nobody',
      USRPWD: '4%24%2534P'
    };
    this.paging.page = 'GRP';
    this.paging.limit = 'MAX3';
    this.limit = 200;
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result.toString('latin1'));

    const resultsCount = parseInt(
      $('#theme .soustitre')
        .first()
        .text(),
      10
    );
    this.totalPages = Math.ceil(resultsCount / this.limit);

    const recordsData = [];

    $('#theme table[valign="TOP"]').each((i, elem) => {
      let recordNumber = '';

      $(elem)
        .find('tr')
        .each((j, tr) => {
          if (
            $(tr)
              .find('.soustitre')
              .first()
              .text()
              .trim() === "Numéro d'inventaire"
          ) {
            const value = $(tr)
              .find('.resultat')
              .first()
              .text(); // eg. "95.71.72 ; Tg 72 (n° d'étude) ; 95-71-72 T (ancien numéro)"
            recordNumber = value
              .split(';')
              .shift()
              .trim(); // eg. "95.71.72"
          }
        });

      if (recordNumber.length > 0) {
        const recordUrl = url.resolve(
          'http://www2.culture.gouv.fr/',
          $(elem)
            .find('tr:last-child a')
            .last()
            .attr('href')
        );

        recordsData.push({
          id: recordNumber,
          url: recordUrl
        });
      }
    });

    for (const recordData of recordsData) {
      try {
        await this.downloadRecord(recordData.id, recordData.url);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('#theme table[valign="TOP"]').length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber, recordUrl) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    let response;
    try {
      response = await axios.get(recordUrl, {
        responseType: 'arraybuffer'
      });
    } catch (err) {
      return Promise.reject(err);
    }

    const record = {
      id: recordNumber,
      fields: [],
      images: []
    };

    const $ = cheerio.load(response.data.toString('latin1'));

    // Details
    $('#theme table[valign="TOP"] td:not(:first-child) table tr').each(
      (i, elem) => {
        const label = $(elem)
          .find('.soustitre')
          .first()
          .text()
          .trim();

        // Convert <br> tags to '\n'
        $(elem)
          .find('.resultat')
          .first()
          .find('br')
          .replaceWith('\n');

        const value = $(elem)
          .find('.resultat')
          .first()
          .text()
          .trim();

        if (label.length > 0 || value.length > 0) {
          record.fields.push({
            label,
            value
          });
        }
      }
    );

    // Images
    $('#theme table[valign="TOP"] a img').each((i, elem) => {
      const imageUrl = $(elem)
        .parent()
        .attr('href');

      record.images.push({
        id: '',
        url: url.resolve('http://www2.culture.gouv.fr/', imageUrl)
      });
    });

    // Download the images
    for (const image of record.images) {
      try {
        await this.downloadFile(image.url);
      } catch (e) {
        debug('Could not download image %s: %s', image.url, e.message);
      }
    }

    // Save the record
    return this.writeRecord(record);
  }
}

JocondeCrawler.id = 'joconde';

module.exports = JocondeCrawler;
