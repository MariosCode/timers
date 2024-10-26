import { Timer } from './Timer.js';
import { TimerDisplay } from '../display/TimerDisplay.js'

import { TIME_PER_ERINN_DAY, ERINN_TIME_OFFSET, // Variables
    argumentError, timerError, timerDisplayError, // Error logging
    parseServerDateTime, validateTimeStrings, validateDurationTimeStrings, // Parsing and validation
    convertTimeStringToFullServerDurationTimeString, convertTimeStringToMillisecondsAfterMidnight, // Conversions
    dateToMillisecondsAfterServerMidnight, arrayFindLast
 } from '../helper/utils.js';

 /**
  * @typedef {Object} Epoch
  * @property {Number} year - Year from the Server date and time string
  * @property {Number} month - Month from the Server date and time string
  * @property {Number} day - Day from the Server date and time string
  * @property {Number} hour - Hour from the Server date and time string
  * @property {Number} minute - Minute from the Server date and time string
  * @property {Number} second - Second from the Server date and time string
  * @property {Number} millisecond - Millisecond from the Server date and time string
  * @property {Date} dateObject - Date object from the Server date and time string using the Server's time zone with {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat|Intl.DateTimeFormat}
  */

 /**
  * @typedef {Object} Duration
  * @property {String} timestring - Duration formatted as a full Server time string
  * @property {Number} milliseconds - Duration as milliseconds
  */

 // TODO: to save resources: save scheduled time and immediately wait again if rotate was called too soon. Option to force rotation

/**  
 * @class RotateTimer
 * @classdesc Rotate type Timer. 
 * This class should be instantiated using {@link RotateTimer.createInstance}.
 * 
 * The rotate timer will go through the given list in order.
 * 
 * Rotate type timers must have a ul and/or an ol element, with at least 1 li element. This is the list the timer will rotate through.
 * 
 * The following settings are required in an element with the class "settings":
 * 
 * - epoch: A time the rotation started at the first item in the provided list. For example: "2016-01-31T00:00:00.000S". Must be in Server time and include the date.
 *   >- For changeAt rotate timers, the epoch can be any time the rotation was at the first item in the list. For changeEvery rotate timers, the epoch should be the exact time the rotation was at the beginning of first item in the list.
 * - id: A unique ID to give to this timer so displays can access it
 * 
 * And one of the following:
 * 
 * - changeAt: A value or multiple values. Each value is the time to rotate the timer to the next item in the list. For example "{6:00E}{8:00E}{12:00E}", or "{6:00S}{8:00:00.000S}", or "6:00:00S". Can also be "sunshift".
 * - changeEvery: A single value for how often to rotate. For example "6:00S" or "6:00:00.000S" (every 6 Server time hours), or "2:00E" (every 2 Erinn time hours).
 * 
 * Optionally in settings, a rotate timer may have the following:
 * 
 * - filter: A filter to apply to the timer's output. Valid filters are:
 *   >- compress: Compresses the entries such that it only outputs unique ones and adjusts timing accordingly.
 */
export class RotateTimer extends Timer{
    // Prevent the use of the constructor so this class can only be created with RotateTimer.createInstance
    static _allowConstructor = false;

   /**  
     * Private constructor to prevent direct instantiation.  
     * Use {@link RotateTimer.createInstance} to create an instance.  
     *   
     * @param {Object} obj - Object containing all parameters
     * @param {Object.<String, String[]>} obj.args - The args object created from the element with the "settings" class
     * @param {String[]} obj.list - List created from all li elements in a ul or ol element
     * @param {Epoch} obj.epoch - Object containing the parsed epoch Date from the epoch provided in args
     * @param {String[]} obj.changeAt - Parsed args.changeAt times
     * @param {Number[]} obj.erinnTimes - The Erinn times from args.changeAt sorted and stored as milliseconds after Erinn midnight
     * @param {Number[]} obj.serverTimes - The Server times from args.changeAt sorted and stored as milliseconds after Server midnight
     * @param {Duration} obj.changeEveryDuration - Object containing the full Server time string and milliseconds for the duration given in args.changeEvery
     * @param {Number} obj.rotation - Number of rotations that have passed
     * @param {Array.<[Number, Number]>} obj.rotationData - Rotation data to be given to attached displays. All array items are [list item index, start time for this list item in milliseconds since unix epoch].
     * @param {Number} obj.timeout - Timeout ID for the next execution of updateRotation so it can be canceled
     * @private  
     */  
    constructor({args, list, epoch, changeAt, erinnTimes, serverTimes, changeEveryDuration, rotation, rotationData, timeout}){
        if(!RotateTimer._allowConstructor) return timerError(`Rotate timers must be instantiated with RotateTimer.createInstance() instead of new RotateTimer()`);
        RotateTimer._allowConstructor = false;

        super();
        
        // Original parameters
        this.args = args;
        this.list = list;

        // Modified parameter values
        this.epoch = epoch;
        this.changeAt = changeAt;

        // New properties from parameters
        this.erinnTimes = erinnTimes;
        this.serverTimes = serverTimes;
        this.changeEveryDuration = changeEveryDuration;
        this.rotation = rotation;
        this.rotationData = rotationData;
        this.timeout = timeout;

        // New properties
        if('changeEvery' in args){
            /**
             * Updates the rotation and TimerDisplays for rotate timers then sets a timeout to call itself again at the next scheduled rotation time.
             */
            this.updateRotation = this.#updateRotationChangeEvery.bind(this);
            this.rotationType = "changeEvery";
        }else{
            /**
             * Updates the rotation and TimerDisplays for rotate timers then sets a timeout to call itself again at the next scheduled rotation time.
             */
            this.updateRotation = this.#updateRotationChangeAt.bind(this);
            this.rotationType = "changeAt";
        }

        /**
         * The {@link TimerDisplay|TimerDisplays} attached to the timer.
         */
        this.timerDisplays = new Map();
        /**
         * Determines how many arrays to include in rotationData. Determined by the highest depth in the TimerDisplays attached to this timer. Minimum 2.
         */
        this.depth = 2;
    }

    /**  
     * Creates an instance of RotateTimer if all parameters pass validation. Prints an error to console and returns null otherwise.
     *   
     * @param {Object.<String, String[]>} args - The args object created from the element with the "settings" class
     * @param {String[]} list - List created from all li elements in a ul or ol element
     * @returns {RotateTimer|null} - Returns an instance of RotateTimer if the parameters are valid, otherwise returns null
     */
    static createInstance(args, list) {
        // Validate and convert the given parameters into the values used by this class.
        let validatedParameters = this.#validateParameters({args, list});
        if(!validatedParameters) return null;

        let epoch = validatedParameters.epoch;
        let changeAt = validatedParameters.updatedChangeAt;
        let erinnTimes = validatedParameters.erinnTimes;
        let serverTimes = validatedParameters.serverTimes;
        let changeEveryDuration = validatedParameters.changeEveryDuration;
        // Current rotation index
        let rotation = 0;
        // Data to be given to attached displays
        let rotationData = [];
        // Timeout variable (used to cancel it if needed)
        let timeout = null;
        
        // Create and return the rotate timer instance
        RotateTimer._allowConstructor = true;
        return new RotateTimer({args, list, epoch, changeAt, erinnTimes, serverTimes, changeEveryDuration, rotation, rotationData, timeout});
    }

    attachDisplay(display){
        // Validate the given TimerDisplay
        if(!(display instanceof TimerDisplay)) return timerError("Failed to attach display due to the provided display not being an instance of TimerDisplay or its subclasses.");
        if(this.timerDisplays.has(display)) return timerError("Failed to attach display due to the provided display already being attached.");

        // Add to the timerDisplays Map
        this.timerDisplays.set(display, true);

        // If this is the first TimerDisplay added to the Map, begin the rotations. Also update rotation if the depth has changed.
        if(this.timerDisplays.size === 1 || this.depth < display.depth){
            // Update depth if needed
            this.depth = (this.depth < display.depth ? display.depth : this.depth);
            this.updateRotation();
        }else{
            // Give this TimerDisplay the up to date rotation data
            display.updateData(this.rotationData);
        }
    }

    detachDisplay(display){
        // Validate
        if(!(this.timerDisplays.has(display))) return timerError("Failed to detach display due to the provided display not being attached.");

        this.timerDisplays.delete(display);
        // If this is the last TimerDisplay, stop the rotations and reset the depth.
        if(this.timerDisplays.size === 0){
            clearTimeout(this.timeout);
            this.depth = 2;
        // Otherwise, recalculate the depth if necessary.
        }else{
            if(display.depth === this.depth) this.recalculateDepth();
        }
    }

    recalculateDepth(){
        this.depth = 2;
        this.timerDisplays.forEach((value, display) => {
            this.depth = (this.depth > display.depth ? this.depth : display.depth);
        });
    }

    updateAllDisplays() {
        this.timerDisplays.forEach((value, display) => {
            display.updateData(this.rotationData);
        });
    }

    /**  
     * Validates and parses the parameters given to createInstance, returning properties needed by the RotateTimer
     *   
     * @param {Object} obj - Object containing all parameters
     * @param {Object.<String, String[]>} obj.args - The args object created from the element with the "settings" class
     * @param {String[]} obj.list - List created from all li elements in a ul or ol element
     * @returns {{epoch: Epoch, updatedChangeAt: String[], erinnTimes: String[], serverTimes: String[], changeEveryDuration: Duration}|null} - Returns an instance of RotateTimer if the parameters are valid, otherwise returns null
     * @private  
     */  
    static #validateParameters({args, list}){
        // Basic validations
        //================================================================================================================================================
        // Validate epoch
        if(!('epoch' in args)) return argumentError('Rotate type timers require an epoch.');
        else if(args.epoch.length > 1) return argumentError('Rotate type timers require one epoch, not multiple.');
        // A time the rotation started at index 0 (converted to ms) or false if the time provided could not be parsed
        // For changeAt rotation timers, the epoch can be any Server time during which the rotation was at index 0.
        let epoch = parseServerDateTime(args.epoch[0]);
        if(!epoch) return argumentError('Rotate type timers requires a valid Server time epoch. Valid formats are yyyy-mm-ddThh:mm:ss.sssS or yyyy-mm-ddThh:mm:ssS or yyyy-mm-ddThh:mmS with the capital T and S being the literal letters. This should be in the server time zone.');

        // Validate list
        if(list.length < 1) return argumentError('Rotate type timers must have at least 1 item in its list.');

        // Validate changeAt/changeEvery
        if(!('changeAt' in args) && !('changeEvery' in args)) {
            return argumentError('Rotate type timers require either changeAt or changeEvery.');
        } else if('changeAt' in args && 'changeEvery' in args) {
            return argumentError('Rotate type timers cannot take both changeAt and changeEvery.');
        } else if('changeEvery' in args && args.changeEvery.length > 1) {
            return argumentError('Rotate type timers can only have one changeEvery.');
        }

        // Assign changeEvery/changeAt time
        let changeEvery = 'changeEvery' in args ? args.changeEvery.slice() : null;
        let changeAt = 'changeAt' in args ? args.changeAt.slice() : null;
        
        // changeAt validation
        //================================================================================================================================================
        let updatedChangeAt = [];
        let erinnTimes = [];
        let serverTimes = [];
        if(changeAt){
            changeAt.forEach((str) => {
                // Swap sunshift in changeAt with 06:00E and 18:00E
                if (str.toLowerCase() === "sunshift") updatedChangeAt.push('06:00E','18:00E');
                // If not sunshift, keep this string as it is
                else updatedChangeAt.push(str);
            });

            if(!validateTimeStrings(updatedChangeAt)) return argumentError('In a rotate type timer, changeAt has an invalid time string. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. The numbers can be 1 or 2 digits (or 3 for milliseconds) but must be a valid time.');

            // Separate and sort changeAt
            let errorValue = false;

            updatedChangeAt.forEach(str => {
                // Convert the time string to an object with properties "type" (Erinn or Server) and "milliseconds" after midnight
                let convertedTimeString = convertTimeStringToMillisecondsAfterMidnight(str);
                // If the conversion to milliseconds failed, set the errorValue. Otherwise, sort the milliseconds after midnight into the correct array.
                if(!convertedTimeString){
                    errorValue = str;
                }else{
                    convertedTimeString.type === "Erinn" ? erinnTimes.push(convertedTimeString.milliseconds) : serverTimes.push(convertedTimeString.milliseconds);
                }
            });
            if(errorValue !== false){ // Specifically a boolean check. We don't want things like empty strings to be considered false here.
                return timerError(`Rotate timer failed to complete convertTimeStringToMillisecondsAfterMidnight at a changeAt value of ${errorValue}`);
            }
            // Sort the arrays from earliest time to latest
            erinnTimes.sort((a,b) => a - b);
            serverTimes.sort((a,b) => a - b);
        }
        
        // changeEvery validation
        //================================================================================================================================================
        let changeEveryDuration = null;
        if(changeEvery){
            if(!validateDurationTimeStrings(changeEvery)) return argumentError('In a rotate type timer, changeEvery is an invalid duration time string. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. For durations, the numbers accept any number of digits.');
            // Convert to real time duration as a full Server time string like 05:00:00.000S and the number of real milliseconds.
            changeEveryDuration = convertTimeStringToFullServerDurationTimeString(changeEvery[0]);
            if(!changeEveryDuration) return timerError(`Rotate timer failed to complete convertTimeStringToFullServerDurationTimeString. changeEvery value: ${changeEvery[0]}`);
            if(changeEveryDuration.milliseconds < 1) return argumentError(`Rotate timers with a changeEvery can not have a duration of 0ms or below. changeEvery value: ${changeEvery[0]}`);
        }

        return {epoch, updatedChangeAt, erinnTimes, serverTimes, changeEveryDuration};
    }

    /**  
     * Updates the rotation and TimerDisplays for rotate timers with a changeEvery then sets a timeout to call itself again at the next scheduled rotation time.
     *   
     * @private  
     */  
    #updateRotationChangeEvery(){
        // Use setTimeout instead of setInterval. Keep in mind browsers throttle javascript timers when the tab is not active. Timing is not exact and needs to be manually adjusted each time.
        // Recalculate what the rotation should be at now
        let lastRotation = this.rotation;
        let epochTime = this.epoch.dateObject.getTime();
        let currentTime = Date.now();
        this.rotation = Math.floor((currentTime - epochTime) / this.changeEveryDuration.milliseconds);

        // If rotation or depth changed, update the TimerDisplays
        if(lastRotation !== this.rotation || this.rotationData.length < this.depth){
            // TODO: Implement the compression filter. Create a new array using compression and then compare it to rotationData to determine if displays need to be updated. If list value from rotation of first index of first array matches that of second array, copy the first array's first index over to second array to keep the start time of it.
            // Clear rotationData and recalculate all entries
            this.rotationData = [];
            for(let i = 0; i < this.depth; i++){
                this.rotationData.push([(this.rotation + i) % this.list.length,
                    epochTime + ((this.rotation + i) * this.changeEveryDuration.milliseconds)]);
            }
            // Update all attached TimerDisplays with new rotationData
            this.updateAllDisplays();
        }

        // Calculate how long to wait for the next scheduled time
        // waitTime will be the duration between rotations, minus the amount of time that passed since the last rotation change.
        let waitTime = this.changeEveryDuration.milliseconds - ((currentTime - epochTime) % this.changeEveryDuration.milliseconds);
        // Just in case a timeout was started elsewhere, clear it before starting a new one.
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.updateRotation, waitTime);
    }

    /**  
     * Updates the rotation and TimerDisplays for rotate timers with a changeAt then sets a timeout to call itself again at the next scheduled rotation time.
     *   
     * @private  
     */ 
    #updateRotationChangeAt(){
        // Reset rotation to recalculate it from scratch
        let lastRotation = this.rotation;
        this.rotation = 0;
        // Store times used in the rotation calculation
        let currentTime = Date.now();
        let epochDate = this.epoch.dateObject;
        let epochTime = epochDate.getTime();
        // Time in milliseconds until the next rotation
        let waitTime = Infinity;
        // How many milliseconds into the Erinn day the current time is at
        const endInErinnDay = (currentTime + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
        // How many milliseconds into the Server day the current time is at
        const endInServerDay = dateToMillisecondsAfterServerMidnight(currentTime);
        
        // Erinn times
        //================================================================================================================================================
        if(this.erinnTimes.length > 0){
            // How many milliseconds into the Erinn day the epoch is at
            const startInDay = (epochTime + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
            // Time since epoch in milliseconds
            const elapsedTime = currentTime - epochTime;
            
            // If startInDay and endInErinnDay are on the same day, just add the rotations between them.
            if(endInErinnDay - startInDay === elapsedTime){
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime > startInDay && rotationTime <= endInErinnDay).length;
            // If startInDay and endInErinnDay have no full days in between, then just add the rotations from those two partial days.
            }else if( (TIME_PER_ERINN_DAY - startInDay) + endInErinnDay === elapsedTime){
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime <= endInErinnDay).length;
            // There are full days in between. Add the rotations from the two partial days and all the full days between them.
            }else{
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime <= endInErinnDay).length;
                let daysBetween = (elapsedTime - (TIME_PER_ERINN_DAY-startInDay) - endInErinnDay)/TIME_PER_ERINN_DAY;
                this.rotation += this.erinnTimes.length * daysBetween;
            }
            // Get the next scheduled erinnTime and update waitTime. Minimum waitTime is 1ms.
            let nextScheduledTime = this.erinnTimes.find(rotationTime => rotationTime > endInErinnDay);
            if(typeof nextScheduledTime !== 'undefined'){
                // Next rotation is today. Adjust it for milliseconds from now.
                nextScheduledTime -= endInErinnDay;
            }else{
                // Next rotation is tomorrow. Get the first time tomorrow and add the remainder time from today.
                nextScheduledTime = this.erinnTimes[0] + TIME_PER_ERINN_DAY - endInErinnDay;
            }
            // Keep current waitTime if it is shorter. Make it 1ms if it is shorter than 1ms.
            waitTime = Math.max(Math.min(waitTime, nextScheduledTime), 1);
        }

        // Server times
        //================================================================================================================================================
        if(this.serverTimes.length > 0){
            // How many milliseconds into the Server day the epoch is at
            const startInDay = dateToMillisecondsAfterServerMidnight(epochDate);
            // Time since epoch in milliseconds
            const elapsedTime = currentTime - epochTime;
            
            // If startInDay and endInServerDay are on the same day, add the rotations between them.
            if(endInServerDay - startInDay === elapsedTime){
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime > startInDay && rotationTime <= endInServerDay).length;
            // If startInDay and endInServerDay have no full days in between, add the rotations from those two partial days.
            }else if( (86400000 - startInDay) + endInServerDay === elapsedTime){
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime <= endInServerDay).length;
            // There are full days in between. Add the rotations from the two partial days and all the full days between them.
            }else{
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime <= endInServerDay).length;
                let daysBetween = (elapsedTime - (86400000-startInDay) - endInServerDay)/86400000;
                this.rotation += this.serverTimes.length * daysBetween;
            }

            // Get the next scheduled serverTime and update waitTime. Minimum waitTime is 1ms.
            let nextScheduledTime = this.serverTimes.find(rotationTime => rotationTime > endInServerDay);
            if(typeof nextScheduledTime !== 'undefined'){
                // Next rotation is today. Adjust it for milliseconds from now.
                nextScheduledTime -= endInServerDay;
            }else{
                // Next rotation is tomorrow. Get the first time tomorrow and add the remainder time from today.
                nextScheduledTime = this.serverTimes[0] + 86400000 - endInServerDay;
            }
            // Keep current waitTime if it is shorter. Make it 1ms if it is shorter than 1ms.
            waitTime = Math.max(Math.min(waitTime, nextScheduledTime), 1);
        }

        // First rotationData index
        //================================================================================================================================================
        // If rotation or depth changed, update the TimerDisplays
        if(lastRotation !== this.rotation || this.rotationData.length < this.depth){
            // TODO: Implement the compression filter. Create a new array using compression and then compare it to rotationData to determine if displays need to be updated. If list value from rotation of first index of first array matches that of second array, copy the first array's first index over to second array to keep the start time of it.
            // Clear rotationData and recalculate all entries
            this.rotationData = [];
            // Keep track of last time added to rotationData
            // How many milliseconds into the Erinn day the last time was at
            let lastEndInErinnDay = 0;
            // How many milliseconds into the Server day the last time was at
            let lastEndInServerDay = 0;

            // For index 0, get the start time immediately at or before the current time.
            let lastErinnTime = 0;
            let lastServerTime = 0;
            // First look through the Erinn times
            if(this.erinnTimes.length > 0){
                lastErinnTime = arrayFindLast(this.erinnTimes, rotationTime => rotationTime <= endInErinnDay);
                if(typeof lastErinnTime !== 'undefined'){
                    // There was a time found in the current Erinn day at or before the current time. Adjust for unix epoch.
                    lastErinnTime = currentTime - (endInErinnDay - lastErinnTime);
                }else{
                    // No time found in the current Erinn day at or before the current time. Take the last time of the previous day and adjust for unix epoch.
                    lastErinnTime = currentTime - endInErinnDay - (TIME_PER_ERINN_DAY - this.erinnTimes[this.erinnTimes.length - 1]);
                }
            }
            // Second look through the Server times
            if(this.serverTimes.length > 0){
                lastServerTime = arrayFindLast(this.serverTimes, rotationTime => rotationTime <= endInServerDay);
                if(typeof lastServerTime !== 'undefined'){
                    // There was a time found in the current Server day at or before the current time. Adjust for unix epoch.
                    lastServerTime = currentTime - (endInServerDay - lastServerTime);
                }else{
                    // No time found in the current Server day at or before the current time. Take the last time of the previous day and adjust for unix epoch.
                    lastServerTime = currentTime - endInServerDay - (86400000 - this.serverTimes[this.serverTimes.length - 1]);
                }
            }
            // Use the highest time
            this.rotationData.push([this.rotation % this.list.length,
                                    (lastErinnTime > lastServerTime ? lastErinnTime : lastServerTime)]);
            // Calculate times in the day
            lastEndInErinnDay = (this.rotationData[0][1] + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
            lastEndInServerDay = dateToMillisecondsAfterServerMidnight(new Date(this.rotationData[0][1]));

            // Rest of rotationData
            //================================================================================================================================================
            // For all other indexes, get the start time immediately after the previous start time.
            for(let i = 1; i < this.depth; i++){
                let nextErinnTime = Infinity;
                let nextServerTime = Infinity;
                let lastRotationTime = this.rotationData[i-1][1];
                // First look through the Erinn times
                if(this.erinnTimes.length > 0){
                    nextErinnTime = this.erinnTimes.find(rotationTime => rotationTime > lastEndInErinnDay);
                    if(typeof nextErinnTime !== 'undefined'){
                        // There was a time found in the current Erinn day after the lastEndInErinnDay. Adjust for unix epoch.
                        nextErinnTime = lastRotationTime + (nextErinnTime - lastEndInErinnDay);
                    }else{
                        // No time found in the current Erinn day after the lastEndInErinnDay. Take the first time of the next day and adjust for unix epoch.
                        nextErinnTime = lastRotationTime + (TIME_PER_ERINN_DAY - lastEndInErinnDay) + this.erinnTimes[0];
                    }
                }
                // Second look through the Server times
                if(this.serverTimes.length > 0){
                    nextServerTime = this.serverTimes.find(rotationTime => rotationTime > lastEndInServerDay);
                    if(typeof nextServerTime !== 'undefined'){
                        // There was a time found in the current Server day after the lastEndInServerDay. Adjust for unix epoch.
                        nextServerTime = lastRotationTime + (nextServerTime - lastEndInServerDay);
                    }else{
                        // No time found in the current Server day after the lastEndInServerDay. Take the first time of the next day and adjust for unix epoch.
                        nextServerTime = lastRotationTime + (86400000 - lastEndInServerDay) + this.serverTimes[0];
                    }
                }
                // Use the lowest time
                this.rotationData.push([(this.rotation + i) % this.list.length,
                                        (nextErinnTime < nextServerTime ? nextErinnTime : nextServerTime)]);
                // Calculate times in the day
                lastEndInErinnDay = (this.rotationData[i][1] + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
                lastEndInServerDay = dateToMillisecondsAfterServerMidnight(new Date(this.rotationData[i][1]));
            }

            // Update displays
            //================================================================================================================================================
            // Update all attached TimerDisplays with new rotationData
            this.updateAllDisplays();
        }
        // Just in case a timeout was started elsewhere, clear it before starting a new one.
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.updateRotation, waitTime);
    }
}