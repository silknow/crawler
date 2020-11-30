const debug = require('debug')('silknow:crawlers:venetian');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

const urlWithoutCentury =
  'http://www.archiviodellacomunicazione.it/sicap/lista/show:list/cosa:tessuto%20seta';

class VenetianCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.params = {
      WEB: 'MuseiVE',
    };
    this.startPage = 1;
    this.limit = 5;

    // Queries must be done century by century (one century at a time)
    this.centuries = ['XV', 'XVI', 'XVII', 'XVIII', 'XIX'];
    this.currentCentury = this.centuries.shift();
    this.updateRequestURL();
  }

  updateRequestURL() {
    this.request.url = `${urlWithoutCentury}/page:${this.currentPage}/quando:${this.currentCentury}`;
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);
    const resultsCount = parseInt(
      $('#List1_LBL_LIST_NRECS')
        .text() // "Schede trovate: 88"
        .replace(/Schede trovate: /, ''), // "88"
      10
    );
    this.totalPages = Math.ceil(resultsCount / this.limit);

    const records = [];
    $('.divLISTDETAIL a').each((i, elem) => {
      const recordNumber = $(elem)
        .attr('href')
        .match(/\/OpereArte\/([0-9]+)\//)[1];
      records.push(recordNumber);
    });

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('.divLISTDETAIL').length;

    if (this.currentPage >= this.totalPages) {
      // Select next century
      this.currentCentury = this.centuries.shift();
      if (typeof this.currentCentury === 'undefined') {
        return Promise.resolve();
      }
      console.log('Next century:', this.currentCentury);

      // Reset pagination
      this.currentPage = this.startPage;
      this.currentOffset = 0;
    }

    this.updateRequestURL();

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const recordUrl = `http://www.archiviodellacomunicazione.it/sicap/OpereArte/${encodeURI(
      recordNumber
    )}/?WEB=MuseiVE`;
    let response;
    try {
      response = await this.axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = new Record(recordNumber, recordUrl);

    const $ = cheerio.load(response.data);

    // Title
    record.addField('title', $('#Detail1_LBL_DETAIL').text().trim());

    // Fields
    $('.TD_DETAIL_DESRIPTION_LVL3').each((i, td) => {
      record.addField(
        $(td).text().trim(),
        $(td)
          .next('.TD_DETAIL_VALUE_LVL3')
          .find('.TD_DETAIL_INT_VALUE, .DETAIL_LBLFLD')
          .text()
          .trim()
      );
    });

    // Images
    $('.TD_DETAIL_SLIDE img').each((i, img) => {
      record.addImage({
        id: '',
        url: url.resolve(recordUrl, $(img).attr('src')),
      });
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }
}

VenetianCrawler.id = 'venetian';

module.exports = VenetianCrawler;
