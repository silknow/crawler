const debug = require('debug')('silknow:crawlers:imatex');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const url = require('url');

const BaseCrawler = require('../base');
const Utils = require('../../helpers/utils');

const IMATEX_SEARCH = 'http://imatex.cdmt.cat/_cat/CercaAvancada.aspx';

class ImatexCrawler extends BaseCrawler {
  constructor() {
    super();

    this.languages = ['ca', 'es', 'en'];
    this.classifications = ['peces tèxtils', 'tejidos', 'textiles pieces'];
    this.materials = ['seda', 'seda', 'silk'];

    // Select language
    if (this.languages.includes(process.argv[3])) {
      // eslint-disable-next-line prefer-destructuring
      this.selectedLanguage = process.argv[3];
    } else {
      this.selectedLanguage = 'en';
    }
    debug('Language:', this.selectedLanguage);

    // Configure request
    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url = 'http://imatex.cdmt.cat/_cat/ajax_accio.aspx';
    this.request.method = 'post';
    this.limit = 16;
  }

  async start() {
    const langIndex = this.languages.indexOf(this.selectedLanguage);

    // Initialize search with selected language
    // This GET request is important to:
    //   1. set the initial cookie with the right language;
    //   2. extract the __VIEWSTATE and __EVENTVALIDATION keys.
    // Doing just a POST request with form data won't correctly set the langauge
    let response;
    try {
      // idioma = language (1 = Catalan, 2 = Spanish, 3 = English)
      response = await axios.get(`${IMATEX_SEARCH}?idioma=${langIndex + 1}`);
    } catch (err) {
      return Promise.reject(err);
    }

    const [viewState, eventValidation] = ImatexCrawler.extractKeys(
      response.data
    );

    // Generate form data with filters for the search query
    let formData = querystring.stringify({
      tr$entorn$t_idioma: '',
      tr$entorn$auxiliar: '',
      tr$entorn$cercar: '',
      tr$entorn$rapida: '',
      tr$entorn$num_reg: '',
      tr$entorn$Avanc_ClasGene: this.classifications[langIndex],
      tr$entorn$Avanc_Denom: '',
      tr$entorn$Avanc_Disseny: '',
      tr$entorn$Avanc_Fabric: '',
      tr$entorn$Avanc_Autor: '',
      tr$entorn$Avanc_Crono: '',
      tr$entorn$Avanc_Dec: '',
      tr$entorn$Avanc_Dest: '',
      tr$entorn$Avanc_Estil: '',
      tr$entorn$Avanc_Mat: this.materials[langIndex],
      tr$entorn$Avanc_Tec: '',
      tr$entorn$Avanc_Org: '',
      __VIEWSTATE: viewState,
      __EVENTVALIDATION: eventValidation
    });
    formData = formData.replace(/%20/g, '+');

    // Store the cookies in a variable
    const cookies = response.headers['set-cookie'].join('; ');

    // Override the request headers with new session cookie
    this.request.headers = this.request.headers || {};
    this.request.headers.cookie = cookies;

    // Do the search query with selected filters
    try {
      let uri = IMATEX_SEARCH;
      // idioma = language (1 = Catlan, 2 = Spanish, 3 = English)
      if (langIndex) {
        // workaround: spanish and english need the `idioma` param,
        // while catalan refuses it!
        uri += `?idioma=${langIndex + 1}`;
      }

      response = await axios.post(uri, formData, {
        headers: this.request.headers,
        withCredentials: true
      });
    } catch (err) {
      return Promise.reject(err);
    }

    // Get number of total pages
    const totalPagesMatches = response.data.match('var numPagines = ([0-9]+);');
    this.totalPages = parseInt(totalPagesMatches[1], 10);

    // Once we have our session cookie and the search query is done, we can start downloading the results pages
    return super.start();
  }

  static extractKeys(data) {
    const $ = cheerio.load(data);
    return [$('#__VIEWSTATE').val(), $('#__EVENTVALIDATION').val()];
  }

  async downloadNextPage() {
    const currentPage = Math.ceil(this.currentOffset / this.limit);

    this.request.data = querystring.stringify({
      accio: 'cercaFitxesFotos',
      valor: currentPage + 1,
      t: new Date().getMilliseconds()
    });

    return super.downloadNextPage();
  }

  async onSearchResult(result) {
    const records = [];

    const dades = result.split('|');
    for (let i = 1; i < dades.length - 1; i += 1) {
      const fitxa = dades[i].split('><');
      records.push(fitxa[0]);
    }

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += dades.length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    const fileName = `${recordNumber}_${this.selectedLanguage}.json`;
    const filePath = path.resolve(
      process.cwd(),
      'data',
      ImatexCrawler.id,
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
        `http://imatex.cdmt.cat/_cat/fitxa_fitxa.aspx?m=n&num_id=${recordNumber}&t=${new Date().getMilliseconds()}`,
        {
          headers: this.request.headers,
          withCredentials: true
        }
      );
    } catch (err) {
      return Promise.reject(err);
    }

    const record = {
      fields: [],
      bibliographies: [],
      expositions: [],
      otherPieces: [],
      images: []
    };

    const $ = cheerio.load(response.data);

    // Details
    $('#tr_entorn_taulaFitxa .etiqueta').each((i, elem) => {
      const label = $(elem)
        .text()
        .trim();

      const value = $(elem)
        .next('td')
        .text()
        .trim();

      record.fields.push({
        label,
        value
      });
    });

    // Bibliographies
    $('#tr_entorn_taulaBiblio tr:not(.titols) td').each((i, td) => {
      const value = $(td)
        .text()
        .trim();
      if (value.length > 0) {
        record.bibliographies.push(value);
      }
    });

    // Expositions
    $('#tr_entorn_taulaExpos tr:not(.titols) td').each((i, td) => {
      const value = $(td)
        .text()
        .trim();
      if (value.length > 0) {
        record.expositions.push(value);
      }
    });

    // Other pieces
    $('#tr_entorn_taulaFitxes tr:not(.titols)').each((i, tr) => {
      const $tds = $(tr).children('td');

      const $image = $tds
        .eq(0)
        .find('img')
        .first();
      const imageId = $image
        .attr('id')
        .split('_')
        .pop()
        .padStart(10, '0');
      const imageUrl = $image.attr('src').trim();

      const registerNumber = $tds
        .eq(1)
        .text()
        .trim();

      const dimensions = $tds
        .eq(2)
        .text()
        .trim();

      record.otherPieces.push({
        image: {
          id: imageId,
          url: new url.URL(imageUrl, 'http://imatex.cdmt.cat/_cat/').href
        },
        registerNumber,
        dimensions
      });
    });

    // Images
    $('#tr_entorn_taulaFotos tr').each((i, tr) => {
      if ($(tr).find('.etiqueta').length === 0) {
        return;
      }

      const imageId = $(tr)
        .find('.etiqueta img')
        .first()
        .attr('id')
        .split('_')
        .pop()
        .padStart(10, '0');

      const imageUrl = $(tr)
        .find('.etiqueta img')
        .first()
        .attr('data-original')
        .trim();

      if (imageUrl.length > 0) {
        record.images.push({
          id: imageId,
          url: new url.URL(imageUrl, 'http://imatex.cdmt.cat/_cat/').href
        });
      }
    });

    // Download the images
    for (const image of record.images) {
      try {
        await this.downloadImage(image.url, `${image.id}.jpg`);
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

  async downloadImage(imageUrl, fileName) {
    const filePath = path.resolve(
      process.cwd(),
      'data',
      ImatexCrawler.id,
      'files',
      fileName
    );

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      debug('Skipping existing image %s', imageUrl);
      return Promise.resolve();
    }

    debug('Downloading image %s', imageUrl);

    return Utils.downloadFile(imageUrl, filePath, {
      headers: this.request.headers
    });
  }
}

ImatexCrawler.id = 'imatex';

module.exports = ImatexCrawler;
