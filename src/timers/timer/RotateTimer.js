import { Timer } from './Timer.js';
import { TimerDisplay } from '../display/TimerDisplay.js'

import { TIME_PER_ERINN_DAY, ERINN_TIME_OFFSET, SERVER_TIMEZONE, // Variables
    argumentError, timerError, timerDisplayError, // Error logging
    parseListSettings, parseServerDateTime, validateTimeStrings, validateDurationTimeStrings, // Parsing and validation
    convertTimeStringToFullServerDurationTimeString, convertTimeStringToMillisecondsAfterMidnight, // Conversions
    dateToMillisecondsAfterServerMidnight, arrayFindLast, getTimezoneOffset,
    TIME_PER_ERINN_HOUR,
    TIME_PER_ERINN_MINUTE
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

/**  
 * @class RotateTimer
 * @classdesc Rotate type Timer. 
 * This class should be instantiated using {@link RotateTimer.createInstance}.
 * 
 * The rotate timer will go through the given list in order.
 * 
 * Rotate type timers must have a ul and/or an ol element, with at least 1 li element. This is the list the timer will rotate through.
 * See {@link parseListSettings} for details on adding settings to individual list entries. Valid list entry settings are:
 * 
 *  - link: assigns a link to a list entry
 * 
 * The following settings are required in an element with the class "settings":
 * 
 *  - epoch: A time the rotation started at the first entry in the provided list. For example: "2016-01-31T00:00:00.000S". Must be in Server time and include the date.
 *      >- For changeAt rotate timers, the epoch can be any time the rotation was at the first entry in the list. For changeEvery rotate timers, the epoch should be the exact time the rotation was at the beginning of first entry in the list.
 *  - id: A unique ID to give to this timer so displays can access it
 * 
 * And one of the following:
 * 
 *  - changeAt: A value or multiple values. Each value is the time to rotate the timer to the next entry in the list. For example "{6:00E}{8:00E}{12:00E}", or "{6:00S}{8:00:00.000S}", or "6:00:00S". Can also be "sunshift".
 *  - changeEvery: A single value for how often to rotate. For example "6:00S" or "6:00:00.000S" (every 6 real time hours), or "2:00E" (every 2 Erinn time hours).
 * 
 * Optionally in settings, a rotate timer may have the following:
 * 
 *  - filter: A filter to apply to the timer's output. Valid filters are:
 *      >- compress: Compresses the entries such that it only outputs unique ones and adjusts timing accordingly.
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
     * @param {String[][]} obj.listLinks - Link setting from each list entry
     * @param {Epoch} obj.epoch - Object containing the parsed epoch Date from the epoch provided in args
     * @param {Boolean} obj.compress - Whether or not to apply the compress filter
     * @param {String[]} obj.changeAt - Parsed args.changeAt times
     * @param {Number[]} obj.erinnTimes - The Erinn times from args.changeAt sorted and stored as milliseconds after Erinn midnight
     * @param {Number[]} obj.serverTimes - The Server times from args.changeAt sorted and stored as milliseconds after Server midnight
     * @param {Duration} obj.changeEveryDuration - Object containing the full Server time string and milliseconds for the duration given in args.changeEvery
     * @param {Number} obj.rotation - Number of rotations that have passed
     * @param {Number[]} obj.rotationData - Rotation data to be given to attached displays. Numbers are in pairs: list entry index, start time for this list entry in milliseconds since unix epoch.
     * @param {Number} obj.timeout - Timeout ID for the next execution of updateRotation so it can be canceled
     * @private  
     */  
    constructor({args, list, listLinks, epoch, compress, changeAt, erinnTimes, serverTimes, changeEveryDuration, rotation, rotationData, timeout}){
        if(!RotateTimer._allowConstructor){
            timerError(`Rotate timers must be instantiated with RotateTimer.createInstance() instead of new RotateTimer()`);
            return undefined;
        }
        RotateTimer._allowConstructor = false;

        super();
        
        // Original parameters
        this.args = args;
        this.list = list;

        // Modified parameter values
        this.epoch = epoch;
        this.compress = compress;
        this.changeAt = changeAt;

        // New properties from parameters
        this.erinnTimes = erinnTimes;
        this.serverTimes = serverTimes;
        this.changeEveryDuration = changeEveryDuration;
        this.rotation = rotation;
        this.rotationData = rotationData;
        this.timeout = timeout;

        this.listLinks = listLinks;

        // New properties
        if('changeEvery' in args){
            /**
             * Updates the rotation and TimerDisplays for rotate timers then sets a timeout to call itself again at the next scheduled rotation time.
             */
            this.updateRotation = this.#updateRotationChangeEvery.bind(this);
            this.rotationType = 'changeEvery';
        }else{
            /**
             * Updates the rotation and TimerDisplays for rotate timers then sets a timeout to call itself again at the next scheduled rotation time.
             */
            this.updateRotation = this.#updateRotationChangeAt.bind(this);
            this.rotationType = 'changeAt';
        }

        /**
         * The {@link TimerDisplay|TimerDisplays} attached to the timer.
         */
        this.timerDisplays = new Map();

        /**
         * Determines how many entries to include in rotationData. Determined by the highest depth in the TimerDisplays attached to this timer. Minimum 2.
         */
        this.depth = 2;

        /**
         * Overrides depth and keeps adding to rotationData until conditions of all queries are fulfilled. This array contains the arrays of strings for each display with a query.
         * @type {String[][]}
         */
        this.query = [];
        /**
         * Overrides depth and keeps adding to rotationData until conditions of all queries are fulfilled. This array contains the depth for each display with a query.
         * @type {Number[]}
         */
        this.queryDepth = [];
        /**
         * Keeps track of changes to this.query to determine if rotationData needs to be updated
         */
        this.queryChanged = false;
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

        let newList = validatedParameters.listValues;
        let listLinks = validatedParameters.listLinks;
        let epoch = validatedParameters.epoch;
        let compress = validatedParameters.compress
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
        return new RotateTimer({args, list:newList, listLinks, epoch, compress, changeAt, erinnTimes, serverTimes, changeEveryDuration, rotation, rotationData, timeout});
    }

    /**
     * Attaches a display to this Timer instance
     * @param {TimerDisplay} display 
     */
    attachDisplay(display){
        // Validate the given TimerDisplay
        if(!(display instanceof TimerDisplay)) return timerError('Failed to attach display due to the provided display not being an instance of TimerDisplay or its subclasses.');
        if(this.timerDisplays.has(display)) return timerError('Failed to attach display due to the provided display already being attached.');

        // Add to the timerDisplays Map
        this.timerDisplays.set(display, true);

        // Add the display's query, if there is one
        if(display.query && display.query.length > 0){
            this.query.push(display.query.slice());
            this.queryDepth.push(display.depth);
            this.queryChanged = true;
        }

        // If this is the first TimerDisplay added to the Map, begin the rotations. Also update rotation if the depth has changed or this display uses a query.
        if(this.timerDisplays.size === 1 || this.depth < display.depth || (display.query && display.query.length > 0)){
            // Update depth if needed
            this.depth = (this.depth < display.depth ? display.depth : this.depth);
            this.updateRotation();
        }else{
            // Give this TimerDisplay the up to date rotation data
            display.updateData(this.rotationData);
        }
    }

    /**
     * Removes an attached display from this Timer instance
     * @param {TimerDisplay} display 
     */
    detachDisplay(display){
        // Validate the display is attached
        if(!(this.timerDisplays.has(display))) return timerError('Failed to detach display due to the provided display not being attached.');

        this.timerDisplays.delete(display);

        // If this is the last TimerDisplay, stop the rotations and reset the depth and query.
        if(this.timerDisplays.size === 0){
            clearTimeout(this.timeout);
            this.depth = 2;
            this.query = [];
            this.queryDepth = [];
            this.queryChanged = true;
        // Otherwise, recalculate the depth and query if necessary.
        }else{
            if(display.depth === this.depth) this.recalculateDepth();
            if(display.query && display.query.length > 0) this.recalculateQuery();
        }
    }

    /**
     * Loops through all attached displays to recalculate the depth of this Timer instance
     */
    recalculateDepth(){
        this.depth = 2;
        this.timerDisplays.forEach((value, display) => {
            this.depth = (this.depth > display.depth ? this.depth : display.depth);
        });
    }

    /**
     * Loops through all attached displays to recalculate the query of this Timer instance
     */
    recalculateQuery(){
        this.query = [];
        this.queryDepth = [];
        this.queryChanged = true;
        this.timerDisplays.forEach((value, display) => {
            if(display.query && display.query.length > 0){
                this.query.push(display.query.slice());
                this.queryDepth.push(display.depth);
            }
        });
    }

    /**
     * Sends all attached displays the current rotationData through their updataData method
     */
    updateAllDisplays() {
        this.timerDisplays.forEach((value, display) => {
            display.updateData(this.rotationData.slice());
        });
        this.queryChanged = false;
    }

    /**  
     * Validates and parses the parameters given to createInstance, returning properties needed by the RotateTimer
     *   
     * @param {Object} obj - Object containing all parameters
     * @param {Object.<String, String[]>} obj.args - The args object created from the element with the "settings" class
     * @param {String[]} obj.list - List created from all li elements in a ul or ol element
     * @returns {{epoch: Epoch, compress: Boolean, updatedChangeAt: String[], erinnTimes: String[], serverTimes: String[], changeEveryDuration: Duration}|null} - Returns an object if the parameters are valid, otherwise returns null
     * @private  
     */  
    static #validateParameters({args, list}){
        // List basic validations
        //================================================================================================================================================
        // Validate list
        if(list.length < 1) return argumentError('Rotate type timers must have at least 1 entry in its list.');
        // Separate and store value and settings from each list entry
        let listValues = [];
        let listLinks = [];
        let listChangeAt = [];
        let listEpoch = false; // If there's list changeAt times, the epoch is calculated from them and stored here
        list.forEach((value) => {
            let result = parseListSettings(value);
            listValues.push(result.value);
            // Sanitize links
            listLinks.push([]);
            if(result.link){
                result.link.forEach( value => {
                    try{
                        let testUrl = new URL(value, window.location.origin);
                        // Protocol whitelist to prevent the use of javascript:, file:, data:, tel:, etc.
                        if(['http:', 'https:'].includes(testUrl.protocol)){
                            listLinks[listLinks.length-1].push(value);
                        }else{
                            argumentError(`In a Rotate type timer\'s list, a provided link does not use a valid protocol. Removing link. Valid protocols are http and https. Link: ${value}`);
                            listLinks[listLinks.length-1].push('#');
                        }
                    } catch (e) {
                        argumentError(`In a Rotate type timer\'s list, a provided link is not valid. Removing link. Link: ${value}`);
                        listLinks[listLinks.length-1].push('#');
                    }
                });
            }
            // Add changeAt
            listChangeAt.push([]);
            if(result.changeAt){
                result.changeAt.forEach( value => {
                    listChangeAt[listChangeAt.length-1].push(value);
                });
            }
        });

        // List changeAt validation
        //================================================================================================================================================
        if(listChangeAt.some( innerArray => innerArray.length > 0)){
            // If one list entry has a changeAt, they all must have one
            if(!(listChangeAt.every( innerArray => innerArray.length > 0))) return argumentError('If one entry in a timer\'s list has a changeAt, they all must have one.');
            // And there can not be a timer changeAt or changeEvery
            if('changeAt' in args || 'changeEvery' in args) return argumentError('If a timer\'s list entries have a changeAt, the timer can not have a changeAt or changeEvery.');
            let newListChangeAt = [];
            let changeAtType = '';
            let invalidTime = false;
            // Replace any instance of sunshift to 06:00E and 18:00E and also make sure Erinn times and Server times are not both present.
            listChangeAt.forEach(innerArray => {
                if(!invalidTime){ // Skip everything if an invalid time was found
                    newListChangeAt.push([]);
                    innerArray.forEach( value => {
                        if(!invalidTime){ // Skip everything if an invalid time was found
                            // Swap sunshift in changeAt with 06:00E and 18:00E
                            if (value.toLowerCase() === 'sunshift'){
                                newListChangeAt[newListChangeAt.length-1].push('06:00E','18:00E');
                                // Make sure there isn't a Server changeAt time present
                                if(!changeAtType) changeAtType = 'E';
                                else if(changeAtType === 'S'){
                                    invalidTime = true;
                                    argumentError('If a timer\'s list entries have a changeAt, they must all be the same type of time (all ending in E for Erinn time or S for Server time).');
                                }
                            // If not sunshift, keep this string as it is
                            }else{
                                // Make sure the type is either S or E
                                if(value[value.length-1].toUpperCase() !== 'S' && value[value.length-1].toUpperCase() !== 'E'){
                                    invalidTime = true;
                                    argumentError('Timer list entry\'s changeAt must end in E for Erinn time or S for Server time.');
                                // Make sure the time is valid
                                } else if(!validateTimeStrings([value])){
                                    invalidTime = true;
                                    argumentError('Timer list entry\'s changeAt must be a valid time. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. The numbers can be 1 or 2 digits (or 3 for milliseconds). Time given: ',value);
                                // Make sure the changeAt values aren't mixing Server and Erinn times
                                }else{
                                    if(!changeAtType || changeAtType === value[value.length-1].toUpperCase()){
                                        // No changeAtType, set it to E or S
                                        if(!changeAtType) changeAtType = value[value.length-1].toUpperCase();
                                        let newValue = value;
                                        // Turn this time into a full time string if it is a Server time
                                        if(changeAtType === 'S'){
                                            // Remove the 'S'
                                            newValue = newValue.slice(0,-1);
                                            // Pad the milliseconds
                                            newValue = newValue.split('.');
                                            if(newValue.length > 1) newValue[1].padStart(3,'0');
                                            else newValue.push('.000');
                                            // Pad the remaining times
                                            newValue[0] = newValue[0].split(':');
                                            newValue[0] = newValue[0].map(val => val.padStart(2,'0'));
                                            while(newValue[0].length < 3){
                                                newValue[0].push('00');
                                            }
                                            // Bring the new time string together
                                            // Join mlliseconds with seconds
                                            newValue[0][newValue[0].length-1] = `${newValue[0][newValue[0].length-1]}.${newValue[1]}`;
                                            // Join everything
                                            newValue = `${newValue[0].join(':')}S`;
                                        }
                                        // Turn this time into a full time string if it is an Erinn time
                                        if(changeAtType === 'E'){
                                            newValue = newValue.slice(0,-1);
                                            newValue = newValue.split(':');
                                            newValue = `${newValue[0].padStart(2,'0')}:${newValue[1].padStart(2,'0')}E`;
                                        }
                                        // Add the time string
                                        newListChangeAt[newListChangeAt.length-1].push(newValue);
                                    }else{
                                        invalidTime = true;
                                        argumentError('If a timer\'s list entries have a changeAt, they must all be the same type of time (all ending in E for Erinn time or S for Server time).');
                                    }
                                }
                            }
                        }
                    });
                }
            });

            // If an invalid time was found, an error message was already given. Just return null.
            if(invalidTime) return null;

            // All times were validated and are now in full time string format in newListChangeAt.
            // Every list entry needs one changeAt time, so list entries with multiple will be duplicated now with one time for each duplicate.
            let splitChangeAt = [];
            let splitListValues = [];
            let splitListLinks = [];
            listValues.forEach( (value, index) => {
                // Split multiple changeAt times into multiple list entries instead
                if(newListChangeAt[index].length > 1){
                    newListChangeAt[index].forEach( changeAtValue => {
                        splitChangeAt.push(changeAtValue);
                        splitListValues.push(value);
                        splitListLinks.push(listLinks[index].slice());
                    });
                // Single changeAt time
                }else{
                    splitChangeAt.push(newListChangeAt[index][0]);
                    splitListValues.push(value);
                    splitListLinks.push(listLinks[index].slice());
                }
            });

            // Now sort the list by the changeAt times.
            // Combine the arrays
            let combined = splitChangeAt.map((changeAt, index) => {
                return { changeAt, value: splitListValues[index], links: splitListLinks[index] };
            });

            // Sort them
            combined.sort((a, b) => {
                // Convert times to Date objects for comparison
                let type = a.changeAt[a.changeAt.length - 1];
                let timeA = new Date(`1970-01-01T${(type === 'S' ? a.changeAt.slice(0,-1) : a.changeAt.slice(0,-1) + ':00.000')}Z`);
                let timeB = new Date(`1970-01-01T${(type === 'S' ? b.changeAt.slice(0,-1) : b.changeAt.slice(0,-1) + ':00.000')}Z`);
                return timeA - timeB;
            });

            // Unzip the arrays into the original variables
            listValues = [];
            listLinks = [];
            listChangeAt = [];
            combined.forEach(obj => {
                listValues.push(obj.value);
                listChangeAt.push(obj.changeAt);
                listLinks.push(obj.links.slice());
            });

            // Calculate an epoch from the first time and store in listEpoch
            if(listChangeAt[0][listChangeAt[0].length - 1] === 'S'){
                // Server time. Just set the epoch to any date with that time. The timer adjusts the epoch automatically for daylight savings changes.
                listEpoch = `2024-11-01T${listChangeAt[0]}`;
            }else{
                // Erinn time. Use Erinn time epoch 2024-11-01T03:00:00.000S and just add the real time minutes, seconds, and milliseconds.
                let erinnMilliseconds = listChangeAt[0].slice(0 , -1).split(":");
                erinnMilliseconds = (Number(erinnMilliseconds[0]) * TIME_PER_ERINN_HOUR) + (Number(erinnMilliseconds[1]) * TIME_PER_ERINN_MINUTE);
                listEpoch = `2024-11-01T03:${String(Math.floor(erinnMilliseconds/60000)).padStart(2,'0')}:${String(Math.floor((erinnMilliseconds%60000)/1000)).padStart(2,'0')}.${String(erinnMilliseconds%1000).padStart(3,'0')}S`;
            }
        }else{
            //no changeAt settings in the list, set it to false
            listChangeAt = false;
        }

        // args basic validations
        //================================================================================================================================================
        // Validate epoch
        if(!('epoch' in args) && !listEpoch) return argumentError('Rotate type timers require an epoch.');
        else if(!listEpoch && args.epoch.length > 1) return argumentError('Rotate type timers require one epoch, not multiple.');
        else if('epoch' in args && listEpoch) argumentError('If the list in a timer use changeAt settings, the epoch is calculated automatically. The supplied epoch setting will be ignored.');
        // A time the rotation started at index 0 (converted to ms) or false if the time provided could not be parsed
        // For changeAt rotation timers, the epoch can be any Server time during which the rotation was at index 0.
        let epoch = listEpoch ? parseServerDateTime(listEpoch) : parseServerDateTime(args.epoch[0]);
        if(!epoch) return argumentError('Rotate type timers requires a valid Server time epoch. Valid formats are yyyy-mm-ddThh:mm:ss.sssS or yyyy-mm-ddThh:mm:ssS or yyyy-mm-ddThh:mmS with the capital T and S being the literal letters. This should be in the server time zone.');

        // Validate filters
        let compress = false;
        if('compress' in args){
            if(args.compress.length > 1) return argumentError('Rotate type timers can only have 1 value for compress.');
            if(args.compress[0].toLowerCase() !== 'true' && args.compress[0].toLowerCase() !== 'false') return argumentError('compress must be "true" or "false".');
            if(args.compress[0].toLowerCase() === 'true') compress = true;
        }

        // Validate changeAt/changeEvery
        if(!('changeAt' in args || listChangeAt) && !('changeEvery' in args)) return argumentError('Rotate type timers require either changeAt or changeEvery.');
        else if(('changeAt' in args || listChangeAt) && 'changeEvery' in args) return argumentError('Rotate type timers cannot take both changeAt and changeEvery.');
        else if('changeEvery' in args && args.changeEvery.length > 1) return argumentError('Rotate type timers can only have one changeEvery.');
        // Making sure the timer does not have both a 'changeAt' in args and a listChangeAt is done above during list validation.
        
        // Assign changeEvery/changeAt time
        let changeEvery = 'changeEvery' in args ? args.changeEvery.slice() : null;
        let changeAt = 'changeAt' in args ? args.changeAt.slice() : 
                        (listChangeAt ? listChangeAt.slice() : null);

        // changeAt validation
        //================================================================================================================================================
        let updatedChangeAt = [];
        let erinnTimes = [];
        let serverTimes = [];
        if(changeAt){
            changeAt.forEach(str => {
                // Swap sunshift in changeAt with 06:00E and 18:00E
                if (str.toLowerCase() === 'sunshift') updatedChangeAt.push('06:00E','18:00E');
                // If not sunshift, keep this string as it is
                else updatedChangeAt.push(str);
            });

            if(!validateTimeStrings(updatedChangeAt)) return argumentError('In a rotate type timer, changeAt has an invalid time string. Valid formats are hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, hh:mmE with the capital S and E being the literal letters. S means server time, E means Erinn time. The numbers can be 1 or 2 digits (or 3 for milliseconds) but must be a valid time. Time given: ',updatedChangeAt);

            // Separate and sort changeAt
            let errorValue = false;

            updatedChangeAt.forEach(str => {
                // Convert the time string to an object with properties "type" (Erinn or Server) and "milliseconds" after midnight
                let convertedTimeString = convertTimeStringToMillisecondsAfterMidnight(str);
                // If the conversion to milliseconds failed, set the errorValue. Otherwise, sort the milliseconds after midnight into the correct array.
                if(!convertedTimeString){
                    errorValue = str;
                }else{
                    convertedTimeString.type === 'Erinn' ? erinnTimes.push(convertedTimeString.milliseconds) : serverTimes.push(convertedTimeString.milliseconds);
                }
            });
            if(errorValue !== false){ // Specifically a boolean check, not a falsy check.
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

        return {listValues, listLinks, epoch, compress, updatedChangeAt, erinnTimes, serverTimes, changeEveryDuration};
    }

    /**
     * Updates the rotation and TimerDisplays for rotate timers with a changeEvery then sets a timeout to call itself again at the next scheduled rotation time.
     * @private
     */
    #updateRotationChangeEvery(){
        // Use setTimeout instead of setInterval. Keep in mind browsers throttle javascript timers when the tab is not active. Timing is not exact and needs to be manually adjusted each time.
        // Recalculate what the rotation should be at now
        let lastRotation = this.rotation;
        let epochTime = this.epoch.dateObject.getTime();
        let currentTime = Date.now();
        this.rotation = Math.floor((currentTime - epochTime) / this.changeEveryDuration.milliseconds);

        // If rotation, depth, or query changed: Update the TimerDisplays
        if(lastRotation !== this.rotation || this.rotationData.length/2 < this.depth || this.queryChanged){
            // Store previous active entry. Needed if compress filter is used.
            let previousActiveEntry = [];
            if(this.rotationData.length > 0) previousActiveEntry = [this.rotationData[0], this.rotationData[1]];
            // Clear rotationData and recalculate all entries
            this.rotationData = [];
            // Keep track of queries that still need to be fulfilled
            let remainingQuery = this.queryDepth.slice();
            let remainingQueryAmount = this.queryDepth.length;
            // Loop until depth is reached and no query remains unfulfilled
            for(let i = 0; this.rotationData.length/2 < this.depth || remainingQueryAmount > 0; i++){
                // If the compress filter is being used and the currently active entry hasn't changed, keep it as it is so the start time doesn't change.
                if(this.compress && i === 0 && previousActiveEntry.length > 0 && this.list[this.rotation % this.list.length] === this.list[previousActiveEntry[0]]){
                    this.rotationData.push(previousActiveEntry[0], previousActiveEntry[1]);
                }else{
                    // Skip and continue to the next loop if compression is on and the last recorded entry has the same list value as this loop's entry.
                    if(this.compress && i !== 0){
                        if(this.list[this.rotationData[this.rotationData.length-2]] === this.list[(this.rotation + i) % this.list.length]) continue;
                    }
                    // Otherwise, record this entry
                    this.rotationData.push((this.rotation + i) % this.list.length,
                        epochTime + ((this.rotation + i) * this.changeEveryDuration.milliseconds));
                }
                // Update queries
                if(remainingQueryAmount > 0){
                    let listValue = this.list[this.rotationData[this.rotationData.length-2]];
                    this.query.forEach( (queryArr, index) => {
                        if(queryArr.includes(listValue)){
                            remainingQuery[index]--;
                            if(remainingQuery[index] === 0){
                                remainingQueryAmount--;
                            }
                        }
                    });
                }
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
        // Adjust epoch time for timezone difference due to daylight savings
        epochTime += getTimezoneOffset(SERVER_TIMEZONE, epochTime) - getTimezoneOffset(SERVER_TIMEZONE, currentTime);
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
            // Get the next scheduled erinnTime and update waitTime.
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

            // Get the next scheduled serverTime and update waitTime.
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
        // If rotation, depth, or query changed: Update the TimerDisplays
        if(lastRotation !== this.rotation || this.rotationData.length/2 < this.depth || this.queryChanged){
            // Store previous active entry. Needed if compress filter is used.
            let previousActiveEntry = [];
            if(this.rotationData.length > 0) previousActiveEntry = [this.rotationData[0], this.rotationData[1]];
            // rotationData is needed for calculations, so store compressed data separately for now.
            let compressedRotationData = [];
            // Keep track of queries that still need to be fulfilled
            let remainingQuery = this.queryDepth.slice();
            let remainingQueryAmount = this.queryDepth.length;
            // Keep track of last time added to rotationData
            // How many milliseconds into the Erinn day the last time was at
            let lastEndInErinnDay = 0;
            // How many milliseconds into the Server day the last time was at
            let lastEndInServerDay = 0;

            // Clear rotationData and recalculate all entries
            this.rotationData = [];

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
            this.rotationData.push(this.rotation % this.list.length,
                                    (lastErinnTime > lastServerTime ? lastErinnTime : lastServerTime));
            // Calculate times in the day
            lastEndInErinnDay = (this.rotationData[1] + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
            lastEndInServerDay = dateToMillisecondsAfterServerMidnight(new Date(this.rotationData[1]));

            // If compress is being used, store compressed data for the first entry
            if(this.compress){
                if(previousActiveEntry.length > 0 && this.list[this.rotation % this.list.length] === this.list[previousActiveEntry[0]]){
                    compressedRotationData.push(previousActiveEntry[0],previousActiveEntry[1]);
                }else{
                    compressedRotationData.push(this.rotationData[0], this.rotationData[1]);
                }
            }

            // Update queries
            if(remainingQueryAmount > 0){
                let listValue = this.list[this.rotationData[this.rotationData.length-2]];
                this.query.forEach( (queryArr, index) => {
                    if(queryArr.includes(listValue)){
                        remainingQuery[index]--;
                        if(remainingQuery[index] === 0){
                            remainingQueryAmount--;
                        }
                    }
                });
            }

            // Rest of rotationData
            //================================================================================================================================================
            // For all other indexes, get the start time immediately after the previous start time.
            for(let i = 1; (this.compress ? compressedRotationData.length/2 < this.depth : i < this.depth) || remainingQueryAmount > 0; i++){
                let nextErinnTime = Infinity;
                let nextServerTime = Infinity;
                let lastRotationTime = this.rotationData[(i-1)*2+1];
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
                this.rotationData.push((this.rotation + i) % this.list.length,
                                        (nextErinnTime < nextServerTime ? nextErinnTime : nextServerTime));
                // Calculate times in the day
                lastEndInErinnDay = (this.rotationData[i*2+1] + ERINN_TIME_OFFSET) % TIME_PER_ERINN_DAY;
                lastEndInServerDay = dateToMillisecondsAfterServerMidnight(new Date(this.rotationData[i*2+1]));

                // If compress is not being used, update query.
                // If compress is being used, only update query and store compressed data for this entry if the entry value is not the same as the last recorded entry's value.
                if(!this.compress || this.list[(this.rotation + i) % this.list.length] !== this.list[compressedRotationData[compressedRotationData.length - 2]]){
                    if(this.compress) compressedRotationData.push(this.rotationData[this.rotationData.length - 2], this.rotationData[this.rotationData.length - 1]);

                    // Update queries
                    if(remainingQueryAmount > 0){
                        let listValue = this.list[(this.rotation + i) % this.list.length];
                        this.query.forEach( (queryArr, index) => {
                            if(queryArr.includes(listValue)){
                                remainingQuery[index]--;
                                if(remainingQuery[index] === 0){
                                    remainingQueryAmount--;
                                }
                            }
                        });
                    }
                }
            }

            // If compress is being used, rotationData becomes the compressed rotationData
            if(this.compress) this.rotationData = compressedRotationData.slice();

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