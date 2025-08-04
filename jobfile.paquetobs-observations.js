import _ from 'lodash'
import moment from 'moment'
import winston from 'winston'

const DB_URL = process.env.DB_URL || 'mongodb://127.0.0.1:27017/kano'
const TOKEN = process.env.OBSERVATIONS_PAQUET_TOKEN
const TTL = +process.env.TTL || (7 * 24 * 60 * 60)  // duration in seconds
const FREQUENCY = process.env.FREQUENCY || 'horaire'
const LATENCY = +process.env.LATENCY || 0
const DEPARTMENTS = process.env.DEPARTMENTS && process.env.DEPARTMENTS.split(',')
const OUTPUT_DIR = './output'
const MEASUREMENTS_COLLECTION = 'mf-observation-measurements'
const STATIONS_COLLECTION = 'mf-observation-stations'

// compute date request according to current time
let DATE = moment().utc().subtract(LATENCY, 'minutes')
if (FREQUENCY === 'horaire') {
  // horaire
  DATE = DATE.startOf('hour').format()
} else if (FREQUENCY === 'infrahoraire-6m') {
  // infra-horaire ~ every 6 minutes
  const minutes = Math.floor(DATE.minutes() / 6) * 6
  DATE = DATE.minutes(minutes).seconds(0).milliseconds(0).format()
} else {
  console.error('Undefined FREQUENCY', FREQUENCY)
  exit(1)
}
const URL = `https://public-api.meteofrance.fr/public/DPPaquetObs/v1/paquet/stations/${FREQUENCY}?date=${DATE}&format=geojson`

console.log('--------------------------------------------')
console.log('FREQUENCY', FREQUENCY)
console.log('LATENCY', LATENCY)
console.log('DEPARTMENTS:', DEPARTMENTS)
console.log('URL:', URL)
console.log('--------------------------------------------')

export default {
  id: 'pquetobs-observations',
  store: 'fs',
  options: {
    workersLimit: 1,
    faultTolerant: true,
  },
  tasks: [{
    id: `paquetobs/observations-${DATE}`,
    type: 'http',
    options: {
      url: URL,
      headers: {
        accept: '*/*',
        apikey: TOKEN
      }
    }
  }],
  hooks: {
    tasks: {
      after: {
        readJson: {},
        log: (logger, item) => logger.info(`${item.data.length} observations found`),
        apply: {
          function: (item) => {
            let observations = []
            // technical description of the data is available here:
            // https://donneespubliques.meteofrance.fr/?fond=produit&id_produit=93&id_rubrique=32
            for (const record of item.data) {
              const station = _.find(item.stations, station => {
                return station.properties.stationId === _.toNumber(record.properties.geo_id_insee)
              })
              if (station) {
                let observation = _.omit(record, ['properties'])
                // time
                const time = record.properties.reference_time
                _.set(observation, 'time', time)
                // station
                _.set(observation, 'properties.stationId', _.toNumber(station.properties.stationId))
                _.set(observation, 'properties.name', station.properties.name)
                // id
                const observationId = `${station.properties.stationId}-${time}`
                _.set(observation, 'properties.observationId', observationId)
                // temperature
                if (!_.isNull(record.properties.t)) {
                  _.set(observation, 'properties.temperature', _.toNumber(record.properties.t) - 273)
                }
                // humidity              
                if (!_.isNull(record.properties.u)) {
                  _.set(observation, 'properties.humidity', _.toNumber(record.properties.u))
                }
                // wind direction
                if (!_.isNull(record.properties.dd)) {
                  _.set(observation, 'properties.windDirection', _.toNumber(record.properties.dd))
                }
                // wind speed
                if (!_.isNull(record.properties.ff)) {
                  _.set(observation, 'properties.windSpeed', _.toNumber(record.properties.ff))
                }
                // precipitation
                if (!_.isNull(record.properties.rr_per)) {
                  _.set(observation, 'properties.humidity', _.toNumber(record.properties.rr_per))
                }
                observations.push(observation)
              }
            }
            item.data = observations
          }
        },
        updateMongoCollection: {
          clientPath: 'client',
          collection: MEASUREMENTS_COLLECTION,
          filter: { 'properties.observationId': '<%= properties.observationId %>' },
          upsert : true,
          chunkSize: 256,
          transform: { 
            unitMapping: { 
              time: { asDate: 'utc' },
            }
          }
        },
        clearData: {}
      }
    },
    jobs: {
      before: {
        createStores: [{
          id: 'memory'
        }, {
          id: 'fs',
          options: {
            path: OUTPUT_DIR
          }
        }],
        createLogger: {
          loggerPath: 'taskTemplate.logger',
          Console: {
            format: winston.format.printf(log => winston.format.colorize().colorize(log.level, `${log.level}: ${log.message}`)),
            level: 'verbose'
          }
        },
        connectMongo: {
          url: DB_URL,
          // Required so that client is forwarded from job to tasks
          clientPath: 'taskTemplate.client'
        },
        createMongoCollection: {
          clientPath: 'taskTemplate.client',
          collection: MEASUREMENTS_COLLECTION,
          indices: [
            { 'properties.observationId': 1 },
            { 'properties.stationId': 1 },
            [{ 'properties.stationId': 1, 'properties.temperature': 1 }, { background: true }],
            [{ 'properties.stationId': 1, 'properties.humidity': 1 }, { background: true }],
            [{ 'properties.stationId': 1, 'properties.windDirection': 1 }, { background: true }],
            [{ 'properties.stationId': 1, 'properties.windSpeed': 1 }, { background: true }],
            [{ 'properties.stationId': 1, 'properties.precipitations': 1 }, { background: true }],
            [{ time: 1, 'properties.observationId': 1 }, { unique: true }],          
            [{ time: 1 }, { expireAfterSeconds: TTL }], // days in s  
            { geometry: '2dsphere' }
          ]
        },
        readMongoCollection: {
          clientPath: 'taskTemplate.client',
          collection: STATIONS_COLLECTION,
          dataPath: 'data.taskTemplate.stations'
        }
      },
      after: {
        disconnectMongo: {
          clientPath: 'taskTemplate.client'
        },
        removeLogger: {
          loggerPath: 'taskTemplate.logger'
        },
        removeStores: ['memory', 'fs']
      },
      error: {
        disconnectMongo: {
          clientPath: 'taskTemplate.client'
        },
        removeLogger: {
          loggerPath: 'taskTemplate.logger'
        },
        removeStores: ['memory', 'fs']
      }
    }
  }
}
