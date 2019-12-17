const debug = require('debug')('silknow:crawlers:risd-museum');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('../base');
const Record = require('../record');

class RisdMuseumCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.url =
      'https://risdmuseum.org/art-design/collection?search_api_fulltext=&op=&field_type=64';
    this.paging.page = 'page';
    this.limit = 24;
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result);

    const $lastPage = $('.view-collection .pager__item--last a');
    if ($lastPage.length > 0) {
      const lastPageUrl = url.parse($lastPage.attr('href'), true);
      this.totalPages = lastPageUrl.query.page;
    }

    const records = [];
    $('.view-collection .node--type-collection-object').each((i, elem) => {
      const recordNumber = $(elem).attr('data-history-node-id');
      const recordUrl = url.resolve(
        'https://risdmuseum.org/',
        $(elem).attr('about')
      );
      records.push({
        recordNumber,
        recordUrl
      });
    });

    for (const { recordNumber, recordUrl } of records) {
      try {
        const record = await this.downloadRecord(recordNumber, recordUrl);

        // Download the images
        for (const image of record.getImages()) {
          try {
            await this.downloadFile(image.url);
          } catch (e) {
            debug('Could not download image %s: %s', image.url, e.message);
          }
        }
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $(
      '.view-collection .node--type-collection-object'
    ).length;

    return Promise.resolve();
  }

  async downloadRecord(recordNumber, recordUrl) {
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

    const record = new Record(recordNumber, recordUrl);
    record.publications = [];
    record.exhibitions = [];

    const $ = cheerio.load(response.data);

    // Check if the item is made of silk
    const medium = $('.field--name-field-medium-technique').text();
    if (!medium.toLowerCase().includes('silk')) {
      // Not silk, skip this record
      debug(
        'Skipping record %s because it is not silk (medium: %s)',
        recordNumber,
        medium
      );
      return Promise.resolve(record);
    }

    // Fields
    $('.content__section--description .object__info').each((i, item) => {
      const label = $(item)
        .find('.object__accordion-title, .object__accordion-subtitle')
        .first()
        .text()
        .trim();

      if ($(item).find('.term__list').length > 0) {
        const values = [];
        const terms = $(item).find('.term__item');

        terms.each((j, term) => {
          const value = $(term)
            .find('.objects__link')
            .first()
            .text()
            .trim();
          if (value.length > 0) {
            values.push(value);
          }
        });

        record.addField(label, values);
      } else {
        const value = $(item)
          .find('.object__info--content')
          .first()
          .text()
          .trim();

        record.addField(label, value);
      }
    });

    // Additional fields (Dimensions, Type, Credit, Object Number, ...)
    $('.content__section--description .ckeditor-accordion dt').each((i, dt) => {
      const $dd = $(dt)
        .next('dd')
        .first();
      // Ignore .object__info items, because they're already scrapped above
      if ($dd.find('.object__info').length === 0) {
        const label = $(dt)
          .find('.object__accordion-title')
          .first()
          .text()
          .trim();

        if ($dd.find('.field').length > 0) {
          const value = $dd
            .find('.field')
            .first()
            .text()
            .trim();

          record.addField(label, value);
        } else if ($dd.find('.term__list').length > 0) {
          const values = [];
          const terms = $dd.find('.term__item');

          terms.each((j, term) => {
            const value = $(term)
              .find('.objects__link')
              .first()
              .text()
              .trim();
            values.push(value);
          });

          record.addField(label, values);
        }
      }
    });

    // Publications
    $(
      '.content__section--projects-publications .view-publications article'
    ).each((i, article) => {
      const articleUrl = url.resolve(
        'https://risdmuseum.org/',
        $(article).attr('about')
      );
      const articleTitle = $(article)
        .find('.teaser__title')
        .first()
        .text()
        .trim();
      const articleSubtitle = $(article)
        .find('.field--subtitle')
        .first()
        .text()
        .trim();
      record.publications.push({
        url: articleUrl,
        title: articleTitle,
        subtitle: articleSubtitle
      });
    });

    // Exhibitions
    $('.content__section--exhibition-history .view-exhibitions article').each(
      (i, article) => {
        const articleUrl = url.resolve(
          'https://risdmuseum.org/',
          $(article).attr('about')
        );
        const articleTitle = $(article)
          .find('.teaser__title')
          .first()
          .text()
          .trim();
        const articleDate = $(article)
          .find('.field--date')
          .first()
          .text()
          .trim();
        const articleBlurb = $(article)
          .find('.views-field-field-blurb')
          .first()
          .text()
          .trim();
        record.exhibitions.push({
          url: articleUrl,
          title: articleTitle,
          date: articleDate,
          blurb: articleBlurb
        });
      }
    );

    // Related
    const relatedObjects = [];
    $('.content__section--related-objects .node--type-collection-object').each(
      (i, elem) => {
        const linkUrl = url.resolve(
          'https://risdmuseum.org/',
          $(elem).attr('about')
        );
        const id = $(elem).attr('data-history-node-id');

        relatedObjects.push({
          id,
          url: linkUrl
        });
      }
    );
    record.addField(
      'relatedObjects',
      relatedObjects.map(r => r.id)
    );

    // Use
    record.addField(
      'Use',
      $('.content__section--use .node__content__section__info')
        .first()
        .text()
        .trim()
    );

    // Feedback
    record.addField(
      'Use',
      $('.content__section--feedback .node__content__section__info')
        .first()
        .text()
        .trim()
    );

    // Images
    $('.content__section--image .carousel-item').each((i, elem) => {
      const imageUrl = $(elem).attr('data-full-url');

      record.addImage({
        id: '',
        url: new url.URL(imageUrl, 'https://risdmuseum.org/').href
      });
    });

    // Save the record
    await this.writeRecord(record);

    // Download related objects records
    for (const relatedData of relatedObjects) {
      try {
        const relatedRecord = await this.downloadRecord(
          relatedData.id,
          relatedData.url
        );

        // Download the images
        for (const image of relatedRecord.getImages()) {
          try {
            await this.downloadFile(image.url);
          } catch (e) {
            debug('Could not download image %s: %s', image.url, e.message);
          }
        }
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    return Promise.resolve(record);
  }
}

RisdMuseumCrawler.id = 'risd-museum';

module.exports = RisdMuseumCrawler;
