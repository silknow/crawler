const debug = require('debug')('silknow:crawlers:les-arts-decoratifs');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class GallicaCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.url =
      'https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&version=1.2&query=%28gallica%20all%20%22%C3%A9chantillon%20tissu%22%29%20and%20%28subgallica%20all%20%22soie%22%29&filter=dc.type%20all%20%22objet%22';
    this.paging.page = 'page';
    this.paging.limit = 'maximumRecords';
    this.limit = 50;
  }

  async onSearchResult(result) {
    const resultsCount = parseInt(
      result.SearchResultsPageFragment.contenu.SearchResultsFragment
        .nombreTotalResultats,
      10
    );
    this.totalPages = Math.ceil(resultsCount / this.limit);

    const items =
      result.SearchResultsPageFragment.contenu.SearchResultsFragment.contenu
        .ResultsFragment.contenu;
    for (const item of items) {
      try {
        await this.downloadRecord(item);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += items.length;

    return Promise.resolve();
  }

  async downloadRecord(recordData) {
    const recordUrl = recordData.thumb.url;
    const recordNumber = url.parse(recordUrl).pathname.substr(1); // eg. ark:/12148/btv1b69361190
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    const record = new Record(recordNumber, recordUrl);

    // Add fields
    Object.entries(recordData).forEach(([key, item]) => {
      const values = [];
      if (typeof item !== 'object') {
        values.push(item);
      } else if (Array.isArray(item)) {
        item.forEach((row) => {
          if (typeof row.contenu === 'string') {
            values.push(row.contenu);
          }
        });
      } else if (typeof item.contenu === 'string') {
        values.push(item.contenu);
      }
      values.forEach((value) => {
        const $value = cheerio.load(value);
        record.addField(key, $value.text().trim());
      });
    });
    recordData.notice.contenu.NoticeFragment.contenu.forEach((row) => {
      const $value = cheerio.load(row.value.contenu);
      record.addField(row.key.contenu, $value.text().trim());
    });

    // Image
    record.addImage({
      id: '',
      url: recordData.thumb.parameters.bigThumb,
    });

    const notice = record.getFieldByLabel('Notice du catalogue');
    if (notice) {
      record.addField('notice.url', notice.value);

      // Download notice
      debug('Downloading notice for record %s', recordNumber);
      const noticeResponse = await this.axios.get(notice.value);
      const notice$ = cheerio.load(noticeResponse.data);

      notice$('.notice').each((i, elem) => {
        const label = notice$(elem).find('.notice-label').text().trim();
        const $span = notice$(elem).find('.notice-label').next('span');
        const $links = $span.find('a:not(.pictos)');
        if ($links.length > 0) {
          $links.each((j, link) => {
            record.addField(`notice.${label}`, notice$(link).text().trim());
          });
        } else {
          record.addField(`notice.${label}`, $span.text().trim());
        }
      });

      const noticeImageUrl = notice$('img.consultationVignetteGrand').attr(
        'src'
      );
      // Check if the notice image isn't the same as the record image
      if (noticeImageUrl && !noticeImageUrl.startsWith(recordUrl)) {
        record.addImage({
          id: '',
          url: noticeImageUrl,
        });
      }

      // Download sample book
      const bookHref = notice$('#appartientA a').attr('href');
      if (bookHref) {
        const bookUrl = url.resolve('https://catalogue.bnf.fr', bookHref);
        record.addField('book.url', bookUrl);

        debug('Downloading sample book for record %s', recordNumber);
        const bookResponse = await this.axios.get(bookUrl);
        const book$ = cheerio.load(bookResponse.data);

        book$('.notice').each((i, elem) => {
          const label = book$(elem).find('.notice-label').text().trim();
          const $span = book$(elem).find('.notice-label').next('span');
          const $links = $span.find('a:not(.pictos)');
          if ($links.length > 0) {
            $links.each((j, link) => {
              record.addField(`book.${label}`, book$(link).text().trim());
            });
          } else {
            record.addField(`book.${label}`, $span.text().trim());
          }
        });

        const bookImageUrl = book$('img.consultationVignetteGrand').attr('src');
        // Check if the notice image isn't the same as the record image
        if (bookImageUrl && !bookImageUrl.startsWith(recordUrl)) {
          record.addImage({
            id: '',
            url: bookImageUrl,
          });
        }
      }
    }

    // Download the images
    await this.downloadRecordImages(record, {
      headers: {
        Accept: '*/*',
      },
    });

    // Save the record
    return this.writeRecord(record);
  }
}

GallicaCrawler.id = 'gallica';

module.exports = GallicaCrawler;
