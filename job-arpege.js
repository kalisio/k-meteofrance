import _ from 'lodash'
import winston from 'winston'
import { hooks } from  '@kalisio/krawler'
import { getReferenceTimes } from './utils.js'
import moment from 'moment'
import fs from 'fs'
import path from 'path'

// Job configuration
const outputDir = process.env.OUTPUT_DIR || './output'
const workersLimit = process.env.WORKERS_LIMIT ? Number(process.env.WORKERS_LIMIT) : 2
const dataSource = process.env.DATA_SOURCE || 'meteofrance'
const meteofranceArpegeToken = process.env.ARPEGE_TOKEN
const meteofranceUrl = 'https://public-api.meteofrance.fr/previnum/DPPaquetARPEGE/v1/productARP'
const dataGouvUrl = 'https://object.files.data.gouv.fr/meteofrance-pnt/pnt'

// Register generateTasks hook
const generateTasks = (options) => {
  return function (hook) {
    const { id, format, resolution, runTimes, packages, forecastTimes, oldestRunIntervalMs } = options
    const alreadyProcessed = _.get(hook, 'data.taskTemplate.alreadyProcessed', [])
    const tasks = []
    const referencetimes = getReferenceTimes(runTimes, oldestRunIntervalMs)
    for (const referencetime of referencetimes) {
      for (const pkg of packages) {
        const folder = `${id}_${resolution}_${pkg}_${referencetime}`
        for (const time of forecastTimes) {
          const id = `${folder}/${pkg}-${time}`
          // Skip this file if it has already been successfully downloaded
          if (_.includes(alreadyProcessed, id)) continue
          const task = { referencetime, package: pkg, time, id }
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
          apply: {
            // Rename file (download without extension → rename to final name after success)
            function: (item) => {
              const { id, options, logger } = item
              const oldPath = path.join(outputDir, id)
              if (fs.existsSync(oldPath)) fs.renameSync(oldPath, `${oldPath}.${options.format}`)
              logger.info(`Task ${id} finished`)
            }
          }
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
          cleanOldData: {
            hook: 'apply',
            function: (item) => {
              const { oldestRunIntervalMs, format } = options
              const alreadyProcessed = []
              const now = moment.utc()
              const oldestAllowedTime = now.clone().subtract(oldestRunIntervalMs, 'milliseconds')
              const directoryEntries = fs.readdirSync(outputDir, { withFileTypes: true })

              for (const entry of directoryEntries) {
                // -------- Deletes folders where reference time is older than oldestRunIntervalMs
                const folderName = entry.name
                const folderFullPath = path.join(outputDir, folderName)
                // Extract reference time
                const lastUnderscoreIndex = folderName.lastIndexOf('_')
                const referenceTimeStr = folderName.slice(lastUnderscoreIndex + 1)
                const referenceTime = moment.utc(referenceTimeStr, 'YYYY-MM-DDTHH:mm:ss[Z]')
                // Delete if invalid or too old
                if (!referenceTime.isValid() || referenceTime.isBefore(oldestAllowedTime)) {
                  fs.rmSync(folderFullPath, { recursive: true, force: true })
                  item.taskTemplate.logger.info(`Deleted old folder: ${folderName}`)
                  continue
                }
                // -------- Builds an array of already successfully processed files
                const filesInFolder = fs.readdirSync(folderFullPath)
                for (const fileName of filesInFolder) {
                  if (!fileName.endsWith(`.${format}`)) continue
                  // Remove extension
                  const baseName = fileName.slice(0, -`.${format}`.length)
                  alreadyProcessed.push(`${folderName}/${baseName}`)
                }
              }
              item.taskTemplate.alreadyProcessed = alreadyProcessed
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