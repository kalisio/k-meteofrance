import _ from 'lodash'
import winston from 'winston'
import { hooks } from  '@kalisio/krawler'
import moment from 'moment'
import fs from 'fs'

// Job configuration
const outputDir = './output'
const workersLimit = process.env.WORKERS_LIMIT ? Number(process.env.WORKERS_LIMIT) : 2
const dataSource = process.env.DATA_SOURCE || 'meteofrance'
const meteofranceArpegeToken = process.env.ARPEGE_TOKEN
const meteofranceUrl = 'https://public-api.meteofrance.fr/previnum/DPPaquetARPEGE/v1/productARP'
const dataGouvUrl = 'https://object.files.data.gouv.fr/meteofrance-pnt/pnt'

// Register generateTasks hook
const generateTasks = (options) => {
  return function (hook) {
    const { format, resolution, runTimes, packages, forecastTimes } = options
    const tasks = []
    for (const runTime of runTimes) {
      const referencetime = moment().utc().startOf('day').add(moment.duration(runTime)).format('YYYY-MM-DDTHH:mm:ss[Z]')
      for (const pkg of packages) {
        for (const time of forecastTimes) {
          const task = { referencetime, package: pkg, time, id: `${referencetime}${time}${pkg}.${format}` }
          if (dataSource === 'data-gouv') {
            task.url = [
              dataGouvUrl,
              referencetime,
              'arpege',
              resolution,
              pkg,
              `arpege__${resolution}__${pkg}__${time}__${referencetime}.${format}`
            ].join('/')
          }
          tasks.push(task)
        }
      }
    }
    hook.data.tasks = tasks
    return hook
  }
}
hooks.registerHook('generateTasks', generateTasks)

export default (options) => {
  const { id, format, resolution } = options

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
      options: dataSource === 'data-gouv'
        ? { 
          // -------- DATA.GOUV --------
          url: '<%= url %>'
        }
        : { 
          // -------- METEOFRANCE --------
          url: meteofranceUrl,
          grid: resolution,
          format,
          referencetime: '<%= referencetime %>',
          package: '<%= package %>',
          time: '<%= time %>',
          headers: {
            accept: '*/*',
            apikey: meteofranceArpegeToken
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
          log: async (logger, item) => {
            let errors = []
            if (_.has(item, 'error')) errors = _.get(item, 'error.errors', [_.get(item, 'error')])
            logger.error(`Failed processing ${item.id}: ${errors}`)
            const statusCode = _.get(item, 'error.statusCode')
            // Remove generated file
            const filePath = `${outputDir}/${item.id}`
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
            // HTTP 404 handling
            if (statusCode === 404) {
              logger.warn(`[WARN] 404 on task ${item.id} → waiting 15s before continuing...`)
              await new Promise(resolve => setTimeout(resolve, 15000))
            }
            // HTTP 429 handling
            if (statusCode === 429) {
              logger.error('[ERROR] 429 (rate limit) → rate limit reached, stopping job to avoid ban')
              process.exit(1)
            }
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