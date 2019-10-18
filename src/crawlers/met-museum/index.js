const debug = require('debug')('silknow:crawlers:met-museum');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('../base');
const Record = require('../record');

class MetMuseumCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'https://www.metmuseum.org/api/collection/collectionlisting?artist=&department=12&era=&geolocation=&material=Silk%7CTextiles&pageSize=0&showOnly=withImage&sortBy=AccessionNumber';
    this.paging.offset = 'offset';
    this.paging.limit = 'perPage';
    this.limit = 100;
  }

  async onSearchResult(result) {
    const resultCount = result.totalResults;
    this.totalPages = Math.ceil(resultCount / this.limit);

    for (const recordData of result.results) {
      try {
        const record = await this.downloadRecord(recordData);

        // Download the images
        for (const image of record.getImages()) {
          const imageUrl = url.resolve(
            'https://images.metmuseum.org/CRDImages/',
            image.url
          );
          await this.downloadImage(imageUrl);
        }
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += result.results.length;

    return Promise.resolve();
  }

  async downloadRecord(recordData) {
    const recordUrl = url.resolve(
      'https://www.metmuseum.org/',
      url.parse(recordData.url).pathname
    );

    // Get the actual collection ID (different from the accession number)
    const recordNumber = this.getRecordNumberFromUrl(recordUrl);
    if (!recordNumber) {
      throw new Error(
        `Could not resolve collection ID for record ${recordUrl}`
      );
    }

    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      const record = await this.getRecord(recordNumber);
      return Promise.resolve(record);
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    let response;
    try {
      response = await axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const $ = cheerio.load(response.data);

    const record = new Record(recordNumber, recordUrl);

    // Images
    $('.met-carousel__item__thumbnail').each((i, elem) => {
      const image = {
        id: '',
        url: url.resolve(
          'https://images.metmuseum.org/CRDImages/',
          $(elem).attr('data-superjumboimage')
        ),
        title: $(elem).attr('title'),
        description: $(elem).attr('alt')
      };
      record.addImage(image);
    });

    // Add details fields from the web page
    $('.artwork__tombstone--row').each((i, elem) => {
      const label = $(elem)
        .find('.artwork__tombstone--label')
        .first()
        .text();

      const value = $(elem)
        .find('.artwork__tombstone--value')
        .first()
        .text();

      record.addField(label, value);
    });

    // Title
    record.addField(
      'title',
      $('.artwork__title--text')
        .first()
        .text()
        .trim()
    );

    // Image license
    const $license = $('.artwork__access span a').first();
    if ($license.length > 0) {
      record.addField('imagesRightsLink', $license.attr('href'));
      record.addField('imagesRightsText', $license.text());
    }

    // Facets
    const facets = {};
    $('.artwork__facets').each((i, elem) => {
      const label = $(elem)
        .find('label')
        .first()
        .text();

      $(elem)
        .find('a')
        .each((j, link) => {
          const value = $(link).text();
          if (!facets[label]) {
            facets[label] = [];
          }
          facets[label].push(value);
        });
    });
    Object.keys(facets).forEach(label => {
      const values = facets[label];
      record.addField(label, values);
    });

    // Accordion items
    $('.component__accordions > .accordion').each((i, elem) => {
      const label = $(elem)
        .find('.accordion__header')
        .first()
        .text()
        .trim();
      if ($(elem).find('.link-list').length > 0) {
        const values = [];
        $(elem)
          .find('.link-list a')
          .each((j, link) => {
            values.push(
              `${$(link).attr('href')}|${$(link)
                .text()
                .trim()}`
            );
          });
        record.addField(label, values);
      } else {
        $(elem)
          .find('.accordion__content')
          .first()
          .find('br')
          .replaceWith('\n');
        const value = $(elem)
          .find('.accordion__content')
          .first()
          .text()
          .trim();
        record.addField(label, value);
      }
    });

    // Related objects
    const relatedObjects = [];
    $('.component__related-objects .card--collection').each((i, elem) => {
      // Title and URL
      const $link = $(elem)
        .find('.card__title a')
        .first();
      const linkUrl = url.resolve(
        'https://www.metmuseum.org/',
        $link.attr('href')
      );
      const relatedNumber = this.getRecordNumberFromUrl(linkUrl);
      if (relatedNumber) {
        relatedObjects.push({
          id: relatedNumber,
          url: linkUrl,
          isRelated: true
        });
      }
    });
    record.addField('relatedObjects', relatedObjects.map(r => r.id));

    // Save the record
    await this.writeRecord(record);

    // Download related objects records (only for main records)
    // If the current record is already related to a main one then we don't download its related records
    if (!recordData.isRelated) {
      for (const relatedData of relatedObjects) {
        try {
          const relatedRecord = await this.downloadRecord(relatedData);

          // Download the images
          for (const image of relatedRecord.getImages()) {
            const imageUrl = url.resolve(
              'https://images.metmuseum.org/CRDImages/',
              image.url
            );
            await this.downloadImage(imageUrl);
          }
        } catch (e) {
          debug('Could not download related record:', e);
        }
      }
    }

    return Promise.resolve(record);
  }

  async downloadImage(imageUrl) {
    try {
      await this.downloadFile(imageUrl);
    } catch (e) {
      // Some images with /original/ links return an error 404 Not Found
      // Try again with /web-large/ instead, which returns a slightly
      // smaller image size, but seems to be available more often.
      if (imageUrl.includes('/original/')) {
        try {
          await this.downloadFile(
            imageUrl.replace(/\/original\//, '/web-large/')
          );
        } catch (err) {
          debug('Could not download image %s: %s', imageUrl, e.message);
        }
      }
    }
  }

  getRecordNumberFromUrl(recordUrl) {
    const idMatch = recordUrl.match(/\/collection\/search\/([0-9]+)/);
    return Array.isArray(idMatch) ? idMatch[1] : null;
  }
}

MetMuseumCrawler.id = 'met-museum';

module.exports = MetMuseumCrawler;
