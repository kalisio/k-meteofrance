import winston from 'winston'
import _ from 'lodash'

const TOKEN = process.env.PAQUETOBS_TOKEN
const DEPARTMENTS = process.env.DEPARTMENTS && process.env.DEPARTMENTS.split(',')
const STATIONS = process.env.STATIONS && process.env.STATIONS.split(',')
const DB_URL = process.env.DB_URL || 'mongodb://127.0.0.1:27017/meteofrance'
const STATIONS_COLLECTION = 'mf-paquetobs-stations'
const OUTPUT_DIR = './output'

export default {
  id: 'paquetobs-stations',
  store: 'fs',
  options: {
    workersLimit: 1,
    faultTolerant: true,
  },
  tasks: [{
    id: 'paquetobs-stations',
    type: 'http',
    options: {
      url: 'https://public-api.meteofrance.fr/public/DPPaquetObs/v1/liste-stations',
      headers: {
        accept: '*/*',
        apikey: TOKEN
      }
    }
  }],
  hooks: {
    tasks: {
      after: {
        readCSV: {
          header: true,
          transform: {
            mapping: {
              Id_station: 'stationId',
              Id_omm: 'ommId',
              Nom_usuel: 'name',              
              Date_ouverture: 'openingDate',
              Pack: 'pack'
            }
          }
        },
        apply: {
          function: (item) => {
            let stations = item.data
            // filter by departments
            let departmentStations = []
            const departmentIds = _.map(DEPARTMENTS, department => {
              const prefix = department.trim().padStart(2, '0')
              if (prefix !== '00' && /^\d{2}$/.test(prefix)) return prefix
            })
            if (!_.isEmpty(departmentIds)) {
              departmentStations = stations.filter(station =>
                departmentIds.some(prefix => (station.stationId).startsWith(prefix))
              )
            }
            // filter by stations
            let specificStations = []            
            const stationIds = _.map(STATIONS, station => station.trim())
            if (!_.isEmpty(stationIds)) {
              specificStations = stations.filter(station =>
                stationIds.includes((station.stationId))
              )
            }
            if (!_.isEmpty(departmentStations) || !_.isEmpty(specificStations)) {
              item.data = _.concat(specificStations, departmentStations)
            }
            _.forEach(item.data, station => {
              station.stationId = _.toNumber(station.stationId)
            })
          }
        },
        log: (logger, item) => logger.info(`${item.data.length} stations found.`),
        convertToGeoJson: {
          longitude: 'Longitude',
          latitude: 'Latitude',
          altitude: 'Altitude'
        },
        updateMongoCollection: {
          collection: STATIONS_COLLECTION,
          filter: { 'properties.stationId': '<%= properties.stationId %>' },
          upsert : true,
          chunkSize: 256
        },
        clearData: {}
      }
    },
    jobs: {
      before: {
        printEnv: {
          DEPARTMENTS,
          STATIONS,
        },
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
          collection: STATIONS_COLLECTION,
          indices: [
            [{ 'properties.stationId': 1 }, { unique: true }], 
            { geometry: '2dsphere' }
          ]
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
