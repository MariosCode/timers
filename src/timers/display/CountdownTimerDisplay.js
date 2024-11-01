import { TimerDisplay } from "./TimerDisplay.js";
import { Timer } from "../timer/Timer.js";
import { TIME_PAGE_LOAD, timerDisplayCreationError, timerDisplayError, camelCase, TIME_PER_ERINN_MINUTE, TIME_PER_ERINN_HOUR, TIME_PER_ERINN_DAY } from "../helper/utils.js";

/**  
 * @class CountdownTimerDisplay
 * @classdesc Takes output from a Timer and prints it to HTML based on settings. Shows a countdown for each entry.
 * 
 * The following settings are required in an element with the class "settings":
 * 
 *  - timer: The ID of the timer to receive updates from
 * 
 * Optionally in settings, a countdown timer display may have the following:
 * 
 *  - depth: A number for how many entries to show. The first entry given is the currently active entry in the timer. Default: 1
 *  - verbose: true or false. If true, time is displayed with english words. For example "6 days, 10 hours, 58 minutes, 1 second". Default: false
 *  - timeFormat: How to format the duration of time displayed. The number of letters is the minimum digit count (padded with 0s). See {@link TimerDisplay.formatTimeDuration} Default: h:mm:ssS
 *      >- hideLeading0: true or false. Removes leading zeroes from the formatted time. For example, 0:10:0:10S with the d:hh:mm:ssS format would display as 10:00:10. Default: true
 *      >- hideAll0: true or false. Removes all zeroes from the formatted time. For example, 0:1:0:10S with the "d:hh:mm:ssS" format and verbose would be "1 hour, 10 seconds". Default: false
 *  - entryFormat: How to format each entry of the display. %v for entry's value and %t for entry's time. %l#_ and %l to wrap text in that number link from this list item. For example: {%l1_%v%l will begin in %t.} Default: {%t %v}
 *  - entryStyle: Adds the given style to each outer div containing the entry's value, time, and additional text from entryFormat.
 *  - valueStyle: Adds the given style to each div containing the entry's value.
 *  - timeStyle: Adds the given style to each div containing the entry's time.
 *  - entryClass: Adds the given CSS class name to each outer div containing the entry's value, time, and additional text from entryFormat.
 *  - valueClass: Adds the given CSS class name to each div containing the entry's value.
 *  - timeClass: Adds the given CSS class name to each div containing the entry's time.
 *  - startAtEntry: Display entries starting at this entry number. Useful when stringing multiple displays together for more control over styling. Default: 1
 *  - endAtEntry: Display entries ending at this entry number. Useful when stringing multiple displays together for more control over styling. Default: Equal to the depth
 * 
 *  - filter: A filter to apply to data received by a timer. Valid filters are:
 *      >- query: Filter the data supplied by the timer to only display entries whose value matches one of these query strings.
 *          Note this will make the timer's depth dynamic. It will continue adding entries to its returned data until it reaches this display's depth number of queried entries.
 * 
 * @param args - The args object created from the element with the "settings" class
 */
export class CountdownTimerDisplay extends TimerDisplay{
    constructor(element, args){
        super();

        // Validate and convert the args into the values used by this class.
        let validatedParameters = CountdownTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return null;

        /**
         * The HTML element for this display
         * @type {HTMLElement}
         */
        this.element = element;

        /**
         * The ID on the HTML element containing the Timer this display will attach to
         * @type {String}
         */
        this.timerId = validatedParameters.timerId;

        /**
         * The minimum number of scheduled entries the Timer must give to {@link CountdownTimerDisplay.updateData|updateData}.
         * @type {Number}
         */
        this.depth = validatedParameters.depth;

        /**
         * The Timer instance this display is attached to
         * @type {Timer}
         */
        this.timer = validatedParameters.timer;

        /**
         * Whether or not to use english words. For example "6 days, 10 hours, 58 minutes, 1 second".
         * @type {Boolean}
         */
        this.verbose = validatedParameters.verbose;

        /**
         * Whether or not to hide leading zeroes from the formatted time
         * @type {Boolean}
         */
        this.hideLeading0 = validatedParameters.hideLeading0;

        /**
         * Whether or not to hide all zeroes from the formatted time
         * @type {Boolean}
         */
        this.hideAll0 = validatedParameters.hideAll0;

        /**
         * The format to use for the displayed time. Example: "h:mm:ssS"
         * @type {String}
         */
        this.timeFormat = validatedParameters.timeFormat;

        /**
         * The lowest unit of time present in the time format above. Used to only update clock when necessary.
         * This can be "h", "m", "s", or ".s" for milliseconds
         * @type {String}
         */
        this.precision = validatedParameters.precision;

        /**
         * The format to use for each displayed entry. Example: "{%t %v}"
         * @type {String}
         */
        this.entryFormat = validatedParameters.entryFormat;

        /**
         * The style for the outer div for an entry
         * @type {String}
         */
        this.entryStyle = validatedParameters.entryStyle;
        /**
         * The style for the div containing the entry's value
         * @type {String}
         */
        this.valueStyle = validatedParameters.valueStyle;
        /**
         * The style for the div containing the entry's time
         * @type {String}
         */
        this.timeStyle = validatedParameters.timeStyle;
        /**
         * The class name for the outer div for an entry
         * @type {String}
         */
        this.entryClass = validatedParameters.entryClass;
        /**
         * The class name for the div containing the entry's value
         * @type {String}
         */
        this.valueClass = validatedParameters.valueClass;
        /**
         * The class name for the div containing the entry's time
         * @type {String}
         */
        this.timeClass = validatedParameters.timeClass;

        /**
         * Displays entries starting at this entry number
         * @type {Number}
         */
        this.startAtEntry = validatedParameters.startAtEntry;

        /**
         * Displays entries ending at this entry number
         * @type {Number}
         */
        this.endAtEntry = validatedParameters.endAtEntry;

        /**
         * Filters timer data to only display entries whose value matches a string in query
         * @type {String[]}
         */
        this.query = validatedParameters.query;

        /**
         * The original arguments provided from the settings element
         * @type {Object}
         */
        this.args = args;

        /**
         * The currently queued requestAnimationFrame (to prevent queueing multiple frames when the tab is inactive)
         * @type {Number|null}
         */
        this.redrawID = null;

        /**
         * Data obtained from the attached timer
         * @type {Number[]}
         */
        this.timerData = [];

        /**
         * The HTML Elements containing the data from timerData
         * @type {JQuery<HTMLElement>[]}
         */
        this.dataElements = [];

        /**
         * The HTML Elements containing the links created from the entryFormat
         * @type {JQuery<HTMLElement>[][]}
         */
        this.linkElements = [];
        
        /**
         * The last time in milliseconds since unix epoch the clock updated its contents (to prevent excessive updates)
         * @type {Number}
         */
        this.lastUpdate = 0;
        
        /**
         * The next scheduled update in milliseconds since unix epoch (to deal with timeout triggering early)
         * @type {Number}
         */
        this.nextUpdate = 0;

        /**
         * The next scheduled timeout (used to make sure multiple timeouts aren't simultaneously queued)
         * @type {Number|null}
         */
        this.timeout = null;

        // Make sure functions provided as callbacks to requestAnimationFrame don't lose "this" context.
        this.redraw = this.#redraw.bind(this);
        this.queueNextUpdate = this.#queueNextUpdate.bind(this);

        // Immediately initialize this display
        this.initializeElements();
        this.timer.attachDisplay(this);
    }

    /**
     * Handles udpated data from a Timer. Note a data update does not mean the data actually changed since the last update.
     * @param {Number[]} newTimerData - An array with the entry index from the timer's list and its start time as unix epoch. First 2 numbers in this array are for the currently active entry.
     */
    updateData(newTimerData){
        // Apply query filter to the received data
        if(this.query.length > 0){
            let list = this.timer.list;
            for(let i = newTimerData.length-2; i >=0; i -= 2){
                if(!this.query.includes(list[newTimerData[i]])) newTimerData.splice(i,2);
            }
        }
        
        this.updateDisplay(newTimerData, false);
    }

    /**
     * Using updated data from a timer, updates properties and queues a redraw of the display's HTML contents.
     * @param {Number[]} newTimerData - An array with the entry index from the timer's list and its start time as unix epoch. First 2 numbers in this array are for the currently active entry.
     */
    updateDisplay(newTimerData){
        // Cancel if updating display with this data is impossible
        if(newTimerData.length/2 < this.depth) return timerDisplayError(`Countdown type timer display failed an update due to invalid timerData length. Length expected: ${this.depth*2} timerData:`, newTimerData); 
        
        this.timerData = newTimerData.slice();

        // Redraw the display on the next animation frame if a redraw isn't already queued
        if(this.redrawID === null){
            this.redrawID = requestAnimationFrame(this.redraw);
        }
    }

    /**
     * Queue the next requestAnimationFrame. Meant to be used with setTimeout.
     */
    #queueNextUpdate(){
        if(this.redrawID === null){
            this.redrawID = requestAnimationFrame(this.redraw);
        }
    }

    /**
     * Redraws the HTML contents of this display.
     * This will recalculate what each entry time and value should be displaying.
     * 
     * Note: The display should be initialized with {@link CountdownTimerDisplay.initializeElements|initializeElements} before redrawing. redraw assumes the display's elements already exist.
     * @param {Number} timestamp - The timestamp provided by requestAnimationFrame
     */
    #redraw(timestamp){
        // Remove decimal from timestamp
        timestamp = Math.floor(timestamp);
        // Determine the current time
        let currTime = TIME_PAGE_LOAD + timestamp;
        // Determine precision in milliseconds
        let precision = 1;
        // Erinn time
        if(this.timeFormat[this.timeFormat.length - 1] === "E"){
            precision = (this.precision === 's' ? Math.floor(TIME_PER_ERINN_MINUTE/60) : 
                        (this.precision === 'm' ? TIME_PER_ERINN_MINUTE : 
                        (this.precision === 'h' ? TIME_PER_ERINN_HOUR : TIME_PER_ERINN_DAY)));
        // Real time
        }else{
            precision = (this.precision === '.s' ? 1 : 
                        (this.precision === 's' ? 1000 : 
                        (this.precision === 'm' ? 60000 : 
                        (this.precision === 'h' ? 3600000 : 86400000))));
        }
        // Determine when the next scheduled time should be, minimum 1ms from now
        this.nextUpdate = Math.max(currTime + precision - (currTime % precision) , currTime + 1);

        // Loop through all entries
        for(let i = 0; i < this.depth; i++){
            // Update entry time
            if(this.dataElements[i*2]){
                this.dataElements[i*2].text(TimerDisplay.formatTimeDuration( Math.floor(Math.max(this.timerData[i*2+1] - TIME_PAGE_LOAD - timestamp, 0)), this.timeFormat, this.verbose, this.hideLeading0, this.hideAll0));
            }
            // Update entry value
            if(this.dataElements[i*2 + 1]){
                this.dataElements[i*2 + 1].text(this.timer.list[this.timerData[i*2]]);
            }
            // Update entry links
            if(this.linkElements[i].length > 0){
                for(let k = 0; k < this.linkElements[i].length; k++){
                    if(this.timer.listLinks[this.timerData[i*2]][this.linkElements[i][k].data(linkIndex)] != null){
                        this.linkElements[i][k].prop('href', this.timer.listLinks[this.timerData[i*2]][this.linkElements[i][k].data(linkIndex)]);
                    }else{
                        this.linkElements[i][k].prop('href', '#');
                    }
                }
            }
        }
        // Queue the next redraw at the next scheduled time
        clearTimeout(this.timeout);
        this.redrawID = null;
        this.timeout = setTimeout(this.queueNextUpdate, this.nextUpdate - currTime);
    }

    /**
     * Clears the display's element and recreates its contents.
     * 
     * Note: Entries will have no text content until the next {@link CountdownTimerDisplay.redraw|redraw}.
     */
    initializeElements(){
        // Empty the display's HTML
        $(this.element).empty();
        this.dataElements = [];
        // Container to append all elements at once
        let $elements = $();

        // Sanitize the CSS styles
        // Entry style
        let entryStyleObj = this.entryStyle.split(';').reduce((accumulator, style) => {
            let [key, value] = style.split(':');
            if (key && value) {
                // A whitelist could be applied here to control which CSS styles are permitted
                accumulator[camelCase(key.trim())] = value.trim();
            }
            return accumulator;
        }, {});

        // Value style
        let valueStyleObj = this.valueStyle.split(';').reduce((accumulator, style) => {
            let [key, value] = style.split(':');
            if (key && value) {
                // A whitelist could be applied here to control which CSS styles are permitted
                accumulator[camelCase(key.trim())] = value.trim();
            }
            return accumulator;
        }, {});

        // Time style
        let timeStyleObj = this.timeStyle.split(';').reduce((accumulator, style) => {
            let [key, value] = style.split(':');
            if (key && value) {
                // A whitelist could be applied here to control which CSS styles are permitted
                accumulator[camelCase(key.trim())] = value.trim();
            }
            return accumulator;
        }, {});

        // Split the entryFormat at the placeholders
        let templateParts = this.entryFormat.split(/(%v|%t|%l\d+_|%l)/);

        // Loop through every entry
        for (let i = 0; i < this.depth; i++) {
            // The wrapper for the entry, with entryClass and entryStyle applied
            let $entry = $('<div></div>').addClass(this.entryClass).css(entryStyleObj);
        
            let $valuePart = null;
            let $timePart = null;
            let $currentLink = null;
            this.linkElements.push([]);
        
            // Iterate through the templateParts and replace placeholders
            templateParts.forEach(part => {
                // Beginning of a link
                if(/^%l\d+_$/.test(part) && !$currentLink){
                    $currentLink =  $('<a></a>').prop('href', '#');
                    // Store which link to use in the array of links in the timer for this list item
                    $currentLink.data('linkIndex', Number(part.slice(2,-1)) - 1);
                    this.linkElements[this.linkElements.length-1].push($currentLink);
                    $entry.append($currentLink);
                // Ending of a link
                } else if(part === '%l' && $currentLink != null){
                    $currentLink = null;
                // Entry time
                } else if (part === '%t') {
                    $timePart = $('<div></div>').addClass(this.timeClass).css(timeStyleObj);
                    $currentLink != null ? $currentLink.append($timePart) : $entry.append($timePart);
                // Entry value
                } else if (part === '%v') {
                    $valuePart = $('<div></div>').addClass(this.valueClass).css(valueStyleObj);
                    $currentLink != null ? $currentLink.append($valuePart) : $entry.append($valuePart);
                // Treat other parts as plain text
                } else {
                    $currentLink != null ? $currentLink.append(document.createTextNode(part)) : $entry.append(document.createTextNode(part));
                }
            });
        
            // Add the entry's time and value divs to this.dataElements so they can be updated
            this.dataElements.push($timePart , $valuePart);
            // Add the entry to the container to later append to the HTML
            $elements = $elements.add($entry);
        }

        // Append all created elements to the parent element
        $(this.element).append($elements);
    }

    /**
     * Take the settings and turns it into the correct values used by this class, or returns null if a setting is invalid
     * @param {Object} args - The original settings provided
     */
    static #validateParameters(args){
        // Validate all args common to most displays
        let returnObject = TimerDisplay.argValidationAndConversion(args , "countdown");
        if(!returnObject) return null;

        // Validate verbose
        returnObject.verbose = false;
        if('verbose' in args){
            if(args['verbose'].length > 1) return timerDisplayCreationError('verbose can not have more than 1 value.');
            if(args['verbose'][0].toLowerCase() === 'false') returnObject.verbose = false;
            else if(args['verbose'][0].toLowerCase() === 'true') returnObject.verbose = true;
            else return timerDisplayCreationError('verbose must be true or false.');
        }

        // Validate hideLeading0
        returnObject.hideLeading0 = true;
        if('hideLeading0' in args){
            if(args['hideLeading0'].length > 1) return timerDisplayCreationError('hideLeading0 can not have more than 1 value.');
            if(args['hideLeading0'][0].toLowerCase() === 'false') returnObject.hideLeading0 = false;
            else if(args['hideLeading0'][0].toLowerCase() === 'true') returnObject.hideLeading0 = true;
            else return timerDisplayCreationError('hideLeading0 must be true or false.');
        }

        // Validate hideAll0
        returnObject.hideAll0 = true;
        if('hideAll0' in args){
            if(args['hideAll0'].length > 1) return timerDisplayCreationError('hideAll0 can not have more than 1 value.');
            if(args['hideAll0'][0].toLowerCase() === 'false') returnObject.hideAll0 = false;
            else if(args['hideAll0'][0].toLowerCase() === 'true') returnObject.hideAll0 = true;
            else return timerDisplayCreationError('hideAll0 must be true or false.');
        }

        return returnObject;
    }
}