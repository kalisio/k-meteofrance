import createJob from './job.arome-arpege.js'

const dataSource = process.env.DATA_SOURCE || 'meteofrance'

export default createJob({
  id: `arome-france-${dataSource}`,
  resolution: dataSource === 'data-gouv' ? '0025' : '0.025',
  format: 'grib2',
  model: 'arome',
  defaultRunTimes: ['00:00:00','03:00:00','06:00:00','09:00:00','12:00:00','15:00:00','18:00:00','21:00:00'],
  defaultPackages: ['SP1','SP2','SP3','IP1','IP2','IP3','IP4','IP5','HP1','HP2','HP3'],
  defaultForecastTimes: ['00H06H','07H12H','13H18H','19H24H','25H30H','31H36H','37H42H','43H48H','49H51H'],
})