import _ from 'lodash'
import moment from 'moment'

export function getEnvArray (key, defaults) {
	if (_.isUndefined(process.env[key]) || _.isEmpty(process.env[key])) return defaults
	// Transform comma-separated string into array
	const values = process.env[key].split(',').map(value => value.trim())
	// check if every value is in the default array
	if (!_.every(values, value => _.includes(defaults, value))) return defaults
  return values
}

export function getReferenceTimes (runTimes, oldestRunIntervalMs) {
  const now = moment().utc()
	const referenceTimes = []
	// Calculate how many days we must look back + margin
  const daysBack = Math.ceil(oldestRunIntervalMs / 86400000) + 1
	// Loop through each day
	for (let dayOffset = 0; dayOffset <= daysBack; dayOffset++) {
		// Get the start of that day
    const day = moment(now).utc().startOf('day').subtract(dayOffset, 'days')
    for (const runTime of runTimes) {
			// Build the full datetime by adding 
      const time = moment(day).add(moment.duration(runTime))
			// Compute how old this run time is compared to now
      const age = now.diff(time)
			// Keep it only if it is in the past and inside the allowed interval
      if (age >= 0 && age <= oldestRunIntervalMs) referenceTimes.push(time.format('YYYY-MM-DDTHH:mm:ss[Z]'))
    }
  }

  return referenceTimes
}