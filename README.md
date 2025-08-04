# k-meteofrance

[![Latest Release](https://img.shields.io/github/v/tag/kalisio/k-meteofrance?sort=semver&label=latest)](https://github.com/kalisio/k-meteofrance/releases)
[![CI](https://github.com/kalisio/k-meteofrance/actions/workflows/main.yaml/badge.svg)](https://github.com/kalisio/k-meteofrance/actions/workflows/main.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Krawler](https://kalisio.github.io/krawler/) based service to download diverse datasets from the public [Météo-France API portal](https://portail-api.meteofrance.fr/web/fr/)

## paquetobs jobs

The **paquetobs** job files enable the scraping of real-time observations from all weather stations exposed by the public API [Package Observations](https://portail-api.meteofrance.fr/web/fr/api/DonneesPubliquesPaquetObservation).

### stations

| Variable | Description |
|--- | --- |
| `DEPARTMENTS` | The list of departments used to filter the collected stations. |
| `DEBUG` | Enables debug output. Set it to `krawler*` to enable full output. By default it is undefined. |

### observations

| Variable | Description |
|--- | --- |
| `FREQUENCY` | The frequency of the observations to collect. It must be `horaire` or `infrahoraire-6m`. Default value is `horaire`. |
| `LATENCY` | The latency of the observations to collect. It must be `horaire` or `infrahoraire-6m`. Default value is `horaire`. |
| `DEPARTMENTS` | The list of departments used to filter the collected observations. |
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
