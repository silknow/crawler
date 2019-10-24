const debug = require('debug')('silknow:crawlers:joconde');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const url = require('url');

const BaseCrawler = require('../base');
const Record = require('../record');

class JocondeCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    axiosRetry(axios, {
      retries: 10,
      retryDelay: axiosRetry.exponentialDelay
    });

    this.request.method = 'post';
    this.request.headers = {
      'Content-Type': 'application/x-ndjson'
    };
    this.request.url =
      'https://api.pop.culture.gouv.fr/search/joconde/_msearch';

    this.currentOffset = 0;
    this.limit = 25;
    this.updateRequestData();
  }

  updateRequestData() {
    this.request.data = `${JSON.stringify({
      preference: 'res'
    })}\n${JSON.stringify({
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [
                  { wildcard: { 'DOMN.keyword': '*textile*' } },
                  { wildcard: { 'TECH.keyword': '*soie*' } },
                  { wildcard: { 'DENO.keyword': '*ruban*' } },
                  { term: { 'CONTIENT_IMAGE.keyword': 'oui' } }
                ],
                must_not: [],
                should: [],
                should_not: []
              }
            }
          ]
        }
      },
      size: this.limit,
      from: this.currentOffset
    })}\n`;
  }

  async onSearchResult(result) {
    const resultsCount = result.responses[0].hits.total;
    this.totalPages = Math.ceil(resultsCount / this.limit);

    const recordsData = [];

    result.responses[0].hits.hits.forEach(hit => {
      // eslint-disable-next-line no-underscore-dangle
      recordsData.push(hit._source);
    });

    for (const recordData of recordsData) {
      try {
        await this.downloadRecord(recordData);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += result.responses[0].hits.hits.length;

    // Make sure to update the offset in the request parameters
    this.updateRequestData();

    return Promise.resolve();
  }

  async downloadRecord(recordData) {
    const recordNumber = recordData.REF;

    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    const recordUrl = url.resolve(
      'https://www.pop.culture.gouv.fr/notice/joconde/',
      recordData.REF
    );

    const record = new Record(recordNumber, recordUrl);

    // Add properties as fields
    Object.keys(recordData).forEach(key => {
      const value = recordData[key];
      if (typeof value !== 'object') {
        record.addField(key, recordData[key]);
      } else if (Array.isArray(value)) {
        value.forEach(subValue => {
          if (typeof subValue !== 'object') {
            record.addField(key, [subValue]);
          }
        });
      }
    });

    // Add geolocation property as a field
    if (recordData.POP_COORDONNEES) {
      const { lat, lon } = recordData.POP_COORDONNEES;
      if (lat && lon) {
        record.addField('POP_COORDONNEES', [lon, lat]);
      }
    }

    // Images
    recordData.IMG.forEach(imageUrlPart => {
      record.addImage({
        id: '',
        url: url.resolve(
          'https://s3.eu-west-3.amazonaws.com/pop-phototeque/',
          imageUrlPart
        )
      });
    });

    // Download the images
    for (const image of record.getImages()) {
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
