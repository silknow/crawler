const debug = require('debug')('silknow:crawlers:paris-musees');

const BaseCrawler = require('./base');
const Record = require('../models/record');

const flattenObject = (ob) => {
  const finalObj = {};

  // Flatten non-array fields
  Object.keys(ob).forEach((k) => {
    if (Array.isArray(ob[k]) || ob[k] === null) {
      return;
    }
    if (typeof ob[k] === 'object' && ob[k] !== null && !Array.isArray(ob[k])) {
      const flatObject = flattenObject(ob[k]);
      Object.keys(flatObject).forEach((x) => {
        finalObj[`${k}.${x}`] = flatObject[x];
      });
    } else {
      finalObj[k] = ob[k];
    }
  });

  return finalObj;
};

const arrayMatches = (arr, target) =>
  target.length === arr.length && target.every((v) => arr.includes(v));

class ParisMuseesCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    if (typeof process.env.PARIS_MUSEES_TOKEN === 'undefined') {
      throw new Error(
        'Environment variable PARIS_MUSEES_TOKEN must be declared with a valid token. See https://github.com/silknow/crawler#notes-about-paris-mus%C3%A9es for more details.'
      );
    }

    this.limit = 20;

    this.conditionsList = [
      `
      {field: "field_date_production.start_year", operator:GREATER_THAN_OR_EQUAL, value: "1400"}
      {field: "field_date_production.end_year", operator:SMALLER_THAN_OR_EQUAL, value: "1860"}
      `,
      `
      {field: "field_date_production.start_year", operator:GREATER_THAN_OR_EQUAL, value: "1400"}
      {field: "field_date_production.end_year", operator:IS_NULL}
      {field: "field_date_production.century", operator:LIKE, value: "% quart % 19e %"}
      `,
      `
      {field: "field_date_production.start_year", operator:IS_NULL}
      {field: "field_date_production.end_year", operator:IS_NULL}
      {field: "field_oeuvre_auteurs.entity.field_auteur_auteur.entity.field_pip_date_naissance.start_year", operator:GREATER_THAN_OR_EQUAL, value: "1350"}
      {field: "field_oeuvre_auteurs.entity.field_auteur_auteur.entity.field_pip_date_deces.start_year", operator:SMALLER_THAN_OR_EQUAL, value: "1900"}
      `,
    ];
  }

  async start() {
    this.currentConditions = this.conditionsList.shift();
    return super.start();
  }

  async downloadNextPage() {
    const query = `{
      nodeQuery(filter: {conditions: [
        {field: "type", value: "oeuvre"}
        {field: "field_oeuvre_types_objet.entity.tid", operator: IN, value: [
          "167902", # Vêtements et accessoires de vêtements
          "167931", # Tapisserie
          "167985", # Mobilier
          "167924", # Arts graphiques
          "167933", # Manuscrits, imprimés, reliure
          "167919", # Numismatique
          "167910", # Textile
        ]}
        {field: "field_materiaux_technique", value: "213625"} # Soie
        ${this.currentConditions}
      ]}, offset: ${this.currentOffset}, limit: ${this.limit})
      ${this.getQueryDetails()}
    }`;

    const res = await this.axios.post(
      'http://apicollections.parismusees.paris.fr/graphql',
      {
        query,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'auth-token': process.env.PARIS_MUSEES_TOKEN,
        },
      }
    );

    // Process results
    await this.onSearchResult(res.data);

    if (this.currentOffset >= res.data.data.nodeQuery.count) {
      // Switch to next conditions and start over
      debug('Swtiching to next conditions');
      this.currentConditions = this.conditionsList.shift();
      if (typeof this.currentConditions === 'undefined') {
        // Done
        debug('No more conditions');
      } else {
        debug('Starting with next conditions');
        return this.start();
      }
    }

    return super.downloadNextPage();
  }

  async onSearchResult(result) {
    // Re-calculate pagination
    this.currentOffset += this.limit;
    this.totalPages = Math.ceil(result.data.nodeQuery.count / this.limit);

    for (const entity of result.data.nodeQuery.entities) {
      if (entity !== null) {
        // Some entities can be null for some reason...
        debug('Process record');
        await this.downloadRecord(entity);
      }
    }

    return Promise.resolve();
  }

  async downloadRecord(recordData) {
    const recordNumber = `${recordData.entityId}`;

    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      const record = await this.getRecord(recordNumber);
      return Promise.resolve(record);
    }

    const recordUrl = recordData.absolutePath;

    const record = new Record(recordNumber, recordUrl);

    const fields = flattenObject(recordData);

    // Add simple fields as arrays
    Object.keys(recordData).forEach((k) => {
      if (Array.isArray(recordData[k])) {
        if (
          recordData[k].every(
            (ob) =>
              typeof ob.entity === 'object' &&
              arrayMatches(Object.keys(ob.entity), ['entityId', 'name'])
          )
        ) {
          fields[k] = fields[k] || [];
          fields[k].push(...recordData[k].map((r) => r.entity.name));
        }
      }
    });

    // Other fields
    fields.fieldOeuvreInscriptions = recordData.fieldOeuvreInscriptions
      .map(
        (f) =>
          f.entity.fieldInscriptionMarque &&
          f.entity.fieldInscriptionMarque.value
      )
      .filter((x) => x);
    recordData.fieldOeuvreDimensions.forEach((dim) => {
      fields[
        `${dim.entity.fieldDimensionType.entity.name}.${dim.entity.fieldDimensionPartie.entity.name}`
      ] = `${dim.entity.fieldDimensionValeur} ${dim.entity.fieldDimensionUnite.entity.name}`;
    });

    // Add original record data at the end, as non-flattened objects, in a 'raw' property
    record.raw = recordData;

    Object.keys(fields).forEach((label) => {
      record.addField(label, fields[label]);
    });

    // Handle images
    recordData.fieldVisuels.forEach((visual) => {
      if (
        visual.entity.vignette.startsWith(
          'https://apicollections.parismusees.paris.fr/sites/default/files/styles/thumbnail/public?'
        )
      ) {
        // Invalid image url (link is dead)
        return;
      }
      const image = {
        id: visual.entity.entityId,
        url: visual.entity.vignette.replace(
          'https://apicollections.parismusees.paris.fr/sites/default/files/styles/thumbnail/collections/atoms/',
          'https://www.parismuseescollections.paris.fr/sites/default/files/styles/pm_diaporama/public/atoms/'
        ),
        title: visual.entity.name,
        description: visual.entity.fieldLegende,
        author: visual.entity.fieldCopyright,
        license: visual.entity.fieldImageDroits,
      };
      record.addImage(image);
    });

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    await this.writeRecord(record);

    return Promise.resolve(record);
  }

  getQueryDetails() {
    return `{
      count
      entities {
        entityUuid
        ... on NodeOeuvre {
          title
          entityId,
          entityLabel
          absolutePath
          fieldOeuvreAuteurs {
            entity {
              entityId
              fieldAuteurAuteur {
                entity {
                  name
                  fieldPipDateNaissance {
                    startPrecision
                    startYear
                    startMonth
                    startDay
                    sort
                    endPrecision
                    endYear
                    endMonth
                    endDay
                    century
                  }
                  fieldPipDateDeces {
                    startPrecision
                    startYear
                    startMonth
                    startDay
                    sort
                    endPrecision
                    endYear
                    endMonth
                    endDay
                    century
                  }
                  fieldPipLieuNaissance
                  fieldLieuDeces
                }
              }
            }
          }
          fieldVisuels {
            entity {
              entityId
              name
              vignette
              fieldCopyright
              fieldImageDroits
              fieldImageLegendeCplementaire
              fieldImageVenteTirage
              fieldLegende
              fieldImageLibre
            }
          }
          fieldDateProduction {
            startPrecision
            startYear
            startMonth
            startDay
            sort
            endPrecision
            endYear
            endMonth
            endDay
            century
          }
          fieldOeuvreTypesObjet {
            entity {
              entityId
              name
            }
          }
          fieldMateriauxTechnique {
            entity {
              entityId
              name
            }
          }
          fieldOeuvreDimensions {
            entity {
              fieldDimensionPartie {
                entity {
                  entityId
                  name
                }
              }
              fieldDimensionType {
                entity {
                  entityId
                  name
                }
              }
              fieldDimensionUnite {
                entity {
                  entityId
                  name
                }
              }
              fieldDimensionValeur
            }
          }
          fieldOeuvreInscriptions {
            entity {
              fieldInscriptionType {
                entity {
                  entityId
                  name
                }
              }
              fieldInscriptionMarque {
                value
                format
                processed
              }
              fieldInscriptionEcriture {
                entity {
                  entityId
                  name
                }
              }
            }
          }
          fieldOeuvreThemeRepresente {
            entity {
              entityId
              name
            }
          }
          fieldLieuxConcernes {
            entity {
              entityId
              name
            }
          }
          fieldModaliteAcquisition {
            entity {
              entityId
              name
            }
          }
          fieldDonateurs {
            entity {
              entityId
              name
            }
          }
          fieldOeuvreExpose {
            entity {
              entityId
              name
            }
          }
          fieldMusee {
            entity {
              entityId
              entityLabel
              fieldMuseeTitreCourt
              fieldMuseeLogo {
                url
                title
                alt
              }
              fieldAdresse {
                countryCode
                locality
                postalCode
                addressLine1
                addressLine2
              }
              fieldGeolocation {
                lat
                lng
              }
            }
          }
        }
      }
    }`;
  }
}

ParisMuseesCrawler.id = 'paris-musees';

module.exports = ParisMuseesCrawler;
