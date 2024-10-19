import { TIME_PER_ERINN_DAY, ERINN_TIME_OFFSET,
    argumentError, timerError,
    parseServerDateTime, validateTimeStrings, validateDurationTimeStrings,
    convertTimeStringToFullServerDurationTimeString, convertTimeStringToMillisecondsAfterMidnight,
    dateToMillisecondsAfterServerMidnight } from '../utils.js';

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

    // a time the rotation started at index 0 (converted to ms). or false if time provided could not be parsed, giving an error below.
    // for changeAt rotation timers, the epoch does not need to be exact and can be any server time during which the rotation was at index 0.
    const epoch = parseServerDateTime(args.epoch[0]);

    // make sure the epoch provided was a valid server time string
    if(!epoch) return argumentError('Rotate type requires a valid Server time epoch. Valid formats are yyyy-mm-ddThh:mm:ss.sssS or yyyy-mm-ddThh:mm:ssS or yyyy-mm-ddThh:mmS with the capital T and S being the literal letters. This should be in the server time zone.');

    //next up, assign and validate changeEvery/changeAt times.
    let changeEvery = 'changeEvery' in args ? args.changeEvery : null;
    let changeAt = 'changeAt' in args ? args.changeAt : null;
    if(changeEvery && !validateDurationTimeStrings(changeEvery)) return argumentError('changeEvery is an invalid duration time string. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. For durations, the numbers accept any number of digits.');
    // swap sunshift in changeAt with 06:00E and 18:00E
    if(changeAt){
        let updatedChangeAt = [];
        changeAt.forEach((str) => {
            // turn sunshift into 6am and 6pm erinn time
            if (str.toLowerCase() === "sunshift") updatedChangeAt.push('06:00E','18:00E');
            //if not sunshift, keep this string as it is
            else updatedChangeAt.push(str);
        });
        //apply updated array values to the original changeAt array
        changeAt = updatedChangeAt.slice();
    }
    if(changeAt && !validateTimeStrings(changeAt)) return argumentError('changeAt has an invalid time string. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. The numbers can be 1 or 2 digits (or 3 for milliseconds) but must be a valid time.');

    // current rotation index (starting at 0 for the first item in the list)
    let rotation = 0;
    //set up the timeout variable here so that it can be accessed elsewhere in case it needs to be canceled.
    let updateTimeout = null;
    //keep track of the last rotation value so we know when the rotation actually changed (due to timeout's timing not always being exact, rotation may not actually change after updateRotation is run)
    let lastRotation = 0;
    //declare the updateRotation function, which will get defined below
    let updateRotation;

    // changeEvery type of rotation timer
    if(changeEvery){
        //convert to real time duration. This will turn erinn time strings or shorthand server time strings like 5:0s into
        //full server time strings like 05:00:00.000S and the number of real milliseconds.
        let durationObject = convertTimeStringToFullServerDurationTimeString(changeEvery[0]);
        // durationObject should not be false since we validated the time string above, but just in case
        if(!durationObject) return timerError(`Rotate timer failed to complete convertTimeStringToFullServerDurationTimeString with a changeEvery value of ${changeEvery[0]}`);

        // for changeEvery type rotation timers, durationObject's milliseconds must be greater than or equal to 1
        if(durationObject.milliseconds < 1) return argumentError(`Rotate timers with a changeEvery can not have a duration of 0ms.`);

        // now set up an interval.
        // Use setTimeout instead of setInterval. Keep in mind browsers throttle javascript timers when the tab is not active, so
        // more time than expected may have passed.
        updateRotation = function(){
            //recalculate what the rotation should be at now
            rotation = Math.floor((Date.now() - epoch.dateObject.getTime()) / durationObject.milliseconds);

            //if rotation changed, update the display
            if(lastRotation !== rotation){
                lastRotation = rotation;
                //use the rotation to get the corresponding item from the list
                let currentSelection = list[rotation%list.length];
                //TODO: implement displays. for now, just use the console.
                console.log(`rotation timer update: ${currentSelection}`);
            }

            // in case the timeout did not execute at the scheduled time, calculate how long to wait for the next scheduled time.
            // waitTime will be the duration between rotations, minus the amount of time that passed since the last rotation change.
            let waitTime = durationObject.milliseconds - ((Date.now() - epoch.dateObject.getTime()) % durationObject.milliseconds);
            // just in case a timeout was started elsewhere, clear it before starting a new one.
            clearTimeout(updateTimeout);
            //call this function again at the scheduled time.
            updateTimeout = setTimeout(updateRotation, waitTime);
        }
    // changeAt type of rotation timer
    }else if(changeAt){
        // changeAt times need to be converted to milliseconds from midnight so I can work with them with Date.now()
        // Also it is possible for changeAt to have both types of times, They need to be separated.
        // return an error afterwards if any changeAt time fails to convert to milliseconds.
        let errorValue = false;
        let erinnTimes = [];
        let serverTimes = [];

        changeAt.forEach(str => {
            //convert the time string to an object with a type (Erinn or Server) and a milliseconds after midnight
            let convertedTimeString = convertTimeStringToMillisecondsAfterMidnight(str);
            // if the conversion to milliseconds failed, set the errorValue. Otherwise, sort the time into the correct array.
            if(!convertedTimeString){
                errorValue = str;
            }else{
                convertedTimeString.type === "Erinn" ? erinnTimes.push(convertedTimeString.milliseconds) : serverTimes.push(convertedTimeString.milliseconds);
            }
        });
        if(errorValue !== false){ // specifically a boolean check. I don't want things like empty strings to be considered false here.
            return timerError(`Rotate timer failed to complete convertTimeStringToMillisecondsAfterMidnight at a changeAt value of ${errorValue}`)
        }
        //sort the arrays from earliest time to latest
        erinnTimes.sort((a,b) => a - b);
        serverTimes.sort((a,b) => a - b);

        updateRotation = function(){
            // reset rotation to rcalculate it from scratch.
            rotation = 0;
            let currentTime = Date.now();
            let epochTime = epoch.dateObject;
            // keep track of which serverTime or erinnTime comes next to determine the next timeout's wait time
            let waitTime = Infinity;
            
            // handle Erinn times.
            if(erinnTimes.length > 0){
                // how many milliseconds into the Erinn day the epoch is at
                const startInDay = (epochTime + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
                // how many milliseconds into the Erinn day the current time is at
                const endInDay = (currentTime + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
                // time since epoch in milliseconds
                const elapsedTime = currentTime - epochTime;
                
                // if startInDay and endInDay are on the same day, just add the rotations between them.
                if(endInDay - startInDay === elapsedTime){
                    rotation += erinnTimes.filter(rotationTime => rotationTime > startInDay && rotationTime <= endInDay).length;
                // if startInDay and endInDay have no full days in between, then just add the rotations from those two partial days.
                }else if( (TIME_PER_ERINN_DAY - startInDay) + endInDay === elapsedTime){
                    // first partial day
                    rotation += erinnTimes.filter(rotationTime => rotationTime > startInDay).length;
                    // second partial day
                    rotation += erinnTimes.filter(rotationTime => rotationTime <= endInDay).length;
                //there are full days in between. Add the rotations from the two partial days and all the full days between them
                }else{
                    // first partial day
                    rotation += erinnTimes.filter(rotationTime => rotationTime > startInDay).length;
                    // second partial day
                    rotation += erinnTimes.filter(rotationTime => rotationTime <= endInDay).length;
                    // the days between
                    let daysBetween = (elapsedTime - (TIME_PER_ERINN_DAY-startInDay) - endInDay)/TIME_PER_ERINN_DAY;
                    rotation += erinnTimes.length * daysBetween;
                }
                //done. Now for waitTime, get the next scheduled erinnTime. minimum wait time is 1ms.
                let nextScheduledTime = erinnTimes.find(rotationTime => rotationTime > endInDay);
                if(typeof nextScheduledTime === 'undefined'){
                    //no more times in the current day. Get the first time instead and add the remainder time in the current day
                    nextScheduledTime = erinnTimes[0] + TIME_PER_ERINN_DAY - endInDay;
                }else{
                    //found the next time later in the day. Adjust it for milliseconds from now
                    nextScheduledTime -= endInDay;
                }
                //keep current waitTime if it is shorter, make it 1 if it is shorter than 1.
                waitTime = Math.max(Math.min(waitTime, nextScheduledTime), 1);
            }

            //handle server times
            if(serverTimes.length > 0){
                // how many milliseconds into the Server day the epoch is at
                const startInDay = dateToMillisecondsAfterServerMidnight(epochTime);
                // how many milliseconds into the Server day the current time is at
                const endInDay = dateToMillisecondsAfterServerMidnight(currentTime);
                // time since epoch in milliseconds
                const elapsedTime = currentTime - epochTime;
                
                // if startInDay and endInDay are on the same day, just add the rotations between them.
                if(endInDay - startInDay === elapsedTime){
                    rotation += serverTimes.filter(rotationTime => rotationTime > startInDay && rotationTime <= endInDay).length;
                // if startInDay and endInDay have no full days in between, then just add the rotations from those two partial days.
                }else if( (86400000 - startInDay) + endInDay === elapsedTime){
                    // first partial day
                    rotation += serverTimes.filter(rotationTime => rotationTime > startInDay).length;
                    // second partial day
                    rotation += serverTimes.filter(rotationTime => rotationTime <= endInDay).length;
                //there are full days in between. Add the rotations from the two partial days and all the full days between them
                }else{
                    // first partial day
                    rotation += serverTimes.filter(rotationTime => rotationTime > startInDay).length;
                    // second partial day
                    rotation += serverTimes.filter(rotationTime => rotationTime <= endInDay).length;
                    // the days between
                    let daysBetween = (elapsedTime - (86400000-startInDay) - endInDay)/86400000;
                    rotation += serverTimes.length * daysBetween;
                }

                //done. Now for waitTime, get the next scheduled serverTime. minimum wait time is 1ms.
                let nextScheduledTime = serverTimes.find(rotationTime => rotationTime > endInDay);
                if(typeof nextScheduledTime === 'undefined'){
                    //no more times in the current day. Get the first time instead and add the remainder time in the current day
                    nextScheduledTime = serverTimes[0] + 86400000 - endInDay;
                }else{
                    //found the next time later in the day. Adjust it for milliseconds from now
                    nextScheduledTime -= endInDay;
                }
                //keep current waitTime if it is shorter, make it 1 if it is shorter than 1.
                waitTime = Math.max(Math.min(waitTime, nextScheduledTime), 1);
            }

            //if rotation changed, update the display
            if(lastRotation !== rotation){
                lastRotation = rotation;
                //use the rotation to get the corresponding item from the list
                let currentSelection = list[rotation%list.length];
                //TODO: implement displays. for now, just use the console.
                console.log(`rotation timer update: ${currentSelection}`);
            }
            // just in case a timeout was started elsewhere, clear it before starting a new one.
            clearTimeout(updateTimeout);
            //call this function again at the scheduled time.
            updateTimeout = setTimeout(updateRotation, waitTime);
        }
    }
    //start the timer
    updateRotation();
}