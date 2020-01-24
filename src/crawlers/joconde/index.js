const debug = require('debug')('silknow:crawlers:joconde');
const url = require('url');

const BaseCrawler = require('../base');
const Record = require('../record');

class JocondeCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.method = 'post';
    this.request.headers = {
      'Content-Type': 'application/x-ndjson'
    };
    this.request.url =
      'https://api.pop.culture.gouv.fr/search/joconde/_msearch';

    this.currentOffset = 0;
    this.limit = 25;
    this.baseQuery = {
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
    };
    this.updateRequestData(this.request);

    this.relatedInvNumbersCache = [];
  }

  updateRequestData(request) {
    request.data = `${JSON.stringify({
      preference: 'res'
    })}\n${JSON.stringify({
      query: this.baseQuery,
      size: this.limit,
      from: this.currentOffset
    })}\n`;
  }

  async downloadRecordsFromResult(result, isRelated) {
    const recordsData = [];

    result.responses[0].hits.hits.forEach(hit => {
      // eslint-disable-next-line no-underscore-dangle
      recordsData.push(hit._source);
    });

    const downloadedRecords = [];
    for (const recordData of recordsData) {
      try {
        const record = await this.downloadRecord(recordData, isRelated);
        if (record) {
          downloadedRecords.push(record);
        }
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    return Promise.resolve(downloadedRecords);
  }

  async onSearchResult(result) {
    const resultsCount = result.responses[0].hits.total;
    this.totalPages = Math.ceil(resultsCount / this.limit);

    await this.downloadRecordsFromResult(result);

    this.currentOffset += result.responses[0].hits.hits.length;

    // Make sure to update the offset in the request parameters
    this.updateRequestData(this.request);

    return Promise.resolve();
  }

  async downloadRelatedRecord(invNumber) {
    const req = { ...this.request };
    req.data = `${JSON.stringify({
      preference: 'res'
    })}\n${JSON.stringify({
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [],
                must_not: [],
                should: [
                  { term: { 'INV.keyword': invNumber } },
                  { wildcard: { 'INV.keyword': `*${invNumber} ;*` } }
                ],
                should_not: []
              }
            }
          ]
        }
      },
      size: 1,
      from: 0
    })}\n`;

    let response;
    try {
      response = await this.axios(req);
    } catch (err) {
      return Promise.reject(err);
    }

    const result = response.data;
    return this.downloadRecordsFromResult(result, true);
  }

  async downloadRecord(recordData, isRelated = false) {
    const recordNumber = recordData.REF;

    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      const record = await this.getRecord(recordNumber);
      return Promise.resolve(record);
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
    await this.downloadRecordImages(record);

    // Download related records (only if current record isn't already a related record)
    if (recordData.HIST && !isRelated) {
      const relatedInvNumbers =
        recordData.HIST.match(/[0-9]+\.[0-9]+\.[0-9]+/g) || [];
      for (const invNumber of relatedInvNumbers) {
        if (!this.relatedInvNumbersCache.includes(invNumber)) {
          debug('Found related record with inventory number %s', invNumber);
          this.relatedInvNumbersCache.push(invNumber);

          const relatedRecords = await this.downloadRelatedRecord(invNumber);
          if (Array.isArray(relatedRecords)) {
            relatedRecords.forEach(r => {
              record.addField('relatedObjects', [r.id]);
            });
          }
        }
      }
    }

    // Save the record
    await this.writeRecord(record);

    return Promise.resolve(record);
  }
}

JocondeCrawler.id = 'joconde';

module.exports = JocondeCrawler;
