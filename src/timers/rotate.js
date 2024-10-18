import { argumentError, timerError, parseServerDateTime, validateTimeStrings, validateDurationTimeStrings, convertToRealtimeDuration } from '../utils.js';

/**
 * The rotate timer will go through the param list in order. The following settings are expected in args:
 * 
 * epoch: a time the rotation started at index 0. For example: "2016-01-31T00:00:00.000S". The S means server time (as opposed to Erinn time). An epoch should be in server time.
 * 
 * changeAt: a value or multiple values. Each value is the time to rotate the timer to the next item in the list. For example {6:00E}{8:00E}{12:00E}, or {6:00S}{8:00:00.000S}, or 6:00:00S. Can also be "sunshift".
 * 
 * changeEvery: an interval for how often to rotate. For example 6:00S (every 6 server time hours), or 6:00:00.000S (still every 6 server time hours), or 2:00E (every 2 Erinn time hours)
 * 
 * @param {object} display
 * @param {object.<string, string[]>} args - an object with the key=value pairs from the settings of the timer in the HTML. key is a string, value is an array of strings.
 * @param {string[]} list - an array of strings with the contents of each li HTML element in any ol/ul HTML element in the timer.
 * @returns
 */
export function rotateTimer (display, args, list) {
    // make sure the required arguments are present and in the correct amounts
	if(!('epoch' in args)) return argumentError('Rotate type requires an epoch.');
	else if(args.epoch.length > 1) return argumentError('Rotate type requires one epoch, not multiple.');
	if(!('changeAt' in args) && !('changeEvery' in args)) {
		return argumentError('Rotate type requires either changeAt or changeEvery.');
	} else if('changeAt' in args && 'changeEvery' in args) {
		return argumentError('Rotate type cannot take both changeAt and changeEvery.');
	} else if('changeEvery' in args && args.changeEvery.length > 1) {
		return argumentError('Rotate type can only have one changeEvery.');
	}
    if(list.length < 1) return argumentError('Rotate type must have at least 1 item in its list.');

    // a time the rotation started at index 0 (converted to ms). or false if time provided could not be parsed.
    const epoch = parseServerDateTime(args.epoch[0]);

    // make sure the epoch provided is a valid server time string
    if(!epoch) return argumentError('Rotate type requires a valid Server time epoch. Valid formats are yyyy-mm-ddThh:mm:ss.sssS or yyyy-mm-ddThh:mm:ssS or yyyy-mm-ddThh:mmS with the capital T and S being the literal letters.');

    //next up, assign and validate changeEvery/changeAt times.
    let changeEvery = 'changeEvery' in args ? args.changeEvery : null;
    let changeAt = 'changeAt' in args ? args.changeAt : null;
    if(changeEvery && !validateDurationTimeStrings(changeEvery)) return argumentError('changeEvery is an invalid duration time string. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. For durations, the numbers accept any number of digits.');
    if(changeAt && !validateTimeStrings(changeAt)) return argumentError('changeAt has an invalid time string. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. The numbers can be 1 or 2 digits (or 3 for milliseconds) but must be a valid time.');

    // current rotation index (starting at 0 for the first item in the list)
    let rotation = 0;
    //set up the timeout variable here so that it can be accessed elsewhere in case it needs to be canceled.
    let updateTimeout = null;

    // changeEvery type of rotation timer
    if(changeEvery){
        //convert to real time duration. This will turn erinn time strings or shorthand server time strings like 5:0s into
        //full server time strings like 05:00:00.000S and the number of real milliseconds.
        let durationObject = convertToRealtimeDuration(changeEvery[0]);
        // durationObject should not be false since we validated the time string above, but just in case
        if(!durationObject) return timerError(`Rotate timer failed to complete convertToRealtimeDuration with a changeEvery value of ${changeEvery[0]}`);

        // for changeEvery type rotation timers, durationObject's milliseconds must be greater than or equal to 1
        if(durationObject.milliseconds < 1) return timerError(`Rotate timers with a changeEvery can not have a duration of 0ms.`);

        // now set up an interval.
        // Use setTimeout instead of setInterval. Keep in mind browsers throttle javascript timers when the tab is not active, so
        // more time than expected may have passed.
        function updateRotation(){
            //recalculate what the rotation should be at now
            rotation = Math.floor((Date.now() - epoch.dateObject.getTime()) / durationObject.milliseconds);

            //use the rotation to get the corresponding item from the list
            let currentSelection = list[rotation%list.length];
            //TODO: implement displays. for now, just use the console.
            console.log(`rotation timer update: ${currentSelection}`);

            // in case the timeout did not execute at the scheduled time, calculate how long to wait for the next scheduled time.
            // waitTime will be the duration between rotations, minus the amount of time that passed since the last rotation change.
            let waitTime = durationObject.milliseconds - ((Date.now() - epoch.dateObject.getTime()) % durationObject.milliseconds);
            // just in case a timeout was started elsewhere, clear it before starting a new one.
            clearTimeout(updateTimeout);
            //call this function again at the scheduled time.
            updateTimeout = setTimeout(updateRotation, waitTime);
        }
        //start the timer
        updateRotation();

    // changeAt type of rotation timer
    }else if(changeAt){

    }
}