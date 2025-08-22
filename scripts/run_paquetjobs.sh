#!/usr/bin/env bash
set -euo pipefail

export FREQUENCY="horaire"
export LATENCY="0"
export TTL="604800"
krawler ./jobfile.paquetobs-observations.js
export DEPARTMENTS="11,09"
export STATIONS="1014002"
krawler ./jobfile.paquetobs-stations.js