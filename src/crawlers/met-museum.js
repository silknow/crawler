const debug = require('debug')('silknow:crawlers:met-museum');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

function safeUrlResolve(from, to) {
  if (!to) return null;
  return url.resolve(from, to);
}

class MetMuseumCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    if (typeof process.env.MET_MUSEUM_COOKIE === 'undefined') {
      throw new Error(
        'Environment variable MET_MUSEUM_COOKIE must be declared with a valid token. See https://github.com/silknow/crawler#notes-about-met-museum for more details.'
      );
    }

    this.request.url =
      'https://www.metmuseum.org/api/collection/collectionlisting?artist=&department=12&era=&geolocation=&material=Silk%7CTextiles&pageSize=0&showOnly=withImage&sortBy=AccessionNumber';
    this.request.headers = {
      cookie: process.env.MET_MUSEUM_COOKIE,
    };
    this.paging.offset = 'offset';
    this.paging.limit = 'perPage';
    this.limit = 100;
  }

  async onSearchResult(result) {
    const resultCount = result.totalResults;
    this.totalPages = Math.ceil(resultCount / this.limit);

    for (const recordData of result.results) {
      try {
        await this.downloadRecord(recordData);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += result.results.length;

    return Promise.resolve();
  }

  async downloadRecord(recordData) {
    const recordUrl = safeUrlResolve(
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
      response = await this.axios.get(recordUrl, {
        headers: this.request.headers,
      });
    } catch (err) {
      return Promise.reject(err);
    }

    const $ = cheerio.load(response.data);

    const record = new Record(recordNumber, recordUrl);

    // Images
    if ($('.met-carousel__item__thumbnail').length === 0) {
      // No carousel, only a single picture
      // The original image URL is in the download button
      const elem = $('img.artwork__image').first();
      const imageUrl = safeUrlResolve(
        'https://images.metmuseum.org/CRDImages/',
        $(elem).attr('src')
      );
      if (imageUrl) {
        record.addImage({
          id: '',
          url: imageUrl,
          title: $(elem).attr('title'),
          description: $(elem).attr('alt'),
        });
      }
    } else {
      // Carousel, loop through all photo and get the original image URL of each photo
      $('.met-carousel__item__thumbnail').each((i, elem) => {
        const imageUrlAttr =
          $(elem).attr('data-openaccess') === 'False'
            ? 'data-largeimage'
            : 'data-superjumboimage';
        const imageUrl = safeUrlResolve(
          'https://images.metmuseum.org/CRDImages/',
          $(elem).attr(imageUrlAttr)
        );
        if (imageUrl) {
          record.addImage({
            id: '',
            url: imageUrl,
            title: $(elem).attr('title'),
            description: $(elem).attr('alt'),
          });
        } else {
          throw new Error(
            `Could not get data-superjumboimage for ${recordNumber}`
          );
        }
      });
    }

    // Add details fields from the web page
    $('.artwork-tombstone--item').each((i, elem) => {
      const label = $(elem).find('.artwork-tombstone--label').first().text();
      const value = $(elem).find('.artwork-tombstone--value').first().text();
      record.addField(label, value);
    });

    // Title
    record.addField('title', $('.artwork__title--text').first().text().trim());

    // Description
    record.addField(
      'description',
      $('.artwork__intro__desc').first().text().trim()
    );

    // Image license
    const $license = $('.artwork__access span a').first();
    if ($license.length > 0) {
      record.addField('imagesRightsLink', $license.attr('href'));
      record.addField('imagesRightsText', $license.text());
    }

    // Artwork location
    record.addField(
      'galleryInformation',
      $('.artwork__location').first().text().trim()
    );
    record.addField(
      'galleryInformationMessage',
      $('.artwork__location--message').first().text().trim()
    );
    record.addField(
      'galleryInformationGallery',
      $('.artwork__location--gallery').first().text().trim()
    );
    const $galleryInformationLink = $('.artwork__location--gallery a').first();
    if ($galleryInformationLink.length > 0) {
      record.addField(
        'galleryInformationLink',
        $galleryInformationLink.attr('href')
      );
    }

    // Facets
    const facets = {};
    $('.artwork-facet').each((i, elem) => {
      const label = $(elem).find('.artwork-facet__name').first().text();

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
    Object.keys(facets).forEach((label) => {
      const values = facets[label];
      record.addField(label, values);
    });

    // Accordion items
    $('.accordions > .accordion').each((i, elem) => {
      const label = $(elem).find('.accordion__header').first().text().trim();
      if ($(elem).find('.accordion__link-list').length > 0) {
        const values = [];
        $(elem)
          .find('.accordion__link-list a')
          .each((j, link) => {
            values.push(`${$(link).attr('href')}|${$(link).text().trim()}`);
          });
        record.addField(label, values);
      } else {
        $(elem)
          .find('.accordion__content')
          .first()
          .find('br')
          .replaceWith('\n');
        const value = $(elem).find('.accordion__content').first().text().trim();
        record.addField(label, value);
      }
    });

    // Related objects
    const relatedObjects = [];
    $('.related-artwork').each((i, elem) => {
      // Title and URL
      const $link = $(elem).find('.card__title a').first();
      const linkUrl = safeUrlResolve(
        'https://www.metmuseum.org/',
        $link.attr('href')
      );
      const relatedNumber = this.getRecordNumberFromUrl(linkUrl);
      if (relatedNumber) {
        relatedObjects.push({
          id: relatedNumber,
          url: linkUrl,
          isRelated: true,
        });
      }
    });
    record.addField(
      'relatedObjects',
      relatedObjects.map((r) => r.id)
    );

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    await this.writeRecord(record);

    // Download related objects records (only for main records)
    // If the current record is already related to a main one then we don't download its related records
    if (!recordData.isRelated) {
      for (const relatedData of relatedObjects) {
        try {
          await this.downloadRecord(relatedData);
        } catch (e) {
          debug('Could not download related record:', e);
        }
      }
    }

    return Promise.resolve(record);
  }

  getRecordNumberFromUrl(recordUrl) {
    const idMatch = recordUrl.match(/\/collection\/search\/([0-9]+)/);
    return Array.isArray(idMatch) ? idMatch[1] : null;
  }
}

MetMuseumCrawler.id = 'met-museum';

module.exports = MetMuseumCrawler;
