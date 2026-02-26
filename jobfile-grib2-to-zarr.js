import _ from 'lodash'
import winston from 'winston'
import { hooks } from  '@kalisio/krawler'
import fs from 'fs'
import path from 'path'

// Job configuration
const outputDir = process.env.OUTPUT_DIR || './output'
const workersLimit = process.env.WORKERS_LIMIT ? Number(process.env.WORKERS_LIMIT) : 2
const model = process.env.MODEL || 'arpege'

// Register generateTasks hook
const generateTasks = () => {
	return function (hook) {
		const directoryEntries = fs.readdirSync(outputDir, { withFileTypes: true })
		const tasks = []
		for (const entry of directoryEntries) {
			const folderName = entry.name
			const folderFullPath = path.join(outputDir, folderName)
			// List the contents of the folder
			const filesInFolder = fs.readdirSync(folderFullPath)
			// Check if there is a .grib2 file
      const hasGrib2 = filesInFolder.some(file => file.endsWith('.grib2'))
			// Check if there is a DONE.txt file
      const hasDoneFile = filesInFolder.includes('DONE.txt')
			if (hasGrib2 && !hasDoneFile) tasks.push({ id: folderFullPath, folderName })
		}	
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
					// TODO 
					// convert grib2 to zaar only files with a .grib2 extension and add a Done.txt file if all files are present ( can be done via an env)
          command: `./conversion_tool new-dataset --templates-path ../templates.json -t ${model} --data-mapping cells -c "{\"version\": 2}" -o s3://mf/tests/s3/${item.folderName}.zarr dummy-id ${item.id}`,
					stdout: true,
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
