import createJob from './job-arpege.js'
import { getEnvArray } from './utils.js'

const dataSource = process.env.DATA_SOURCE || 'meteofrance'
// Don't go back in time older than 1 day
const oldestRunIntervalMs = (process.env.OLDEST_RUN_INTERVAL_MS ? Number(process.env.OLDEST_RUN_INTERVAL) : 24 * 3600 * 1000)

export default createJob({
  id: `arpege-world-${dataSource}`,
  resolution: dataSource === 'data-gouv' ? '025' : '0.25',
  format: 'grib2',
  runTimes:  getEnvArray('RUN_TIMES', ['00:00:00', '06:00:00', '12:00:00', '18:00:00']),
  packages: getEnvArray('PACKAGES', ['HP1', 'HP2', 'IP1', 'IP2', 'IP3', 'IP4', 'SP1', 'SP2']),
  forecastTimes: getEnvArray('FORECAST_TIMES', ['000H024H', '025H048H', '049H072H', '073H102H' ]),
  oldestRunIntervalMs
})