import { TIME_PAGE_LOAD, SERVER_TIMEZONE, ERINN_TIME_OFFSET, TIME_PER_ERINN_MINUTE, TIME_PER_ERINN_HOUR, TIME_PER_ERINN_DAY, camelCase } from '../helper/utils.js';
import { TimerDisplay } from './TimerDisplay.js'

/**  
 * @class ClockTimerDisplay
 * @classdesc A basic display to show the current time in Server time, local time, or Erinn time. No Timer needed.
 * 
 * Whether Server, Local, or Erinn time is shown depends on the last letter used in the timeFormat setting.
 * 
 * Optionally in settings, a clock timer display may have the following:
 * 
 *  - timeFormat: How to format any time displayed by this timer display. The number of letters is the minimum digit count (padded with 0s). Ends with a S for server time, E for Erinn time, L for local time. See {@link TimerDisplay.formatTimeClock} Default: h:mm:ssS
 *  - 12hour: true or false. If true, time is displayed in 12 hour format with a space and AM/PM at the end. Default: false
 *  - entryFormat: How to format the single entry of this display. %t for the time. For example: {The current time is %t.} Default: {%t}
 *  - entryStyle: Adds the given style to the outer div containing the time and additional text from entryFormat.
 *  - timeStyle: Adds the given style to the div containing the time.
 *  - entryClass: Adds the given CSS class name to the outer div containing the time and additional text from entryFormat.
 *  - timeClass: Adds the given CSS class name to the div containing the time.
 * 
 * @param {HTMLElement} element - The HTML element for this display
 * @param {Object} args - The args object created from the element with the "settings" class
 */
export class ClockTimerDisplay extends TimerDisplay{
    constructor(element, args){
        super();

        // Validate and convert the args into the values used by this class.
        let validatedParameters = ClockTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return null;

        /**
         * The HTML element for this display
         * @type {HTMLElement}
         */
        this.element = element;

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
         * Whether or not to display the time in 12 hour format with AM/PM at the end
         * @type {Boolean}
         */
        this.is12hour = validatedParameters.is12hour;

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
         * The style for the div containing the time
         * @type {String}
         */
        this.timeStyle = validatedParameters.timeStyle;
        /**
         * The class name for the outer div for an entry
         * @type {String}
         */
        this.entryClass = validatedParameters.entryClass;
        /**
         * The class name for the div containing the time
         * @type {String}
         */
        this.timeClass = validatedParameters.timeClass;
        
        /**
         * The original arguments from the settings element
         * @type {Object}
         */
        this.args = args;

        /**
         * The HTML Element containing the time
         * @type {JQuery<HTMLElement>|null}
         */
        this.dataElement = null;
        
        /**
         * The currently queued timeout
         * @type {Number|null}
         */
        this.timeout = null;
        
        /**
         * The next scheduled update in milliseconds since unix epoch (to deal with timeout triggering early)
         * @type {Number}
         */
        this.nextUpdate = 0;

        // Make sure functions provided as callbacks to requestAnimationFrame don't lose "this" context.
        this.updateData = this.#updateData.bind(this);
        this.queueNextUpdate = this.#queueNextUpdate.bind(this);

        // Immediately initialize and begin drawing this display
        this.initializeElements();
        /**
         * The currently queued requestAnimationFrame (to prevent queueing multiple frames when the tab is inactive)
         * @type {Number|null}
         */
        this.redrawID = requestAnimationFrame(this.updateData);
    }

     /**
     * Clears the display's element and recreates its contents.
     * 
     * Note: Entries will have no text content until the next {@link ClockTimerDisplay.redraw|redraw}.
     */
    initializeElements(){
        // Empty the display's HTML
        $(this.element).empty();
        this.dataElement = null;
        // Container to append all elements at once
        let $elements = $();

        // Sanitize the CSS styles
        // Sanitize the entry style
        let entryStyleObj = this.entryStyle.split(';').reduce((accumulator, style) => {
            let [key, value] = style.split(':');
            if (key && value) {
                // A whitelist could be applied here to control which CSS styles are permitted
                accumulator[camelCase(key.trim())] = value.trim();
            }
            return accumulator;
        }, {});

        // Sanitize the time style
        let timeStyleObj = this.timeStyle.split(';').reduce((accumulator, style) => {
            let [key, value] = style.split(':');
            if (key && value) {
                // A whitelist could be applied here to control which CSS styles are permitted
                accumulator[camelCase(key.trim())] = value.trim();
            }
            return accumulator;
        }, {});

        // Split the entryFormat at the placeholder
        let templateParts = this.entryFormat.split(/(%t)/);

        // The wrapper for the entry, with entryClass and entryStyle applied
        let $entry = $('<div></div>').addClass(this.entryClass).css(entryStyleObj);
    
        let $timePart = null;
    
        // Iterate through the templateParts and replace the placeholder
        templateParts.forEach(part => {
            // Entry time
            if (part === '%t') {
                $timePart = $('<div></div>').addClass(this.timeClass).css(timeStyleObj);
                $entry.append($timePart);
            // Treat other parts as plain text
            } else {
                $entry.append(document.createTextNode(part));
            }
        });
    
        // Add the entry's time div to this.dataElement so it can be updated
        this.dataElement = $timePart;
        // Add the entry to the container to later append to the HTML
        $elements = $elements.add($entry);

        // Append all created elements to the parent element
        $(this.element).append($elements);
    }

    /**
     * Queue the next requestAnimationFrame only if one is not already queued
     */
    #queueNextUpdate(){
        if(!this.redrawID){
            this.redrawID = requestAnimationFrame(this.updateData);
        }
    }

    /**
     * Determine if time has changed and if so redraw the display.
     */
    #updateData(timestamp){
        // Allow new requestAnimaitonFrame to be queued
        this.redrawID = null;
        // Remove decimal from timestamp
        timestamp = Math.floor(timestamp);
        // Determine the current time
        let currTime = TIME_PAGE_LOAD + timestamp;
        // Redraw if next scheduled time was reached
        if(currTime >= this.nextUpdate){
            this.redraw(timestamp);
            // Determine precision in milliseconds
            let precision = 1;
            if(this.timeFormat[this.timeFormat.length - 1] === "E"){
                precision = (this.precision === 's' ? Math.floor(TIME_PER_ERINN_MINUTE/60) : 
                            (this.precision === 'm' ? TIME_PER_ERINN_MINUTE : TIME_PER_ERINN_HOUR));
            }else{
                precision = (this.precision === '.s' ? 1 : 
                            (this.precision === 's' ? 1000 : 
                            (this.precision === 'm' ? 60000 : 3600000)));
            }
            // Determine when the next scheduled time should be, minimum 1ms from now
            this.nextUpdate = Math.max(currTime + precision - (currTime % precision) , currTime + 1);
        }
        // Queue the timeout again at the next scheduled time.
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.queueNextUpdate, this.nextUpdate - currTime);
    }

    /**
     * Redraw the HTML contents of this display.
     * This is the most CPU intensive part of displays, so it should only be done if a time has changed.
     * {@link ClockTimerDisplay.updateData|this.updateData} would determine that and call redraw automatically if necessary.
     * 
     * Note: The display should be initialized with {@link ClockTimerDisplay.initializeElements|this.initializeElements} before redrawing. redraw assumes the display's elements already exist.
     */
    redraw(timestamp){
        // Just update the time
        if(this.dataElement){
            this.dataElement.text(TimerDisplay.formatTimeClock(TIME_PAGE_LOAD + timestamp, this.timeFormat, this.is12hour));
        }
    }

    /**
     * Take the settings and turns it into the correct values used by this class, or returns null if a setting is invalid
     * @param {Object} args - The original settings provided
     */
    static #validateParameters(args){
        // Validate all args common to most displays
        let returnObject = TimerDisplay.argValidationAndConversion(args , "clock");
        if(!returnObject) return null;
        
        return returnObject;
    }
}