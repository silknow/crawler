const debug = require('debug')('silknow:crawlers:mtmad');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const querystring = require('querystring');
const url = require('url');

const BaseCrawler = require('../base');

class MtmadCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'http://www.mtmad.fr/floracci/jsp/opac/gabarits/list/list_gabarit_bien.jsp';
    this.request.method = 'post';
    this.paging.offset = 'pagination';
    this.limit = 16;
  }

  async start() {
    // Initiate Floracci session by loading the search page and storing the cookies
    let response;
    try {
      response = await axios.get(
        'http://www.mtmad.fr/floracci/jsp/opac/opac_index.jsp?action=opac_search_bien_simple&only_main=true&lang=fre-FR',
        {
          withCredentials: true
        }
      );
    } catch (err) {
      return Promise.reject(err);
    }

    // Store the cookies in a variable
    const cookies = response.headers['set-cookie'].join('; ');

    // Override the request headers with new session cookie
    this.request.headers = this.request.headers || {};
    this.request.headers.cookie = cookies;

    // Generate form data with filters for the search query
    let formData = querystring.stringify({
      INDEX_LIV: 'OPAC_MUS_BIEN_ALL_FIELDS',
      CRIT1: '',
      CRIT2: '',
      CRIT10: '"TEXTILE" ',
      CRIT3: '',
      CRIT12: '',
      CRIT4: '"SOIE~specific,10"',
      CRIT5: '',
      CRIT6: '',
      CRIT7: '',
      CRIT8: '',
      CRIT11: '',
      CRIT9: '',
      query: 'OPAC_EXPERT_BIEN_PERSO',
      source: 'musee',
      sysFormTagHidden: '',
      ActionManagerInit: 'true'
    });
    formData += '&MUSEETMP=MUSEE%DES%TISSUS&MUSEETMP=MUSEE%DES%ARTS%DECORATIFS';

    // Do the search query with selected filters
    try {
      response = await axios.post(
        'http://www.mtmad.fr/floracci/servlet/ActionFlowManager?confirm=action_confirm&forward=action_forward&action=list_gabarit_bien',
        formData,
        {
          headers: this.request.headers,
          withCredentials: true
        }
      );
    } catch (err) {
      return Promise.reject(err);
    }

    // Once we have our session cookie and the search query is done, we can start downloading the results pages
    return super.start();
  }

  async downloadNextPage() {
    const currentPage = Math.ceil(this.currentOffset / this.limit);

    this.request.data = querystring.stringify({
      source: 'musee',
      table: 'MUS_BIEN',
      query: 'OPAC_EXPERT_BIEN_PERSO',
      pagerName: 'search_result',
      page_number: currentPage.toString(),
      sysFormTagHidden: ''
    });

    return super.downloadNextPage();
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);
    const resultsCount = parseInt(
      $('.sp_countContainer .sp_count')
        .first()
        .text()
        .trim(),
      10
    );
    this.totalPages = Math.ceil(resultsCount / this.limit);

    const records = [];
    $('.sp_Vignette.sp_VigMT').each((i, elem) => {
      const idMatch = $(elem)
        .attr('onclick')
        .match(/javascript:sp_GetNotice\('([0-9]+)'/);
      if (idMatch) {
        records.push(idMatch[1]);
      }
    });

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('.sp_Vignette.sp_VigMT').length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber) {
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    const recordUrl = `http://www.mtmad.fr/floracci/jsp/opac/opac_index.jsp?action=view_notice&recordId=musee:MUS_BIEN:${recordNumber}&only_main=true&lang=fre-FR`;
    let response;
    try {
      response = await axios.get(recordUrl, {
        headers: this.request.headers,
        withCredentials: true
      });
    } catch (err) {
      return Promise.reject(err);
    }

    const record = {
      id: recordNumber,
      url: recordUrl,
      fields: [],
      images: []
    };

    const $ = cheerio.load(response.data);

    // Title
    record.fields.push({
      label: 'title',
      value: $('.sp_Titre')
        .first()
        .text()
        .trim()
    });

    // Details
    const details = [];
    $('.sp_Detail .sp_Enum').each((i, elem) => {
      details.push(
        $(elem)
          .text()
          .replace(/\t/g, '') // Remove tabs
          .replace(/\n+/g, ' ') // Remove newlines
          .replace(/\s{2,}/g, ' ') // Remove extra spaces
          .trim()
      );
    });
    record.fields.push({
      label: 'details',
      values: details
    });

    // Description
    // Convert <br> tags into newlines for the description
    $('.sp_Description .sp_Enum')
      .first()
      .find('br')
      .replaceWith('\n');
    record.fields.push({
      label: 'description',
      value: $('.sp_Description .sp_Enum')
        .first()
        .text()
        .trim()
    });

    // Bibliography
    $('.sp_Bibliography .sp_Enum').each((i, elem) => {
      const label = $(elem)
        .find('.sp_CatBib')
        .first()
        .text()
        .trim();

      const value =
        $(elem)
          .children(':not(.sp_CatBib)')
          .text()
          .trim() +
        $(elem)
          .contents()
          .filter((j, node) => node.type === 'text')
          .text()
          .trim();

      record.fields.push({
        label,
        value
      });
    });

    // Images
    $('.sp_InnerImg img').each((i, elem) => {
      const imageUrl = $(elem).attr('src');
      const imageTitle = $(elem).attr('title');
      record.images.push({
        id: '',
        url: imageUrl,
        title: imageTitle
      });
    });

    // Download the images
    for (const image of record.images) {
      try {
        const qs = url.parse(image.url).query;
        const imageId = querystring.parse(qs).idocsId.replace(/:/g, '--');

        await this.downloadFile(image.url, `${imageId}.jpg`);
      } catch (e) {
        debug('Could not download image %s: %s', image.url, e.message);
      }
    }

    // Save the record
    return this.writeRecord(record);
  }
}

MtmadCrawler.id = 'mtmad';

module.exports = MtmadCrawler;
