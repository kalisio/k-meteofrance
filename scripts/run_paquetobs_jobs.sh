#!/usr/bin/env bash
set -euo pipefail

# run stations job
export DEPARTMENTS="11,09"
export STATIONS="1014002"
krawler ./jobfile.paquetobs-stations.js
# run hourly observations job
export FREQUENCY="horaire"
export LATENCY="30"
krawler ./jobfile.paquetobs-observations.js
# run subhourly observations job
export FREQUENCY="infrahoraire-6m"
export LATENCY="10"
krawler ./jobfile.paquetobs-observations.js
