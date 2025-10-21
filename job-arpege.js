import _ from 'lodash'
import winston from 'winston'
import { hooks } from  '@kalisio/krawler'
import moment from 'moment'

// Job configuration
const outputDir = './output'
const workersLimit = process.env.WORKERS_LIMIT ? Number(process.env.WORKERS_LIMIT) : 2
const url = 'https://public-api.meteofrance.fr/previnum/DPPaquetARPEGE/v1/productARP'
const token = process.env.ARPEGE_TOKEN

// Register generateTasks hook
const generateTasks = (options) => {
  return function (hook) {
    const { format, runTimes, packages, forecastTimes } = options
    const tasks = []
    for (const runTime of runTimes) {
      const referencetime = moment().utc().startOf('day').add(moment.duration(runTime)).format('YYYY-MM-DDTHH:mm:ss[Z]')
      for (const pkg of packages) {
        for (const time of forecastTimes) {
          tasks.push({
            referencetime, package: pkg, time, id: `${referencetime}${time}${pkg}.${format}`
          })
        }
      }
    }
    hook.data.tasks = tasks
    return hook
  }
}
hooks.registerHook('generateTasks', generateTasks)

export default (options) => {
  const { id, format, grid } = options
  return {
    id,
    store: 'fs',
    options: {
      workersLimit,
      faultTolerant: true
    },
    taskTemplate: {
      id: '<%= taskId %>',
      type: 'http',
      options: {
        url,
        grid,
        format,
        referencetime: '<%= referencetime %>',
        package: '<%= package %>',
        time: '<%= time %>',
        headers: {
          accept: '*/*',
          apikey: token
        }
      }
    },
    hooks: {
      tasks: {
        before: {
          log: (logger, item) => logger.verbose(`Creating task for ${item.id}`),
        },
        after: {
        },
        error: {
          log: (logger, item) => {
            let errors = []
            if (_.has(item, 'error')) errors = _.get(item, 'error.errors', [_.get(item, 'error')])
            logger.error(`Failed processing ${item.id}: ${errors}`)
          }
        }
      },
      jobs: {
        before: {
          createStores: {
            id: 'fs',
            type: 'fs',
            options: { path: outputDir }
          },
          createLogger: {
            loggerPath: 'taskTemplate.logger',
            Console: {
              format: winston.format.printf(log => winston.format.colorize().colorize(log.level, `${log.level}: ${log.message}`)),
              level: 'verbose'
            }
          },
          generateTasks: options
        },
        after: {
          removeStores: ['fs'],
          removeLogger: {
            loggerPath: 'taskTemplate.logger'
          }
        },
        error: {
          removeStores: ['fs'],
          removeLogger: {
            loggerPath: 'taskTemplate.logger'
          }
        }
      }
    }
  }
}