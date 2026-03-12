import _ from 'lodash'
import winston from 'winston'
import { hooks } from  '@kalisio/krawler'
import fs from 'fs'
import path from 'path'

// Convert an environment variable string to an array
function getEnvArray (key) {
  if (_.isUndefined(process.env[key]) || _.isEmpty(process.env[key])) return []
  // Transform comma-separated string into array
  return process.env[key].split(',').map(value => value.trim())
}

// Job configuration
const outputDir = process.env.OUTPUT_DIR || './output'
const workersLimit = process.env.WORKERS_LIMIT ? Number(process.env.WORKERS_LIMIT) : 1
const model = process.env.MODEL || 'arpege'
const s3DatasetsRoot = process.env.S3_DATASETS_ROOT || 's3://mf/tests/s3/'
const packages = getEnvArray('PACKAGES')
const forecastTimes = getEnvArray('FORECAST_TIMES')

// Register generateTasks hook
const generateTasks = () => {
	return function (hook) {
		const directoryEntries = fs.readdirSync(outputDir, { withFileTypes: true })
    // Build expected filenames
    const expectedFiles = []
    for (const pkg of packages) {
      for (const forecastTime of forecastTimes) {
        expectedFiles.push(`${pkg}-${forecastTime}.grib2`)
      }
    }
		const tasks = []
		for (const entry of directoryEntries) {
      let task = { id: 'undefined', done: false }
			const folderName = entry.name
			const folderFullPath = path.join(outputDir, folderName)
			// Read all files in the current folder
			const filesInFolder = fs.readdirSync(folderFullPath)
      // Check for GRIB2 files and DONE.txt
      const gribFiles = filesInFolder.filter(file => file.endsWith('.grib2'))
      const hasGrib2 = gribFiles.length > 0
      const hasDoneFile = filesInFolder.includes('DONE.txt')
      if (hasDoneFile) continue
      // If folder has GRIB2 files but no DONE.txt, create a task
			if (hasGrib2 && !hasDoneFile) task = { id: folderFullPath, folderName }
      // Check if folder contains all expected GRIB2 files and no extra files
      const hasAllExpected = expectedFiles.every(file => gribFiles.includes(file))
      const hasNoExtraFiles = gribFiles.every(file => expectedFiles.includes(file))
      // Mark folder as completed if all files are present
      if (gribFiles.length === expectedFiles.length  && hasAllExpected && hasNoExtraFiles) task.done = true
      tasks.push(task)
		}
    // Attach the generated tasks to the hook
		hook.data.tasks = tasks
		return hook
	}
}
hooks.registerHook('generateTasks', generateTasks)

export default {
  id: 'grib2-to-zarr',
  store: 'fs',
  options: {
    workersLimit,
    faultTolerant: true,
  },
  tasks: [{
		id: '<%= taskId %>',
		type: 'noop',
    store: 'fs'
  }],
  hooks: {
    tasks: {
			before: {
				log: (logger, item) => logger.verbose(`Creating task for ${item.id}`),
			},
      after: {
        grib2ToZarr: {
          hook: 'runCommand',
          command: [
						'./conversion_tool new-dataset', 
						'--templates-path ./templates.json', 
						`-t ${model}`, 
						'--data-mapping cells', 
						"-c '{\"version\": 2}'", 
						`-o ${s3DatasetsRoot}<%= folderName.replace(/^([^-]+)[^_]+_([^_]+)_(.+)$/, "$1/$2/$3") %>.zarr`, 
						'dummy-id <%= id %>'
					].join(' '),
					stdout: true,
					stderr: true
        },
        apply: {
          // Mark folder as completed if all files are present
          function: (item) => {
            const { id, logger, done } = item
            if (!logger || !id) return
            if (done) {
              const doneFilePath = path.join(id, 'DONE.txt')
              fs.writeFileSync(doneFilePath, 'COMPLETED\n')
              logger.info(`Task ${id} marked as completed`)
            }
            logger.info(`Task ${id} finished`)
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
				generateTasks:  {}
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
