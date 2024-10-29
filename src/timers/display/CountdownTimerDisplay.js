import { TimerDisplay } from "./TimerDisplay.js";
import { Timer } from "../timer/Timer.js";
import { TIME_PAGE_LOAD, timerDisplayCreationError, timerDisplayError, camelCase } from "../helper/utils.js";

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
 *      >- hideAll0: true or false. Removes all zeroes from the formatted time. For example, 0:1:0:10S with the "d:hh:mm:ssS" format would be "1 hour, 10 seconds". Default: false
 *  - entryFormat: How to format each entry of the display. %v for entry's value and %t for entry's time. For example: {%v will begin in %t.} Default: {%t %v}
 *  - entryStyle: Adds the given style to each outer div containing the entry's value, time, and additional text from entryFormat.
 *  - valueStyle: Adds the given style to each div containing the entry's value.
 *  - timeStyle: Adds the given style to each div containing the entry's time.
 *  - entryClass: Adds the given CSS class name to each outer div containing the entry's value, time, and additional text from entryFormat.
 *  - valueClass: Adds the given CSS class name to each div containing the entry's value.
 *  - timeClass: Adds the given CSS class name to each div containing the entry's time.
 *  - startAtEntry: Displays entries starting at this entry number. Useful when stringing multiple displays together for more control over styling. Default: 1
 *  - endAtEntry: Displays entries ending at this entry number. Useful when stringing multiple displays together for more control over styling. Default: Equal to the depth
 * 
 *  - filter: A filter to apply to data received by a timer. Valid filters are:
 *      >- query: Filter the data supplied by the timer to only display entries whose value matches one of these query strings.
 *          Note this will make the timer's depth dynamic. It will continue adding entries to its returned data until it reaches this display's depth number of queried entries.
 */
export class CountdownTimerDisplay extends TimerDisplay{
    /**
     * Constructor for {@link CountdownTimerDisplay}
     * @param args - The args object created from the element with the "settings" class
     */
    constructor(element, args){
        super();

        // Validate and convert the given parameters into the values used by this class.
        let validatedParameters = CountdownTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return null;

        /**
         * The HTML element for this display
         * @type {HTMLElement}
         */
        this.element = element;

        /**
         * The ID of the Timer to attach this display to
         * @type {String}
         */
        this.timerId = validatedParameters.timerId;

        /**
         * The minimum number of scheduled entries the Timer must give to {@link ListTimerDisplay.updateData|updateData}.
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
         * The format to use for each displayed entry. Example: "{%t %v}"
         * @type {String}
         */
        this.entryFormat = validatedParameters.entryFormat;

        // Adds styles and class names to the generated divs
        this.entryStyle = validatedParameters.entryStyle;
        this.valueStyle = validatedParameters.valueStyle;
        this.timeStyle = validatedParameters.timeStyle;
        this.entryClass = validatedParameters.entryClass;
        this.valueClass = validatedParameters.valueClass;
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
         * @type {Number[][]}
         */
        this.timerData = [];

        /**
         * The HTML Elements containing the data from timerData
         * @type {JQuery<HTMLElement>[]}
         */
        this.dataElements = [];

        this.redraw = this.#redraw.bind(this);

        this.initializeElements();
        this.timer.attachDisplay(this);
    }

    /**
     * Handles udpated data from a Timer. Note a data update does not mean the data actually changed since the last update.
     * @param {Number[][]} newTimerData - 2D array with the entry index from the timer's list and its start time as unix epoch. First entry in this array is the currently active entry.
     */
    updateData(newTimerData){
        // Apply query filter
        if(this.query.length > 0){
            let list = this.timer.list;
            for(let i = newTimerData.length-2; i >=0; i -= 2){
                if(!this.query.includes(list[newTimerData[i]])) newTimerData.splice(i,2);
            }
        }
        
        this.updateDisplay(newTimerData, false);
    }

    /**
     * Using updated data from a timer, updates properties and queues a redraw of the display's HTML contents if necessary.
     * @param {Number[][]} newTimerData - 2D array with the entry index from the timer's list and its start time as unix epoch. First entry in this array is the currently active entry.
     * @param {Boolean} forceRedraw - Whether or not to force a redraw even if there is no change in data.
     * @returns 
     */
    updateDisplay(newTimerData, forceRedraw){
        // Cancel if updating display with this data is impossible
        if(newTimerData.length/2 < this.depth) return timerDisplayError(`Countdown type timer display failed an update due to invalid timerData length. Length expected: ${this.depth*2} timerData:`, newTimerData); 
        // Checking here if a countdown display needs to redraw would cause slight desyncs between timers due to varying Date.now values. It is better to use the timestamp provided by requestAnimationFrame.
        this.timerData = newTimerData.slice();

        // Redraw the display on the next animation frame if a redraw isn't already queued
        if(this.redrawID === null){
            this.redrawID = requestAnimationFrame(this.redraw);
        }
    }

    /**
     * Redraws the HTML contents of this display.
     * This will recalculate what each entry time and value should be displaying.\
     * 
     * Note: The display should be initialized with {@link CountdownTimerDisplay.initializeElements|initializeElements} before redrawing. redraw assumes the display's elements already exist.
     * @param {Number} timestamp - The timestamp provided by requestAnimationFrame
     */
    #redraw(timestamp){
        timestamp = Math.floor(timestamp);
        // Loop through all entries
        for(let i = 0; i < this.depth; i++){
            // Update time
            if(this.dataElements[i*2]){
                this.dataElements[i*2].text(TimerDisplay.formatTimeDuration( Math.floor(Math.max(this.timerData[i*2+1] - TIME_PAGE_LOAD - timestamp, 0)), this.timeFormat, this.verbose, this.hideLeading0, this.hideAll0));
            }
            // Update entry value
            if(this.dataElements[i*2 + 1]){
                this.dataElements[i*2 + 1].text(this.timer.list[this.timerData[i*2]]);
            }
        }
        // Immediately queue a new redraw.
        this.redrawID = requestAnimationFrame(this.redraw);
    }

    /**
     * Clears the display's element and recreates its contents.
     * 
     * Note: Entries will have no text content until the next {@link CountdownTimerDisplay.redraw|redraw}. Use  {@link CountdownTimerDisplay.updateDisplay|this.updateDisplay(this.timerData, true)} to force a redraw.
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

        // Split the template at the placeholders
        let templateParts = this.entryFormat.split(/(%v|%t)/);

        // Loop through every entry
        for (let i = 0; i < this.depth; i++) {
            // The wrapper for the entry, with entryClass and entryStyle applied
            let $entry = $('<div></div>').addClass(this.entryClass).css(entryStyleObj);
        
            let $valuePart = null;
            let $timePart = null;
        
            // Iterate through the templateParts and replace placeholders
            templateParts.forEach(part => {
                // Entry time
                if (part === '%t') {
                    $timePart = $('<div></div>').addClass(this.timeClass).css(timeStyleObj);
                    $entry.append($timePart);
                // Entry value
                } else if (part === '%v') {
                    $valuePart = $('<div></div>').addClass(this.valueClass).css(valueStyleObj);
                    $entry.append($valuePart);
                // Treat other parts as plain text
                } else {
                    $entry.append(document.createTextNode(part));
                }
            });
        
            // Add the entry's time and value divs to this.dataElements so they can be updated
            this.dataElements.push($timePart , $valuePart);
            // Add the entry to the container to later append to the HTML
            $elements = $elements.add($entry);
        }

        // Append all created elements to the parent element at once
        $(this.element).append($elements);
    }

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