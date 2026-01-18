import createJob from './job-arpege.js'

const dataSource = process.env.DATA_SOURCE || 'meteofrance'

export default createJob({
  id: `arpege-world-${dataSource}`,
  resolution: dataSource === 'data-gouv' ? '025' : '0.25',
  format: 'grib2',
  runTimes: ['00:00:00', '06:00:00', '12:00:00', '18:00:00'],
  packages: ['HP1', 'HP2', 'IP1', 'IP2', 'IP3', 'IP4', 'SP1', 'SP2'],
  forecastTimes: ['000H012H', '013H024H', '025H036H', '037H048H', '049H060H', '061H072H', '073H084H', '073H084H', '085H096H', '097H102H']
})