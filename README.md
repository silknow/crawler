# crawler
SILKNOW crawler that collects metadata records describing silk material from various museums.

## Prerequisites
- Node 8+

## How to install
You first need to install dependencies, by using npm:
```
npm install
```

## How to run
The crawler takes one paramater: the name of the museum to be crawled. For example:
```
npm start -- mfa-boston
```
Available parameters:

| Parameter     | Description |
| ------------- | ------------- |
| --no-files | Do not download files such as photos |
| --no-records | Do not write the JSON records |
| --list-fields | Returns a list of unique fields from JSON records. Also takes a --format parameter (values: "md" or "markdown" for Markdown, "json" for JSON, defaults to Markdown) |
| --check-images | Re-download images marked with the `hasError` flag |

## List of museums
* `artic` - 
* `ceres-mcu` - Red Digital de Colecciones de Museos de España
* `europeana` - 
* `gallica` - Gallica
* `garin` - Garín 1820
* `imatex` - Centre de Documentació i Museu Tèxtil
* `joconde` - Joconde Database of French Museum Collections
* `les-arts-decoratifs` - Musée des Arts Décoratifs
* `met-museum` - The Metropolitan Museum of Art
* `mfa-boston` - Boston Museum of Fine Arts
* `mobilier-international` - Collection of the Mobilier national in France
* `mtmad` - Musée des Tissus
* `paris-musees` - Paris Musées
* `risd-museum` - Rhode Island School of Design Museum
* `smithsonian` - Smithsonian
* `unipa` - Sicily Cultural Heritage
* `vam` - Victoria and Albert Museum
* `venezia` - Musei di Venezia
* `versailles` - Versailles

Crawled JSON structure of each museum can be found [here](https://github.com/silknow/crawler/wiki/Crawlers-JSON-Structure)

### Notes about UNIPA

The UNIPA crawler parses local files only. It requires a database.json along with an images folder. The data has to be stored in `data/unipa/resources`.

Link to the dataset: https://www.dropbox.com/sh/a8zzv22r59q67eq/AAB4SOAGf1byLFwakYkzbcYFa?dl=0

### Notes about Paris Musées

The Paris Musées API requires to generate a token by following the [Paris Musées API documentation](https://www.parismuseescollections.paris.fr/fr/se-connecter-a-l-api).

Once a token has bene obtained, add the environment variable `PARIS_MUSEES_TOKEN=<token>` (replace `<token>` with the token) before running the crawler.

### Notes about MET Museum

MET Museum implements an anti-scrapping strategy which requires to first open [this page](https://www.metmuseum.org/api/collection/collectionlisting?perPage=1) into a web browser, then open the browser's inspector and type in the console: `document.cookie` to get the cookies. It should look like this: `"incap_ses_XXX_XXXXXXX=abcDEFgHIjkLmNoPQrSTUvWxyZABCDEFGHijklMNOPqrSTUVwXYZAb=="`.

Finally, add the environment variable `MET_MUSEUM_COOKIE="incap_ses_XXX_XXXXXXX=abcDEFgHIjkLmNoPQrSTUvWxyZABCDEFGHijklMNOPqrSTUVwXYZAb=="` (replace with your own cookie) before running the crawler.

This cookie is only valid for a limited amount of time, but it should be enough to crawl the entire collection.

### Notes about Musée d'Art et d'Industrie (St Etienne)

The Musée d'Art et d'Industrie (St Etienne) crawler parses local files only. It requires a `export silknow.tsv` file along with an `media` folder. The data has to be stored in `data/musee-st-etienne/resources`.

Link to the dataset: https://drive.google.com/drive/folders/1V-p9cJ-lNtUtGHW1ePv_k4rLsd_xbbyb

## Development
Add the environment variable `DEBUG=silknow:*` to also output the debug logs.
