import createJob from './job.arome-arpege.js'

const dataSource = process.env.DATA_SOURCE || 'meteofrance'

export default createJob({
  id: `arome-eurw1s100-${dataSource}`,
  resolution: dataSource === 'data-gouv' ? '001' : '0.01',
  format: 'grib2',
  type: 'arome',
  defaultRunTimes: ['00:00:00','03:00:00','06:00:00','09:00:00','12:00:00','15:00:00','18:00:00','21:00:00'],
  defaultPackages: ['SP1','SP2','SP3','HP1'],
  defaultForecastTimes: [
    '00H','01H','02H','03H','04H','05H','06H','07H','08H','09H',
    '10H','11H','12H','13H','14H','15H','16H','17H','18H','19H',
    '20H','21H','22H','23H','24H','25H','26H','27H','28H','29H',
    '30H','31H','32H','33H','34H','35H','36H','37H','38H','39H',
    '40H','41H','42H','43H','44H','45H','46H','47H','48H','49H','50H'
  ],
})