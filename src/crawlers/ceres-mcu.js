const debug = require('debug')('silknow:crawlers:ceres-mcu');
const cheerio = require('cheerio');
const querystring = require('querystring');

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
    // 1st Search Strategy (txtSimpleSearch=Tejidos)
    debug('Executing 1st Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.data =
      'cmbOrderBy=%5BNINV%5D&result=&btnSearch=Actualizar&selectPreviousList=%5BTipoT%5D%2C+%5BIdt_Tabla%5D%2C+%5BNINV%5D%2C+%5BImgG%5D%2C+%5BImgP%5D%2C+%5BAMuseo%5D%2C+%5BDMUSEO%5D+as+%5BMuseo%5D%2C+%5BNINV%5D+as+%5BInventario%5D%2C+%5BOBJE%5D+as+%5BObjeto%2FDocumento%5D%2C+%5BAUTT%5D+as+%5BAutor%5D%2C+%5BTITU%5D+as+%5BT%EDtulo%5D%2C+%5BEMIS%5D+as+%5BEmisor%5D%2C+%5BESPE%5D+as+%5BLugar+Espec%EDfico%2FYacimiento%5D&txtSimpleSearch=Tejidos&hipertextSearch=0&servletOrigen=ResultSearch&servletDestino=ResultSearch&FinalImgPathPDF=&AuthorImgPDF=&PDFText=&MuseumsSearch=&MuseumsRolSearch=1&search=advanced&whereCRONOSPreview=and+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29&whereFMUSPreview=CLAB%7CTejidos%7CMATB%7CSeda%7C&whereFDOCPreview=CLAB%7CTejidos%7CSOPB%7CSeda%7C&whereCONJPreview=&hierarchyPreview=&typeSearchPreview=C%7CC%7C&selectPreview=%5BTipoT%5D%2C+%5BIdt_Tabla%5D%2C+%5BNINV%5D%2C+%5BImgP%5D%2C+%5BImgG%5D%2C+%5BAMuseo%5D%2C+%5BDMUSEO%5D+as+%5BMuseo%5D%2C+%5BNINV%5D+as+%5BInventario%5D%2C+%5BOBJE%5D+as+%5BObjeto%2FDocumento%5D%2C+%5BAUTT%5D+as+%5BAutor%5D%2C+%5BTITU%5D+as+%5BT%EDtulo%5D%2C+%5BEMIS%5D+as+%5BEmisor%5D%2C+%5BMATT%5D+as+%5BMateria%2FSoporte%5D%2C+%5BDATA%5D+as+%5BDataci%F3n%5D%2C+%5BCNTT%5D+as+%5BContexto+Cultural%2FEstilo%5D%2C+%5BLUGT%5D+as+%5BLugar+de+Producci%F3n%2FCeca%5D%2C+%5BPROC%5D+as+%5BLugar+de+Procedencia%5D%2C+%5BESPE%5D+as+%5BLugar+Espec%EDfico%2FYacimiento%5D&selectPreviewFMUS=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BOBJE%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BEMIS%5D%2C%5BMATT%5D%2C%5BDATA%5D%2C%5BCNTT%5D%2C%5BLUGT%5D%2C%5BPROC%5D%2C%5BESPE%5D&selectPreviewFDOC=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BDOCU%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BNULL%5D%2C%5BSOPT%5D%2C%5BDATA%5D%2C%5BCNTT%5D%2C%5BLEMT%5D%2C%5BPROC%5D%2C%5BESPE%5D&selectPreviewCONJ=&selectPreviousList=%5BTipoT%5D%2C+%5BIdt_Tabla%5D%2C+%5BNINV%5D%2C+%5BImgG%5D%2C+%5BImgP%5D%2C+%5BAMuseo%5D%2C+%5BDMUSEO%5D+as+%5BMuseo%5D%2C+%5BNINV%5D+as+%5BInventario%5D%2C+%5BOBJE%5D+as+%5BObjeto%2FDocumento%5D%2C+%5BAUTT%5D+as+%5BAutor%5D%2C+%5BTITU%5D+as+%5BT%EDtulo%5D%2C+%5BEMIS%5D+as+%5BEmisor%5D%2C+%5BESPE%5D+as+%5BLugar+Espec%EDfico%2FYacimiento%5D&selectFMUSPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BCLAS%5D%2C%5BOBJE%5D%2C%5BNESP%5D%2C%5BTIPO%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BEMIS%5D%2C%5BCONJ%5D%2C%5BMATT%5D%2C%5BTECT%5D%2C%5BDIME%5D%2C%5BCART%5D%2C%5BDESW%5D%2C%5BNULL%5D%2C%5BNULL%5D%2C%5BICOT%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNTT%5D%2C%5BLUGT%5D%2C%5BUSOF%5D%2C%5BREFE%5D%2C%5BDEOT%5D%2C%5BGEOG%5D%2C%5BPROC%5D%2C%5BESPE%5D%2C%5BHISW%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BFORM%5D%2C%5BFUEN%5D%2C%5BFING%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectFDOCPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BCLAS%5D%2C%5BDOCU%5D%2C%5BNESP%5D%2C%5BTIPO%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BNULL%5D%2C%5BCONJ%5D%2C%5BSOPT%5D%2C%5BTECT%5D%2C%5BDIME%5D%2C%5BCART%5D%2C%5BDESW%5D%2C%5BCONT%5D%2C%5BDOCF%5D%2C%5BICOT%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNTT%5D%2C%5BLEMT%5D%2C%5BNULL%5D%2C%5BREFE%5D%2C%5BDEOT%5D%2C%5BGEOG%5D%2C%5BPROC%5D%2C%5BESPE%5D%2C%5BHISW%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BFORM%5D%2C%5BFUEN%5D%2C%5BFING%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectCONJPreview=&selectContainsFMUSPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BCLBQ%5D%2C%5BOBBQ%5D%2C%5BNESQ%5D%2C%5BTIPQ%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BEMIS%5D%2C%5BCONJ%5D%2C%5BMAQQ%5D%2C%5BTEQQ%5D%2C%5BDIME%5D%2C%5BCRQQ%5D%2C%5BDESW%5D%2C%5BNULL%5D%2C%5BNULL%5D%2C%5BICBQ%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNQQ%5D%2C%5BLUGT%5D%2C%5BUSOF%5D%2C%5BREFE%5D%2C%5BDEOT%5D%2C%5BGEOG%5D%2C%5BPROC%5D%2C%5BESPE%5D%2C%5BHISW%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BFREQ%5D%2C%5BFUEN%5D%2C%5BFING%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectContainsFDOCPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BCLBQ%5D%2C%5BDOCQ%5D%2C%5BNESQ%5D%2C%5BTIPQ%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BNULL%5D%2C%5BCONJ%5D%2C%5BSOQQ%5D%2C%5BTEQQ%5D%2C%5BDIME%5D%2C%5BCRQQ%5D%2C%5BDESW%5D%2C%5BCONT%5D%2C%5BDOCF%5D%2C%5BICBQ%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNQQ%5D%2C%5BLEMT%5D%2C%5BNULL%5D%2C%5BREFE%5D%2C%5BDEOT%5D%2C%5BGEOG%5D%2C%5BPROC%5D%2C%5BESPE%5D%2C%5BHISW%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BFREQ%5D%2C%5BFUEN%5D%2C%5BFING%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectContainsCONJPreview=&orderPreview=Museo%7CInventario%7CObjeto%2FDocumento%7CAutor%7CT%EDtulo%7CEmisor%7CMateria%2FSoporte%7CDataci%F3n%7CContexto+Cultural%2FEstilo%7CLugar+de+Producci%F3n%2FCeca%7CLugar+de+Procedencia%7CLugar+Espec%EDfico%2FYacimiento%7C&orderValuePreview=%5BDMUSEO%5D%7C%5BNINV%5D%7C%5BOBJE%5D%7C%5BAUTT%5D%7C%5BTITU%5D%7C%5BEMIS%5D%7C%5BMATT%5D%7C%5BDATA%5D%7C%5BCNTT%5D%7C%5BLUGT%5D%7C%5BPROC%5D%7C%5BESPE%5D%7C&cmbOrderByPreview=&ThsOrLstPreview=Museo%7CClasificaci%F3n+Gen%E9rica%7CObjeto%2FDocumento%7CNombre+Espec%EDfico%7CTipolog%EDa%2FEstado%7CAutor%7CT%EDtulo%7CEmisor%7CConjunto%7CMateria%2FSoporte%7CT%E9cnica%7CCaracter%EDsticas+T%E9cnicas%7CIconografia%7CContexto+Cultural%2FEstilo%7CLugar+de+Producci%F3n%2FCeca%7CDescriptores+Onom%E1sticos%7CDescriptores+Geogr%E1ficos%7CLugar+de+Procedencia%7CLugar+Espec%EDfico%2FYacimiento%7CForma+de+Ingreso%7C&simpleSearchPreview=0&chk_All=&exactSearch=false&mosaicPreview=false&museoUnion=&ConsultaFinal=&grupo=';
    this.originalRequestData = this.request.data;
    await this.downloadNextPage();

    // 2nd Search Strategy (txtSimpleSearch=Seda)
    debug('Executing 2nd Search Strategy');
    this.currentOffset = 0;
    this.totalPages = this.startPage;
    this.request.data =
      'cmbOrderBy=%5BNINV%5D&result=&btnSearch=Actualizar&selectPreviousList=%5BTipoT%5D%2C+%5BIdt_Tabla%5D%2C+%5BNINV%5D%2C+%5BImgG%5D%2C+%5BImgP%5D%2C+%5BAMuseo%5D%2C+%5BDMUSEO%5D+as+%5BMuseo%5D%2C+%5BNINV%5D+as+%5BInventario%5D%2C+%5BOBJE%5D+as+%5BObjeto%2FDocumento%5D%2C+%5BAUTT%5D+as+%5BAutor%5D%2C+%5BTITU%5D+as+%5BT%EDtulo%5D&txtSimpleSearch=Seda&hipertextSearch=0&servletOrigen=ResultSearch&servletDestino=ResultSearch&FinalImgPathPDF=&AuthorImgPDF=&PDFText=&MuseumsSearch=MNAD%7C&MuseumsRolSearch=16&search=advancedUnion&whereCRONOSPreview=&whereFMUSPreview=MAQQ%7CSeda%7CDATA%7Cand+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29%7C&whereFDOCPreview=&whereCONJPreview=&hierarchyPreview=&typeSearchPreview=&selectPreview=%5BTipoT%5D%2C+%5BIdt_Tabla%5D%2C+%5BNINV%5D%2C+%5BImgP%5D%2C+%5BImgG%5D%2C+%5BAMuseo%5D%2C+%5BDMUSEO%5D+as+%5BMuseo%5D%2C+%5BNINV%5D+as+%5BInventario%5D%2C+%5BCLAS%5D+as+%5BClasificaci%F3n+Gen%E9rica%5D%2C+%5BOBJE%5D+as+%5BObjeto%2FDocumento%5D%2C+%5BAUTT%5D+as+%5BAutor%5D%2C+%5BTITU%5D+as+%5BT%EDtulo%5D%2C+%5BMATT%5D+as+%5BMateria%2FSoporte%5D%2C+%5BTECT%5D+as+%5BT%E9cnica%5D%2C+%5BFMTO%5D+as+%5BFormato%5D%2C+%5BDATA%5D+as+%5BDataci%F3n%5D&selectPreviewFMUS=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BCLAS%5D%2C%5BOBJE%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BMATT%5D%2C%5BTECT%5D%2C%5BNULL%5D%2C%5BDATA%5D&selectPreviewFDOC=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BCLAS%5D%2C%5BDOCU%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BSOPT%5D%2C%5BTECT%5D%2C%5BFMTO%5D%2C%5BDATA%5D&selectPreviewCONJ=&selectPreviousList=%5BTipoT%5D%2C+%5BIdt_Tabla%5D%2C+%5BNINV%5D%2C+%5BImgG%5D%2C+%5BImgP%5D%2C+%5BAMuseo%5D%2C+%5BDMUSEO%5D+as+%5BMuseo%5D%2C+%5BNINV%5D+as+%5BInventario%5D%2C+%5BOBJE%5D+as+%5BObjeto%2FDocumento%5D%2C+%5BAUTT%5D+as+%5BAutor%5D%2C+%5BTITU%5D+as+%5BT%EDtulo%5D&selectFMUSPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BNULL%5D%2C%5BCLAS%5D%2C%5BOBJE%5D%2C%5BNESP%5D%2C%5BTIPO%5D%2C%5BCOMP%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BEMIS%5D%2C%5BMATT%5D%2C%5BTECT%5D%2C%5BNULL%5D%2C%5BDIME%5D%2C%5BCART%5D%2C%5BDESW%5D%2C%5BNULL%5D%2C%5BICOT%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNTT%5D%2C%5BLUGT%5D%2C%5BPROT%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectFDOCPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BTIDO%5D%2C%5BCLAS%5D%2C%5BDOCU%5D%2C%5BNESP%5D%2C%5BTIPO%5D%2C%5BCOMP%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BNULL%5D%2C%5BSOPT%5D%2C%5BTECT%5D%2C%5BFMTO%5D%2C%5BDIME%5D%2C%5BCART%5D%2C%5BDESW%5D%2C%5BCONT%5D%2C%5BICOT%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNTT%5D%2C%5BLEMT%5D%2C%5BPROT%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectCONJPreview=&selectContainsFMUSPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BNULL%5D%2C%5BCLBQ%5D%2C%5BOBBQ%5D%2C%5BNESQ%5D%2C%5BTIPQ%5D%2C%5BCOMQ%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BEMIS%5D%2C%5BMAQQ%5D%2C%5BTEQQ%5D%2C%5BNULL%5D%2C%5BDIME%5D%2C%5BCRQQ%5D%2C%5BDESW%5D%2C%5BNULL%5D%2C%5BICBQ%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNQQ%5D%2C%5BLUGT%5D%2C%5BPROT%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectContainsFDOCPreview=%5BDMUSEO%5D%2C%5BNINV%5D%2C%5BTIDQ%5D%2C%5BCLBQ%5D%2C%5BDOCQ%5D%2C%5BNESQ%5D%2C%5BTIPQ%5D%2C%5BCOMQ%5D%2C%5BAUTT%5D%2C%5BTITU%5D%2C%5BNULL%5D%2C%5BSOQQ%5D%2C%5BTEQQ%5D%2C%5BFMTO%5D%2C%5BDIME%5D%2C%5BCRQQ%5D%2C%5BDESW%5D%2C%5BCONT%5D%2C%5BICBQ%5D%2C%5BINST%5D%2C%5BFIRT%5D%2C%5BDATA%5D%2C%5BCNQQ%5D%2C%5BLEMT%5D%2C%5BPROT%5D%2C%5BCLAR%5D%2C%5BBIBT%5D%2C%5BCATA%5D%2C%5BDE_MENC%5D&selectContainsCONJPreview=&orderPreview=Museo%7CInventario%7CClasificaci%F3n+Gen%E9rica%7CObjeto%2FDocumento%7CAutor%7CT%EDtulo%7CMateria%2FSoporte%7CT%E9cnica%7CFormato%7CDataci%F3n%7C&orderValuePreview=%5BDMUSEO%5D%7C%5BNINV%5D%7C%5BCLAS%5D%7C%5BOBJE%5D%7C%5BAUTT%5D%7C%5BTITU%5D%7C%5BMATT%5D%7C%5BTECT%5D%7C%5BFMTO%5D%7C%5BDATA%5D%7C&cmbOrderByPreview=&ThsOrLstPreview=Museo%7CTipo+Documento%7CClasificaci%F3n+Gen%E9rica%7CObjeto%2FDocumento%7CNombre+Espec%EDfico%7CTipolog%EDa%2FEstado%7CComponentes%7CAutor%7CT%EDtulo%7CEmisor%7CMateria%2FSoporte%7CT%E9cnica%7CCaracter%EDsticas+T%E9cnicas%7CIconografia%7CContexto+Cultural%2FEstilo%7CLugar+de+Producci%F3n%2FCeca%7CLugar+de+Procedencia%7C&simpleSearchPreview=0&chk_All=&exactSearch=true&mosaicPreview=false&museoUnion=MNAD&ConsultaFinal=%7B%7CMAQQ%7Con%7CSeda%7CL%40AND%7CDATA%7Coff%7Cand+%28campo+%3D+%23%40DATA%23%40%29+and+%28%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3C%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3E%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29+or+%28dbo.FN_FORMATEA_ANIO%28valor_ini%2C%27I%27%29+%3E%3D+%23%4014000101%23%40+and+dbo.FN_FORMATEA_ANIO%28valor_fin%2C%27F%27%29+%3C%3D+%23%4019001231%23%40%29+and+%28AC_BP_ini+%3D+%23%40DC%23%40++and+AC_BP_fin+%3D+%23%40DC%23%40+%29%29+%29%7CD%7D&grupo=';
    this.originalRequestData = this.request.data;
    return this.downloadNextPage();
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

    if ($('#btnPageForwardFoot').length > 0) {
      this.totalPages += 1;
    }

    const records = [];
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

    for (const record of records) {
      try {
        await this.downloadRecord(record);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += $('.tablaLPR1 td .contenedorImagenLPR1').length;

    return Promise.resolve();
  }

  async downloadRecord(recordInfo) {
    const recordNumber = `${recordInfo.id}_${recordInfo.museum}`;
    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    // Download record
    debug('Downloading record %s', recordNumber);

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

    const record = new Record(recordNumber);

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

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }
}

CeresMcuCrawler.id = 'ceres-mcu';

module.exports = CeresMcuCrawler;
