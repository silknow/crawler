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
| --list-fields | Returns a list of unique fields from JSON records |

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

Crawled JSON structure of each museum can be found [here](https://github.com/silknow/crawler/wiki/Crawlers-JSON-Structure)

### Notes about UNIPA

The UNIPA crawler requires the raw data as CSV files. The data has to be stored in `data/unipa/resources`. The structure is as follow:

```csv
fieldLabel,fieldValue
```

**Note:** if the field name is equal to `Images (names of the images in the document)`, then the field value will be considered as an image URL.

## Development
Add the environment variable `DEBUG=silknow:*` to also output the debug logs.
