import { TimerDisplay } from '../display/TimerDisplay.js'

import { TIME_PER_ERINN_DAY, ERINN_TIME_OFFSET, // Variables
    argumentError, timerError, // Error logging
    parseServerDateTime, validateTimeStrings, validateDurationTimeStrings, // Parsing and validation
    convertTimeStringToFullServerDurationTimeString, convertTimeStringToMillisecondsAfterMidnight, // Conversions
    dateToMillisecondsAfterServerMidnight
 } from '../helper/utils.js';

 /**
  * @typedef {Object} Epoch
  * @property {number} year - Year from the Server date and time string
  * @property {number} month - Month from the Server date and time string
  * @property {number} day - Day from the Server date and time string
  * @property {number} hour - Hour from the Server date and time string
  * @property {number} minute - Minute from the Server date and time string
  * @property {number} second - Second from the Server date and time string
  * @property {number} millisecond - Millisecond from the Server date and time string
  * @property {Date} dateObject - Date object from the Server date and time string using the Server's time zone with {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat|Intl.DateTimeFormat}
  */

 /**
  * @typedef {Object} Duration
  * @property {string} timestring - Duration formatted as a full Server time string
  * @property {number} milliseconds - Duration as milliseconds
  */

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
 *   - For changeAt rotate timers, the epoch can be any time the rotation was at the first item in the list. For changeEvery rotate timers, the epoch should be the exact time the rotation was at the beginning of first item in the list.
 * 
 * And one of the following:
 * 
 * - changeAt: A value or multiple values. Each value is the time to rotate the timer to the next item in the list. For example "{6:00E}{8:00E}{12:00E}", or "{6:00S}{8:00:00.000S}", or "6:00:00S". Can also be "sunshift".
 * - changeEvery: A single value for how often to rotate. For example "6:00S" or "6:00:00.000S" (every 6 Server time hours), or "2:00E" (every 2 Erinn time hours).
 * 
 * Optionally in settings, a rotate timer may have the following:
 * 
 * - filter: A filter to apply to the timer's output. Valid filters are:
 *   - compress: Compresses the entries such that it only outputs unique ones and adjusts timing accordingly.
 */
export class RotateTimer{
    // Prevent the use of the constructor so this class can only be created with RotateTimer.createInstance
    static _allowConstructor = false;

   /**  
     * Private constructor to prevent direct instantiation.  
     * Use {@link RotateTimer.createInstance} to create an instance.  
     *   
     * @param {Object} obj - Object containing all parameters
     * @param {Object.<string, string[]>} obj.args - The args object created from the element with the "settings" class
     * @param {string[]} obj.list - List created from all li elements in a ul or ol element
     * @param {Epoch} obj.epoch - Object containing the parsed epoch Date from the epoch provided in args
     * @param {string[]} obj.changeAt - Parsed args.changeAt times
     * @param {Number[]} obj.erinnTimes - The Erinn times from args.changeAt sorted and stored as milliseconds after Erinn midnight
     * @param {Number[]} obj.serverTimes - The Server times from args.changeAt sorted and stored as milliseconds after Server midnight
     * @param {Duration} obj.changeEveryDuration - Object containing the full Server time string and milliseconds for the duration given in args.changeEvery
     * @param {Number} obj.rotation - Number of rotations that have passed
     * @param {string} obj.currentSelection - Currently active item in the list at the current rotation
     * @param {Number} obj.timeout - Timeout ID for the next execution of updateRotation so it can be canceled
     * @private  
     */  
    constructor({args, list, epoch, changeAt, erinnTimes, serverTimes, changeEveryDuration, rotation, currentSelection, timeout}){
        if(!RotateTimer._allowConstructor) return timerError(`Rotate timers must be instantiated with RotateTimer.createInstance() instead of new RotateTimer()`);
        RotateTimer._allowConstructor = false;
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
        this.currentSelection = currentSelection;
        this.timeout = timeout;

        // New properties
        if('changeEvery' in args){
            /**
             * Updates the rotation and TimerDisplays for rotate timers then sets a timeout to call itself again at the next scheduled rotation time.
             */
            this.updateRotation = this.#updateRotationChangeEvery.bind(this);
            this.type = "changeEvery";
        }else{
            /**
             * Updates the rotation and TimerDisplays for rotate timers then sets a timeout to call itself again at the next scheduled rotation time.
             */
            this.updateRotation = this.#updateRotationChangeAt.bind(this);
            this.type = "changeAt";
        }
        
        // Start the timer TODO: run updateRotation only if a TimerDisplay is added, and stop it if a TimerDisplay is removed and remaining TimerDisplays is 0
        this.updateRotation();

        /**
         * The {@link TimerDisplay|TimerDisplays} attached to the timer.
         */
        this.timerDisplays = new Map();
        /**
         * Determines how many scheduled events to include in the timer's output. Determined by the TimerDisplays attached to the timer.
         */
        this.depth = 1;
    }

    /**  
     * Creates an instance of RotateTimer if all parameters pass validation. Prints an error to console and returns null otherwise.
     *   
     * @param {Object.<string, string[]>} args - The args object created from the element with the "settings" class
     * @param {string[]} list - List created from all li elements in a ul or ol element
     * @returns {RotateTimer|null} - Returns an instance of RotateTimer if the parameters are valid, otherwise returns null
     *   
     * @example  
     *   $(".make-timer").each(function () {
     *       const $this = $(this);
     *       const args = parseSettings($this.children(".settings").html());
     *       // Extract list
     *       const list = [];
     *       $this.children("ul, ol").children("li").each(function () {
     *           list.push($(this).html().trim());
     *       });
     *       // Empty the list and change the class
     *       $this.empty().removeClass("make-timer").addClass("timer");
     *       //assign the TimerDisplay
     *       let TimerDisplay = new TimerDisplay_type[args.timerDisplay ? args.timerDisplay[0] : "list"]($this, args);
     *       // Create the timer
     *       $this.data("timer", RotateTimer.createInstance(null, args, list));
     *   });
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
        // The currently active item in the list
        let currentSelection = list[0];
        // Timeout variable (used to cancel it if needed)
        let timeout = null;
        
        // Create and return the rotate timer instance
        RotateTimer._allowConstructor = true;
        return new RotateTimer({args, list, epoch, changeAt, erinnTimes, serverTimes, changeEveryDuration, rotation, currentSelection, timeout});
    }

    /**  
     * Validates and parses the parameters given to createInstance, returning properties needed by the RotateTimer
     *   
     * @param {Object} obj - Object containing all parameters
     * @param {Object.<string, string[]>} obj.args - The args object created from the element with the "settings" class
     * @param {string[]} obj.list - List created from all li elements in a ul or ol element
     * @returns {{epoch: Epoch, updatedChangeAt: string[], erinnTimes: string[], serverTimes: string[], changeEveryDuration: Duration}|null} - Returns an instance of RotateTimer if the parameters are valid, otherwise returns null
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
        this.rotation = Math.floor((Date.now() - this.epoch.dateObject.getTime()) / this.changeEveryDuration.milliseconds);

        // If rotation changed, update the TimerDisplays
        if(lastRotation !== this.rotation){
            lastRotation = this.rotation;
            // Use the rotation to get the corresponding item from the list
            this.currentSelection = this.list[ this.rotation % this.list.length ];
            // TODO: implement TimerDisplays. for now, just use the console.
            console.log(`rotate timer changeEvery update: ${this.currentSelection}`);
        }

        // Calculate how long to wait for the next scheduled time
        // waitTime will be the duration between rotations, minus the amount of time that passed since the last rotation change.
        let waitTime = this.changeEveryDuration.milliseconds - ((Date.now() - this.epoch.dateObject.getTime()) % this.changeEveryDuration.milliseconds);

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
        let currentTime = Date.now();
        let epochTime = this.epoch.dateObject;
        // Time in milliseconds until the next rotation
        let waitTime = Infinity;
        
        // Erinn times
        //================================================================================================================================================
        if(this.erinnTimes.length > 0){
            // How many milliseconds into the Erinn day the epoch is at
            const startInDay = (epochTime.getTime() + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
            // How many milliseconds into the Erinn day the current time is at
            const endInDay = (currentTime + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
            // Time since epoch in milliseconds
            const elapsedTime = currentTime - epochTime.getTime();
            
            // If startInDay and endInDay are on the same day, just add the rotations between them.
            if(endInDay - startInDay === elapsedTime){
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime > startInDay && rotationTime <= endInDay).length;
            // If startInDay and endInDay have no full days in between, then just add the rotations from those two partial days.
            }else if( (TIME_PER_ERINN_DAY - startInDay) + endInDay === elapsedTime){
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime <= endInDay).length;
            // There are full days in between. Add the rotations from the two partial days and all the full days between them.
            }else{
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.erinnTimes.filter(rotationTime => rotationTime <= endInDay).length;
                let daysBetween = (elapsedTime - (TIME_PER_ERINN_DAY-startInDay) - endInDay)/TIME_PER_ERINN_DAY;
                this.rotation += this.erinnTimes.length * daysBetween;
            }
            // Get the next scheduled erinnTime and update waitTime. Minimum waitTime is 1ms.
            let nextScheduledTime = this.erinnTimes.find(rotationTime => rotationTime > endInDay);
            if(typeof nextScheduledTime !== 'undefined'){
                // Next rotation is today. Adjust it for milliseconds from now.
                nextScheduledTime -= endInDay;
            }else{
                // Next rotation is tomorrow. Get the first time tomorrow and add the remainder time from today.
                nextScheduledTime = this.erinnTimes[0] + TIME_PER_ERINN_DAY - endInDay;
            }
            // Keep current waitTime if it is shorter. Make it 1ms if it is shorter than 1ms.
            waitTime = Math.max(Math.min(waitTime, nextScheduledTime), 1);
        }

        // Server times
        //================================================================================================================================================
        if(this.serverTimes.length > 0){
            // How many milliseconds into the Server day the epoch is at
            const startInDay = dateToMillisecondsAfterServerMidnight(epochTime);
            // How many milliseconds into the Server day the current time is at
            const endInDay = dateToMillisecondsAfterServerMidnight(currentTime);
            // Time since epoch in milliseconds
            const elapsedTime = currentTime - epochTime.getTime();
            
            // If startInDay and endInDay are on the same day, add the rotations between them.
            if(endInDay - startInDay === elapsedTime){
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime > startInDay && rotationTime <= endInDay).length;
            // If startInDay and endInDay have no full days in between, add the rotations from those two partial days.
            }else if( (86400000 - startInDay) + endInDay === elapsedTime){
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime <= endInDay).length;
            // There are full days in between. Add the rotations from the two partial days and all the full days between them.
            }else{
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime > startInDay).length;
                this.rotation += this.serverTimes.filter(rotationTime => rotationTime <= endInDay).length;
                let daysBetween = (elapsedTime - (86400000-startInDay) - endInDay)/86400000;
                this.rotation += this.serverTimes.length * daysBetween;
            }

            // Get the next scheduled serverTime and update waitTime. Minimum waitTime is 1ms.
            let nextScheduledTime = this.serverTimes.find(rotationTime => rotationTime > endInDay);
            if(typeof nextScheduledTime !== 'undefined'){
                // Next rotation is today. Adjust it for milliseconds from now.
                nextScheduledTime -= endInDay;
            }else{
                // Next rotation is tomorrow. Get the first time tomorrow and add the remainder time from today.
                nextScheduledTime = this.serverTimes[0] + 86400000 - endInDay;
            }
            // Keep current waitTime if it is shorter. Make it 1ms if it is shorter than 1ms.
            waitTime = Math.max(Math.min(waitTime, nextScheduledTime), 1);
        }

        // If rotation changed, update the TimerDisplays
        if(lastRotation !== this.rotation){
            lastRotation = this.rotation;
            // Use the rotation to get the corresponding item from the list
            let currentSelection = this.list[ this.rotation % this.list.length ];
            // TODO: implement TimerDisplays. For now, just use the console.
            console.log(`rotate timer changeAt update: ${currentSelection}`);
        }
        // Just in case a timeout was started elsewhere, clear it before starting a new one.
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.updateRotation, waitTime);
    }
}