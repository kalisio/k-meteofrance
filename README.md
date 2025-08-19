# k-meteofrance

[![Latest Release](https://img.shields.io/github/v/tag/kalisio/k-meteofrance?sort=semver&label=latest)](https://github.com/kalisio/k-meteofrance/releases)
[![CI](https://github.com/kalisio/k-meteofrance/actions/workflows/main.yaml/badge.svg)](https://github.com/kalisio/k-meteofrance/actions/workflows/main.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Krawler](https://kalisio.github.io/krawler/) based service to download diverse datasets from the public [Météo-France API portal](https://portail-api.meteofrance.fr/web/fr/)

## paquetobs

The **paquetobs** job files enable the scraping of [real-time observations](https://donneespubliques.meteofrance.fr/?fond=produit&id_produit=93&id_rubrique=32) from all weather 
stations of the French network at hourly and/or sub-hourly intervals (every 6 minutes). These data are exposed by the public API [Package Observations](https://portail-api.meteofrance.fr/web/fr/api/DonneesPubliquesPaquetObservation).

This repository provides with 2 jobs:

### paquetobs-stations

#### Description

This job allows to scape the stations. The main collected properties are:
* **id**, the id of the station
* **name**, the name of the station
* **location**, the location of the station

The station data are stored in compliance with the **GeoJSON** standard.

#### Configuration

| Variable | Description |
|--- | --- |
| `PAQUETOBS_TOKEN` | The token to use the **paquetobs** API |
| `DEPARTMENTS` | The list of departments used to filter the collected observations, e.g, `"11,09,31"` |
| `STATIONS` | The list of station ids used to filter the collected observations, e.g, `"09099001,09301001"` |
| `DB_URL` | the database url. By default: `mongodb://localhost:27017/meteofrance`. |
| `DEBUG` | Enables debug output. Set it to `krawler*` to enable full output. By default it is undefined. |

### paquetobs-observations

#### Description

This job allows to scape the observations. The basic collected properties are:
* **id**, the id of the station
* **name**, the name of the station
* **temperature** (°),
* **humidity** (%),
* **wind direction** (°),
* **wind speed** (m/s),
* **precipitation** (mm/h)

The observation data are stored in compliance with the **GeoJSON** standard.

#### Configuration

| Variable | Description |
|--- | --- |
| `PAQUETOBS_TOKEN` | The **paquetobs** API token. |
| `FREQUENCY` | The frequency of the observations to collect. It must be `horaire` or `infrahoraire-6m`. Default value is `horaire`. |
| `LATENCY` | The latency of the observations to collect. It must be `horaire` or `infrahoraire-6m`. Default value is `horaire`. |
| `TTL` | The retention period in seconds of the data. By default: `7 * 24 * 60 * 60` (~7 days) |
| `DB_URL` | the database url. By default: `mongodb://localhost:27017/meteofrance`. |
| `DEBUG` | Enables debug output. Set it to `krawler*` to enable full output. By default it is undefined. |

## Deployment

We personally use [Kargo](https://kalisio.github.io/kargo/) to deploy the service.

## Contributing

Please refer to [contribution section](./CONTRIBUTING.md) for more details.

## Authors

This project is sponsored by 

![Kalisio](https://s3.eu-central-1.amazonaws.com/kalisioscope/kalisio/kalisio-logo-black-256x84.png)

## License

This project is licensed under the MIT License - see the [license file](./LICENSE) for details
