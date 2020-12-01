const debug = require('debug')('silknow:crawlers:versailles');
const cheerio = require('cheerio');
const url = require('url');

const BaseCrawler = require('./base');
const Record = require('../models/record');

class VersaillesCrawler extends BaseCrawler {
  constructor(argv) {
    super(argv);

    this.request.url =
      'http://collections.chateauversailles.fr/cc/showresults.asmx/GetResults';
    this.request.method = 'post';
    this.startPage = 1;
    this.limit = 18;
    this.request.headers = {
      'Content-Type': 'application/json; charset=utf-8',
    };
    this.request.withCredentials = true;
  }

  async downloadNextPage() {
    const formData = this.getFormData(this.currentPage, 'images');

    // Initialize search
    let response;
    try {
      response = await this.axios.post(
        'http://collections.chateauversailles.fr/cc/queryManager.asmx/StoreQuery',
        formData,
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
        }
      );
    } catch (err) {
      return Promise.reject(err);
    }

    // Store the cookies in a variable
    const cookies = response.headers['set-cookie'].join('; ');

    // Override the request headers with new session cookie
    this.request.headers = this.request.headers || {};
    this.request.headers.cookie = cookies;

    this.request.data = formData;

    return super.downloadNextPage();
  }

  async onSearchResult(result) {
    const ccnavigator = result.d.find(
      // eslint-disable-next-line no-underscore-dangle
      (d) => d.__type === 'ResultPart' && d.target === '.ccnavigator'
    ).html;
    const resultsCount = ccnavigator.match(
      /\$\('\.ccsearchcount'\)\.html\('([0-9]+)'\)/
    )[1];
    this.totalPages = Math.ceil(resultsCount / this.limit);

    for (let i = 1; i <= resultsCount; i += 1) {
      try {
        await this.downloadRecord(i);
      } catch (e) {
        debug('Could not download record:', e);
      }
    }

    this.currentOffset += resultsCount;

    return Promise.resolve();
  }

  async downloadRecord(recordIndex) {
    const formData = this.getFormData(recordIndex, 'record');

    // Download record
    debug('Fetching record index %s', recordIndex);
    let response;
    response = await this.axios.post(
      'http://collections.chateauversailles.fr/cc/queryManager.asmx/StoreQuery',
      formData,
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        withCredentials: true,
      }
    );
    response = await this.axios.post(
      'http://collections.chateauversailles.fr/cc/showresults.asmx/GetResults',
      formData,
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        withCredentials: true,
      }
    );

    const $ = cheerio.load(
      response.data.d.find(
        // eslint-disable-next-line no-underscore-dangle
        (d) => d.__type === 'ResultPart' && d.target === '#cc_results'
      ).html
    );

    const caracteristiques = {};
    $('#caracteristiques b').each((i, b) => {
      const label = $(b).text().trim();
      let value;
      if ($(b).next()[0]) {
        if ($(b).next()[0].name === 'span') {
          value = $(b).next().text().trim();
        } else {
          value = $(b).next()[0].prev.data.trim();
          if (value.startsWith(':')) {
            value = value.substr(1).trim();
          }
        }
        caracteristiques[label] = value;
      }
    });

    const recordNumber = caracteristiques["Nº d'inventaire:"];

    if (this.recordExists(recordNumber)) {
      debug('Skipping existing record %s', recordNumber);
      return Promise.resolve();
    }

    const record = new Record(recordNumber);

    // Title
    record.addField('title', $('.pagetitle').first().text().trim());

    // Caracteristiques
    Object.entries(caracteristiques).forEach(([label, value]) => {
      record.addField(label, value);
    });

    $('div').each((i, div) => {
      const label = $(div).text().trim();
      const id = $(div).attr('id');
      if (label === 'Historique') {
        // Description
        record.addField(label, $(div).next('div').text());
      } else if (id && id.startsWith('dzicontainer_')) {
        // Single image
        $(div)
          .find('img')
          .each((j, img) => {
            const imageUrl = new URL(
              url.resolve(
                'http://collections.chateauversailles.fr/',
                $(img).attr('src')
              )
            );
            imageUrl.searchParams.delete('width');
            imageUrl.searchParams.delete('height');
            imageUrl.searchParams.delete('bg');

            record.addImage({
              id: '',
              url: imageUrl,
            });
          });
      }
    });

    for (const imageUrlMatch of $.html().matchAll(/thumb: '([^,]+)',/g)) {
      const src = imageUrlMatch[1];
      const imageUrl = new URL(
        url.resolve('http://collections.chateauversailles.fr/', src)
      );
      imageUrl.searchParams.delete('width');
      imageUrl.searchParams.delete('height');
      imageUrl.searchParams.delete('bg');

      record.addImage({
        id: '',
        url: imageUrl,
      });
    }

    // Download the images
    await this.downloadRecordImages(record);

    // Save the record
    return this.writeRecord(record);
  }

  getFormData(index, showtypes) {
    return {
      sessionId: 'none',
      queryId: 'c79767ad-386b-49f7-997c-7f585c2d1748',
      querySpec: `%3CccQuery%3E%3Cfields%3E%3Csearchfield%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cvalues%3E%3Cvalue%3ETextiles%3C/value%3E%3C/values%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfreetext%3Eyes%3C/freetext%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cselect%20multiple%3D%22yes%22%20showTextbox%3D%22no%22%20rows%3D%224%22%20columns%3D%224%22%20linkedThesaurusFacet%3D%22%22%3Eyes%3C/select%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfield%20queryfield%3D%22/record/classification%22%20filters%3D%22%22%3EDomaine%20de%20collections%3C/field%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cowner%3Eccsearch_fieldselect1_id1%3C/owner%3E%3Ceditor%3Eccsearch_textbox1_id1%3C/editor%3E%3Cfirst%3E3%3C/first%3E%3Cfreetextvalue%3E%5BTextiles%5D%3C/freetextvalue%3E%3C/searchfield%3E%3Csearchfield%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cvalues/%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfreetext%3Eyes%3C/freetext%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cselect%3Eno%3C/select%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfield%20queryfield%3D%22/record/alphasortrepresente%2C/record/AuthorOrCreator%2C/record/classification%2C/record/datedPeriod%2C/record/description%2C/record/dimensions%2C/record/localisation%2C/record/medium%2C/record/Numero%2C/record/objectName%2C/record/provenance%2C/record/title%22%20filters%3D%22%22%3ETous%20les%20crit%E8res%3C/field%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cowner%3Eccsearch_fieldselect2_id1%3C/owner%3E%3Ceditor%3Eccsearch_textbox2_id1%3C/editor%3E%3Cfreetextvalue%3E%3C/freetextvalue%3E%3C/searchfield%3E%3Csearchfield%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cvalues/%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfreetext%3Eyes%3C/freetext%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cselect%3Eno%3C/select%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfield%20queryfield%3D%22/record/alphasortrepresente%2C/record/AuthorOrCreator%2C/record/classification%2C/record/datedPeriod%2C/record/description%2C/record/dimensions%2C/record/localisation%2C/record/medium%2C/record/Numero%2C/record/objectName%2C/record/provenance%2C/record/title%22%20filters%3D%22%22%3ETous%20les%20crit%E8res%3C/field%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cowner%3Eccsearch_fieldselect3_id1%3C/owner%3E%3Ceditor%3Eccsearch_textbox3_id1%3C/editor%3E%3Cfreetextvalue%3E%3C/freetextvalue%3E%3C/searchfield%3E%3Csearchfield%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cvalues/%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfreetext%3Eyes%3C/freetext%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cselect%3Eno%3C/select%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfield%20queryfield%3D%22/record/alphasortrepresente%2C/record/AuthorOrCreator%2C/record/classification%2C/record/datedPeriod%2C/record/description%2C/record/dimensions%2C/record/localisation%2C/record/medium%2C/record/Numero%2C/record/objectName%2C/record/provenance%2C/record/title%22%20filters%3D%22%22%3ETous%20les%20crit%E8res%3C/field%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cowner%3Eccsearch_fieldselect4_id1%3C/owner%3E%3Ceditor%3Eccsearch_textbox4_id1%3C/editor%3E%3Cfreetextvalue%3E%3C/freetextvalue%3E%3C/searchfield%3E%3Csearchfield%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cvalues/%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfreetext%3Eyes%3C/freetext%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cselect%3Eno%3C/select%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfield%20queryfield%3D%22/record/alphasortrepresente%2C/record/AuthorOrCreator%2C/record/classification%2C/record/datedPeriod%2C/record/description%2C/record/dimensions%2C/record/localisation%2C/record/medium%2C/record/Numero%2C/record/objectName%2C/record/provenance%2C/record/title%22%20filters%3D%22%22%3ETous%20les%20crit%E8res%3C/field%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cowner%3Eccsearch_fieldselect5_id1%3C/owner%3E%3Ceditor%3Eccsearch_textbox5_id1%3C/editor%3E%3Cfreetextvalue%3E%3C/freetextvalue%3E%3C/searchfield%3E%3Csearchfield%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cvalues/%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfreetext%3Eyes%3C/freetext%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cselect%3Eno%3C/select%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cfield%20queryfield%3D%22/record/alphasortrepresente%2C/record/AuthorOrCreator%2C/record/classification%2C/record/datedPeriod%2C/record/description%2C/record/dimensions%2C/record/localisation%2C/record/medium%2C/record/Numero%2C/record/objectName%2C/record/provenance%2C/record/title%22%20filters%3D%22%22%3ETous%20les%20crit%E8res%3C/field%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cowner%3Eccsearch_fieldselect6_id1%3C/owner%3E%3Ceditor%3Eccsearch_textbox6_id1%3C/editor%3E%3Cfreetextvalue%3E%3C/freetextvalue%3E%3C/searchfield%3E%3Ccrit1%3Eand%3C/crit1%3E%3Ccrit2%3Eand%3C/crit2%3E%3Ccrit3%3Eand%3C/crit3%3E%3Ccrit4%3Eand%3C/crit4%3E%3Ccrit5%3Eand%3C/crit5%3E%3C/fields%3E%3Cowner%3E%3C/owner%3E%3Cfirst%3E${index}%3C/first%3E%3Csort%3EccRelevance%3C/sort%3E%3Cshowtype%3E${showtypes}%3C/showtype%3E%3CresultTarget%3Ecc_results%3C/resultTarget%3E%3CmainFilterQuery%3Edoctype%3Dobject%3C/mainFilterQuery%3E%3Cselects/%3E%3Cfilters%3E%3Cfilter%3E%3Cname%3E%u0152uvres%3C/name%3E%3Cccquery%3Enot%28or%28numero%3DINV%20GRAV%20LP%3Bclassification%3D%5BArchives%5D%29%29%3C/ccquery%3E%3Ctarget%3Eccfilter_oevres%3C/target%3E%3Cgroup%3Emainfilters%3C/group%3E%3Cactive%3Etrue%3C/active%3E%3CdefaultActive%3Etrue%3C/defaultActive%3E%3C/filter%3E%3Cfilter%3E%3Cname%3EGravures%20Louis-Philippe%3C/name%3E%3Cccquery%3Enumero%3DINV%20GRAV%20LP%3C/ccquery%3E%3Ctarget%3Eccfilter_gravures%3C/target%3E%3Cgroup%3Emainfilters%3C/group%3E%3Cactive%3Efalse%3C/active%3E%3CdefaultActive%3Efalse%3C/defaultActive%3E%3C/filter%3E%3Cfilter%3E%3Cname%3EArchives%3C/name%3E%3Cccquery%3Eclassification%3D%5BArchives%5D%3C/ccquery%3E%3Ctarget%3Eccfilter_archives%3C/target%3E%3Cgroup%3Emainfilters%3C/group%3E%3Cactive%3Efalse%3C/active%3E%3CdefaultActive%3Efalse%3C/defaultActive%3E%3C/filter%3E%3C/filters%3E%3Cfacets%3E%3Cfacet%3E%3Cname%3EDomaine%20de%20collections%3C/name%3E%3Cidentifier%3Efacet_domaines%3C/identifier%3E%3Cfacettags%3E/record/classification%3C/facettags%3E%3Ctarget%3Eccfacet_domaines%3C/target%3E%3CdefaultShown%3E5%3C/defaultShown%3E%3CmaxShown%3E20%3C/maxShown%3E%3CallowCollapse%3Eyes%3C/allowCollapse%3E%3CallowPopup%3Eyes%3C/allowPopup%3E%3ClimitsResults%3Eno%3C/limitsResults%3E%3CthesaurusNodeStartValue%3E%3C/thesaurusNodeStartValue%3E%3CthesaurusChildNodes%3E%3C/thesaurusChildNodes%3E%3CthesaurusNodeXPath%3E%3C/thesaurusNodeXPath%3E%3CthesaurusNodeQuery%3E%3C/thesaurusNodeQuery%3E%3Cmask%3E%3C/mask%3E%3Cselected/%3E%3C/facet%3E%3Cfacet%3E%3Cname%3EAuteur%3C/name%3E%3Cidentifier%3Efacet_creator%3C/identifier%3E%3Cfacettags%3E/record/AuthorOrCreator%3C/facettags%3E%3Ctarget%3Eccfacet_creator%3C/target%3E%3CdefaultShown%3E5%3C/defaultShown%3E%3CmaxShown%3E15%3C/maxShown%3E%3CallowCollapse%3Eyes%3C/allowCollapse%3E%3CallowPopup%3Eyes%3C/allowPopup%3E%3ClimitsResults%3Eno%3C/limitsResults%3E%3CthesaurusNodeStartValue%3E%3C/thesaurusNodeStartValue%3E%3CthesaurusChildNodes%3E%3C/thesaurusChildNodes%3E%3CthesaurusNodeXPath%3E%3C/thesaurusNodeXPath%3E%3CthesaurusNodeQuery%3E%3C/thesaurusNodeQuery%3E%3Cmask%3E%3C/mask%3E%3Cselected/%3E%3C/facet%3E%3Cfacet%3E%3Cname%3ED%E9signation%3C/name%3E%3Cidentifier%3EobjectName%3C/identifier%3E%3Cfacettags%3E/record/objectName%3C/facettags%3E%3Ctarget%3Eccfacet_objectName%3C/target%3E%3CdefaultShown%3E5%3C/defaultShown%3E%3CmaxShown%3E20%3C/maxShown%3E%3CallowCollapse%3Eyes%3C/allowCollapse%3E%3CallowPopup%3Eyes%3C/allowPopup%3E%3ClimitsResults%3Eno%3C/limitsResults%3E%3CthesaurusNodeStartValue%3E%3C/thesaurusNodeStartValue%3E%3CthesaurusChildNodes%3E%3C/thesaurusChildNodes%3E%3CthesaurusNodeXPath%3E%3C/thesaurusNodeXPath%3E%3CthesaurusNodeQuery%3E%3C/thesaurusNodeQuery%3E%3Cmask%3E%3C/mask%3E%3Cselected/%3E%3C/facet%3E%3Cfacet%3E%3Cname%3EEmplacement%3C/name%3E%3Cidentifier%3Elocalisation%3C/identifier%3E%3Cfacettags%3E/record/localisation%3C/facettags%3E%3Ctarget%3Eccfacet_localisation%3C/target%3E%3CdefaultShown%3E5%3C/defaultShown%3E%3CmaxShown%3E20%3C/maxShown%3E%3CallowCollapse%3Eyes%3C/allowCollapse%3E%3CallowPopup%3Eyes%3C/allowPopup%3E%3ClimitsResults%3Eno%3C/limitsResults%3E%3CthesaurusNodeStartValue%3E%3C/thesaurusNodeStartValue%3E%3CthesaurusChildNodes%3E%3C/thesaurusChildNodes%3E%3CthesaurusNodeXPath%3E%3C/thesaurusNodeXPath%3E%3CthesaurusNodeQuery%3E%3C/thesaurusNodeQuery%3E%3Cmask%3E%3C/mask%3E%3Cselected/%3E%3C/facet%3E%3C/facets%3E%3Cbasket%3E%3Cactive%3Efalse%3C/active%3E%3C/basket%3E%3Cresources%3ETerugSelect%3DActiver%0ATerugAdvanced%3DRecherche%0AKies%3DVoir%20liste%0AZoek%3DLancer%0AGeavanceerd%3DCrit%E8res%20avanc%E9s%0AOpnieuw%3DEffacer%0AToon%3DMontrer%0AAlle%3Dtous%0Aalle%3Dtous%0Awaardes%2C%20of%20waardes%20die%20beginnen%20met%20de%20letter%3DDes%20valeurs%2C%20ou%20des%20valeurs%20qui%20commencent%20par%20la%20lettre%0AToon%20alleen%20de%20waardes%20met%20de%20volgende%20zoekterm%3DAfficher%20uniquement%20les%20valeurs%20avec%20le%20terme%20de%20recherche%20ci-dessous%26lt%3Bbr%20/%26gt%3B%0AVerwijder%20de%20zoekterm%3DEffacer%20le%20mot-cl%E9%0ASelecteer%20allemaal%3DS%E9lectionnez%20tous%0Apagina%3Dpage%0APagina%3DPage%0AEerste%3DPremi%E8re%0AVorige%3Dpr%E9c%E9dent%0AVolgende%3Dsuivant%0ALaatste%3DDernier%0AU%20heeft%20gezocht%20op%3D%26lt%3Bdiv%20class%3D%22pagetitle%22%26gt%3BVotre%20recherche%26lt%3B/div%26gt%3B%26lt%3Bdiv%20class%3D%22imprimerchapitre%22%26gt%3B%26lt%3Bspan%20onclick%3D%22%24%28%27%23print-dialog-form%27%29.dialog%28%27open%27%29%3B%20return%20false%3B%22%20style%3D%22margin-left%3A%2025px%3B%22%26gt%3BImprimer%26lt%3B/span%26gt%3B%26lt%3Bspan%20style%3D%22margin-left%3A%2025px%3B%22%26gt%3B%26lt%3Bdiv%20style%3D%22position%3A%20absolute%3B%20margin-left%3A%20615px%3B%20margin-top%3A%20-16px%3B%22%20onclick%3D%22addPermalinkToQuery%28%29%3B%20return%20false%3B%22%20%26gt%3BPartager%20cette%20page%26amp%3Bnbsp%3B%26amp%3Bnbsp%3B%26amp%3Bnbsp%3B%26lt%3Bimg%20style%3D%22width%3A16px%3Bheight%3A15px%3Bvertical-align%3Amiddle%22%20title%3D%22Lien%20permanent%22%20alt%3D%22Lien%20permanent%22%20src%3D%22images/sharesmall.png%22%20/%26gt%3B%26lt%3B/div%26gt%3B%26lt%3B/span%26gt%3B%26lt%3B/div%26gt%3B%0Agevonden%3Dtrouv%E9%0Agetoond%3Dmontr%E9%0Avan%3Dde%0AToon%20als%3Dmontrent%20que%0Aimages%3D%26lt%3Bspan%20style%3D%22position%3A%20relative%3B%20margin-top%3A%205px%3B%20margin-right%3A%200px%3B%20%22%26gt%3B%26lt%3Bimg%20style%3D%22position%3A%20relative%3B%20top%3A%206px%3B%20width%3A%2018px%3B%20height%3A%2020px%3B%20cursor%3A%20pointer%3B%20border%3A%200px%3B%22%20src%3D%22images/mur-images.jpg%22%20/%26gt%3B%26lt%3B/span%26gt%3B%26amp%3Bnbsp%3B%26amp%3Bnbsp%3B%0ALijst%3D%26lt%3Bimg%20style%3D%22margin-top%3A%205px%3B%20margin-right%3A%2015px%3B%20width%3A%2065px%3B%20height%3A%2029px%3B%20cursor%3A%20pointer%3B%20border%3A%200px%3B%22%20src%3D%22images/viewtype_images_text.gif%22%20/%26gt%3B%0ADia%27s%3D%26lt%3Bspan%20style%3D%22position%3A%20relative%3B%20margin-top%3A%205px%3B%20margin-right%3A%200px%3B%22%26gt%3B%26lt%3Bimg%20style%3D%22position%3A%20relative%3B%20top%3A%206px%3B%20width%3A%2018px%3B%20height%3A%2020px%3B%20cursor%3A%20pointer%3B%20border%3A%200px%3B%22%20src%3D%22images/mur-images_desactivated.jpg%22%20/%26gt%3B%26lt%3B/span%26gt%3B%26amp%3Bnbsp%3B%26amp%3Bnbsp%3B%0ARecord%3DDetail%0Aalle%20records%3DTous%20les%20records%0AAlleen%20de%20records%20in%20uw%20selectie%20worden%20getoond%3DSeuls%20les%20enregistrements%20dans%20votre%20s%E9lection%20sont%20affich%E9s%0AzoekEn%3Det%0AzoekOf%3Dou%0AzoekMaarNiet%3Dpas%0AsortOn%3DTris%0ATyp%20hier%20uw%20zoekvraag%3DSaisir%20la%20recherche%0ASpecificeer%20meerdere%20zoekwaarden%3DSp%E9cifiez%20les%20valeurs%20de%20recherche%0ASelecteer%20zoekwaarde%28n%29%3DS%E9lectionner%20des%20crit%E8res%20de%20recherche%0AZoeken%20door%3DRechercher%20par%0AGeen%20Filter%3DPas%20de%20filtre%0Ahits%3Dr%E9sultats%0AFilters%20are%20active%3D%26lt%3Bspan%20style%3D%22font-family%3A%20Georgia%2C%20Times%20New%20Roman%2C%20Times%2C%20serif%3B%20font-weight%3A%20bold%3B%20font-size%3A%2011px%3B%22%26gt%3BSUPPRIMER%20LES%20FILTRES%26lt%3B/span%26gt%3B%0Aund%3Det%0Aoder%3Dou%0Anicht%3Dpas%0ANumber%20of%20records%20to%20print%3DNombre%20d%27objets%20%E0%20imprimer%0APrint%20Dialog%3DImprimer%20la%20recherche%20en%20cours%0APrint%20button%3DImprimer%0ACancelButton%3DAnnuler%3C/resources%3E%3C/ccQuery%3E`,
    };
  }
}

VersaillesCrawler.id = 'versailles';

module.exports = VersaillesCrawler;
