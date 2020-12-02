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

## List of museums
* `ceres-mcu` - Red Digital de Colecciones de Museos de España
* `imatex` - Centre de Documentació i Museu Tèxtil
* `joconde` - Collections des musées de France : Joconde
* `les-arts-decoratifs` - Musée des Arts Décoratifs
* `met-museum` - The Metropolitan Museum of Art
* `mfa-boston` - Museum of Fine Arts, Boston
* `mtmad` - Musée des Tissus
* `risd-museum` - Rhode Island School of Design Museum
* `vam` - Victoria and Albert Museum
* `unipa` - Museo Diocesano Di Palermo
* `mobilier-international` - Collection of the Mobilier national in France
* `smithsonian` - Smithsonian Institution
* `paris-musees` - Paris Musées

Crawled JSON structure of each museum can be found [here](https://github.com/silknow/crawler/wiki/Crawlers-JSON-Structure)

### Notes about UNIPA

The UNIPA crawler parses local files only. It requires a database.json along with an images folder. The data has to be stored in `data/unipa/resources`.

Link to the dataset: https://www.dropbox.com/sh/a8zzv22r59q67eq/AAB4SOAGf1byLFwakYkzbcYFa?dl=0

### Notes about Paris Musées

The Paris Musées API requires to generate a token by following the [Paris Musées API documentation](https://www.parismuseescollections.paris.fr/fr/se-connecter-a-l-api).

Once a token has bene obtained, add the environment variable `PARIS_MUSEES_TOKEN=<token>` (replace `<token>` with the token) before running the crawler.

## Development
Add the environment variable `DEBUG=silknow:*` to also output the debug logs.
