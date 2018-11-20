# crawler
SILKNOW crawler that collects metadata records describing silk material from various museums.

## How to run
The crawler takes one paramater: the name of the museum to be crawled. For example:
```
node . mfa-boston
```

## List of museums
* `ceres-mcu` - Red Digital de Colecciones de Museos de España
* `imatex` - Centre de Documentació i Museu Tèxtil
* `joconde` - Collections des musées de France : Joconde
* `les-arts-decoratifs` - Musée des Arts Décoratifs
* `met-museum` - The Metropolitan Museum of Art
* `mfa-boston` - Museum of Fine Arts, Boston
* `mtmad` - Musée des Tissus
* `risd-museum` - Rhode Island School of Design Museum

## Development
Add the environment variable `DEBUG=silknow:*` to also output the debug logs.
