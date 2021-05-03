const debug = require('debug')('silknow:crawlers:ceres-mcu');
const cheerio = require('cheerio');
const querystring = require('querystring');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class CeresMcuCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.method = 'post';
    this.request.responseType = 'arraybuffer';
    this.request.url = 'http://ceres.mcu.es/pages/Main';
    this.request.headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    this.limit = 24;

    this.originalRequestData = '';
  }

  /**
   * @override
   */
  async start() {
    // 1st Search Strategy (Advanced, Museo MNR, seda, 1400-1900)
    debug('Executing 1st Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.url = 'http://ceres.mcu.es/pages/Main';
    this.request.data =
      'periodoIni=&sigloIni=&periodoFin=&sigloFin=&tipoConsulta=F&anioIni=1400&mesIni=&diaIni=&anioFin=1900&mesFin=&diaFin=&mosaic=on&fieldName=DATA&usedFields=MATT%7Cseda%7Con%7CC%40&servletOrigen=SimpleSearch&servletDestino=DateSearch&MuseumsSearch=MNR%7C&MuseumsRolSearch=17&chk_All=&search=advanced&ConsultaParcialCompleta=&txtCriterioParcial=&ConsultaFinal=&txtCriterioFinal=&WHERE_CRONOS=&museoUnion=MNR&btn_Aceptar=Aceptar';
    this.originalRequestData = this.request.data;
    this.websiteType = 'ceres';
    await this.downloadNextPage();

    // 2nd Search Strategy (Advanced, Museo MAM, seda, 1400-1900)
    debug('Executing 2nd Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.url = 'http://ceres.mcu.es/pages/Main';
    this.request.data =
      'txt_OBJE=&hidtxt_OBJE=C&txt_AUTT=&hidtxt_AUTT=C&txt_TITU=&hidtxt_TITU=C&txt_MATT=seda&hidtxt_MATT=C&chk_MATT=on&txt_DATA=1400+-+1900&hidtxt_DATA=D&hiftxt_DATA=&txt_LUGT=&hidtxt_LUGT=C&txt_PROT=&hidtxt_PROT=C&txt_ESPE=&hidtxt_ESPE=C&btnSearch=Buscar&servletOrigen=AdvancedSearch&servletDestino=AdvancedSearch&WHERE_CRONOS=and+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29&fieldName=DATA&MuseumsRolSearch=1&MuseumsSearch=MAM%7C&search=advanced&museoUnion=MAM&mosaic=on';
    this.originalRequestData = this.request.data;
    this.websiteType = 'ceres';
    await this.downloadNextPage();

    // 3rd Search Strategy (Advanced, Museo MT, seda, 1400-1900)
    debug('Executing 3rd Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.url = 'http://ceres.mcu.es/pages/Main';
    this.request.data =
      'txt_CLAS=&hidtxt_CLAS=C&txt_OBJE=&hidtxt_OBJE=C&txt_AUTT=&hidtxt_AUTT=C&txt_TITU=&hidtxt_TITU=C&txt_MATT=seda&hidtxt_MATT=C&chk_MATT=on&txt_DATA=1400+-+1900&hidtxt_DATA=D&hiftxt_DATA=&btnSearch=Buscar&servletOrigen=AdvancedSearch&servletDestino=AdvancedSearch&WHERE_CRONOS=and+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29&fieldName=DATA&MuseumsRolSearch=1&MuseumsSearch=MT%7C&search=advanced&museoUnion=MT&mosaic=on';
    this.originalRequestData = this.request.data;
    this.websiteType = 'ceres';
    await this.downloadNextPage();

    // 4th Search Strategy (Advanced, Museo MNC, seda, 1400-1900)
    debug('Executing 4th Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.url = 'http://ceres.mcu.es/pages/Main';
    this.request.data =
      'txt_OBJE=&hidtxt_OBJE=C&txt_AUTT=&hidtxt_AUTT=C&txt_TITU=&hidtxt_TITU=C&txt_MATT=seda&hidtxt_MATT=C&chk_MATT=on&txt_ICOT=&hidtxt_ICOT=C&txt_DATA=1400+-+1900&hidtxt_DATA=D&hiftxt_DATA=&txt_CNTT=&hidtxt_CNTT=C&txt_LUGT=&hidtxt_LUGT=C&btnSearch=Buscar&servletOrigen=AdvancedSearch&servletDestino=AdvancedSearch&WHERE_CRONOS=and+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29&fieldName=DATA&MuseumsRolSearch=1&MuseumsSearch=MNC%7C&search=advanced&museoUnion=MNC&mosaic=on';
    this.originalRequestData = this.request.data;
    this.websiteType = 'ceres';
    await this.downloadNextPage();

    // 5th Search Strategy (Advanced, Museo MSTO, seda, 1400-1900)
    debug('Executing 5th Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.url = 'http://ceres.mcu.es/pages/Main';
    this.request.data =
      'txt_CLAS=&hidtxt_CLAS=C&txt_OBJE=&hidtxt_OBJE=C&txt_AUTT=&hidtxt_AUTT=C&txt_TITU=&hidtxt_TITU=C&txt_MATT=seda&hidtxt_MATT=C&chk_MATT=on&txt_ICOT=&hidtxt_ICOT=C&txt_DATA=1400+-+1900&hidtxt_DATA=D&hiftxt_DATA=&btnSearch=Buscar&servletOrigen=AdvancedSearch&servletDestino=AdvancedSearch&WHERE_CRONOS=and+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29&fieldName=DATA&MuseumsRolSearch=1&MuseumsSearch=MSTO%7C&search=advanced&museoUnion=MSTO&mosaic=on';
    this.originalRequestData = this.request.data;
    this.websiteType = 'ceres';
    await this.downloadNextPage();

    // 6th Search Strategy (www.museosdeandalucia.es, Advanced, seda)
    debug('Executing 6th Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.url =
      'http://www.juntadeandalucia.es/cultura/WEBDomus/domus.jsp?lng=es';
    this.request.data =
      'obje=&obje=&auto=&mate=Seda&icon=&proc=&tipoBusqueda=avanzada';
    this.originalRequestData = this.request.data;
    this.websiteType = 'juntadeandalucia';
    await this.downloadNextPage();

    // 7th Search Strategy (www.museolazarogaldiano.es, Advanced, seda, 1400-1900)
    debug('Executing 7th Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.url =
      'http://catalogo.museolazarogaldiano.es/mlgm/search/pages/Main';
    this.request.data =
      'txt_NINV=&hidtxt_NINV=C&txt_CLAS=&hidtxt_CLAS=C&txt_OBJE=&hidtxt_OBJE=C&txt_AUTT=&hidtxt_AUTT=C&txt_TITU=&hidtxt_TITU=C&txt_EMIS=&hidtxt_EMIS=C&txt_MATT=Seda&hidtxt_MATT=L&chk_MATT=on&txt_ICOT=&hidtxt_ICOT=C&txt_DATA=1400+-+1900&hidtxt_DATA=D&hiftxt_DATA=&txt_CNTT=&hidtxt_CNTT=C&txt_LUGT=&hidtxt_LUGT=C&txt_PROC=&hidtxt_PROC=C&txt_ESPE=&hidtxt_ESPE=C&btnSearch=Buscar&servletOrigen=AdvancedSearch&servletDestino=AdvancedSearch&WHERE_CRONOS=and+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29&fieldName=DATA&MuseumsRolSearch=1&MuseumsSearch=MLGM%7C&search=advanced&museoUnion=MLGM';
    this.originalRequestData = this.request.data;
    this.websiteType = 'ceres';
    await this.downloadNextPage();
  }

  /**
   * @override
   */
  async downloadNextPage() {
    const currentPage = Math.ceil(this.currentOffset / this.limit);

    const nextPage = (currentPage + 1).toString();
    this.request.data = `${this.originalRequestData}&page=${nextPage}&txtPageHead=${nextPage}&txtPageFoot=${nextPage}`;

    return super.downloadNextPage();
  }

  async onSearchResult(result) {
    const $ = cheerio.load(result.toString('latin1'));
    const records = [];

    if (this.websiteType === 'ceres') {
      $('.tablaLPR1 td .contenedorImagenLPR1').each((i, elem) => {
        const recordInfo = {
          id: null,
          museum: null,
          inputs: [],
        };
        $(elem)
          .find('input')
          .each((j, input) => {
            const inputName = $(input).attr('name');
            const inputValue = $(input).attr('value');

            if (inputName.indexOf('btnDetalle_') === 0) {
              const identifierArray = inputName
                .substr('btnDetalle_'.length)
                .split('_');

              const { 0: id, 1: museum } = identifierArray;
              recordInfo.id = id;
              recordInfo.museum = museum;
            }

            recordInfo.inputs.push({
              name: inputName,
              value: inputValue,
            });
          });

        if (recordInfo.id) {
          records.push(recordInfo);
        }
      });

      const resultsCount = $('.tablaLPR1 td .contenedorImagenLPR1').length;
      this.currentOffset += resultsCount;

      if (resultsCount >= 24) {
        this.totalPages += 1;
      }
    } else if (this.websiteType === 'juntadeandalucia') {
      $('#lineav li a').each((i, elem) => {
        const href = $(elem).attr('href');
        const { ninv } = querystring.parse(url.parse(href).query);

        const recordInfo = {
          id: ninv,
          href,
          museum: 'juntadeandalucia',
        };

        if (recordInfo.id) {
          records.push(recordInfo);
        }
      });

      this.currentOffset += $('#lineav li a').length;
    }

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    return Promise.resolve();
  }

  async downloadRecord(recordInfo) {
    const recordNumber = `${recordInfo.id}_${recordInfo.museum}`;
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    const record = new Record(recordNumber, recordInfo.href);

    // Download record
    debug('Downloading record %s', recordNumber);

    if (this.websiteType === 'ceres') {
      const requestData = {
        servletOrigen: 'ResultSearch',
        servletDestino: 'ResultSearch',
      };
      recordInfo.inputs.forEach((input) => {
        requestData[input.name] = input.value;
      });

      let response;
      try {
        response = await this.axios({
          method: this.request.method,
          url: this.request.url,
          data: querystring.stringify(requestData),
          headers: this.request.headers,
          responseType: 'arraybuffer',
        });
      } catch (err) {
        return Promise.reject(err);
      }

      const $ = cheerio.load(response.data.toString('latin1'));

      // Fields
      $('.contenido tr').each((i, elem) => {
        const label = $(elem).find('.tabla1TituloMB').first().text().trim();
        const value = $(elem).find('.celdaTablaR').first().text().trim();

        record.addField(label, value);
      });

      // Main image
      if ($('.imagenFichaMB').length > 0) {
        const imageText = $('.imagenFichaMB .celdaTablaRFoto')
          .contents()
          .filter((j, node) => node.type === 'text')
          .text()
          .trim();

        record.addImage({
          id: recordInfo.id,
          url: `http://ceres.mcu.es/pages/Viewer?accion=42&AMuseo=${encodeURIComponent(
            recordInfo.museum
          )}&Ninv=${encodeURIComponent(recordInfo.id)}&txt_id_imagen=1`,
          text: imageText,
        });
      }

      // Images
      $('.contenedorImagenLPR3').each((i, elem) => {
        if (i === 0) return; // Skip first image, it's the same as the main image

        const imageText = $(elem)
          .next('.contenedorTextoLPR3 .gris')
          .text()
          .trim();

        record.addImage({
          url: `http://ceres.mcu.es/pages/Viewer?accion=42&AMuseo=${encodeURIComponent(
            recordInfo.museum
          )}&Ninv=${encodeURIComponent(recordInfo.id)}&txt_id_imagen=${i + 1}`,
          text: imageText,
        });
      });
    } else if (this.websiteType === 'juntadeandalucia') {
      let response;
      try {
        response = await this.axios({
          method: 'GET',
          url: recordInfo.href,
          headers: this.request.headers,
          responseType: 'arraybuffer',
        });
      } catch (err) {
        return Promise.reject(err);
      }

      const $ = cheerio.load(response.data.toString('latin1'));

      const title = $('.row .col-6-sm a:nth-child(1)').first().text().trim();
      record.addField('title', title);

      // Main image
      const imageUrl = $('.navegador + img').first().attr('src');
      record.addImage({
        id: recordInfo.id,
        url: imageUrl,
      });

      // Fields
      $('.row .col-6-sm span').each((i, elem) => {
        const label = $(elem).text().trim();
        const value = $(elem).next('p').text().trim();

        record.addField(label, value);
      });
    }

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }
}

CeresMcuCrawler.id = 'ceres-mcu';

module.exports = CeresMcuCrawler;
