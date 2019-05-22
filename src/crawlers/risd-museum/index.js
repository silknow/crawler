const debug = require('debug')('silknow:crawlers:risd-museum');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('../base');

class RisdMuseumCrawler extends BaseCrawler {
  constructor() {
    super();

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
        await this.downloadRecord(recordNumber, recordUrl);
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
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);
    let response;
    try {
      response = await axios.get(recordUrl);
    } catch (err) {
      return Promise.reject(err);
    }

    const record = {
      id: recordNumber,
      url: recordUrl,
      fields: [],
      publications: [],
      exhibitions: [],
      images: []
    };

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
      return Promise.resolve();
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
          values.push(value);
        });

        record.fields.push({
          label,
          values
        });
      } else {
        const value = $(item)
          .find('.object__info--content')
          .first()
          .text()
          .trim();

        record.fields.push({
          label,
          value
        });
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

          record.fields.push({
            label,
            value
          });
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

          record.fields.push({
            label,
            values
          });
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

    // Use
    record.fields.push({
      label: 'Use',
      value: $('.content__section--use .node__content__section__info')
        .first()
        .text()
        .trim()
    });

    // Feedback
    record.fields.push({
      label: 'Use',
      value: $('.content__section--feedback .node__content__section__info')
        .first()
        .text()
        .trim()
    });

    // Images
    $('.content__section--image .carousel-item').each((i, elem) => {
      const imageUrl = $(elem).attr('data-full-url');

      record.images.push({
        id: '',
        url: new url.URL(imageUrl, 'https://risdmuseum.org/').href
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

RisdMuseumCrawler.id = 'risd-museum';

module.exports = RisdMuseumCrawler;
