import { TIME_PAGE_LOAD, SERVER_TIMEZONE, ERINN_TIME_OFFSET, TIME_PER_ERINN_MINUTE, TIME_PER_ERINN_HOUR, TIME_PER_ERINN_DAY } from '../helper/utils.js';
import { TimerDisplay } from './TimerDisplay.js'

/**  
 * @class ClockTimerDisplay
 * @classdesc A basic display to show the current time in Server time, local time, or Erinn time. No Timer needed.
 * 
 * Whether Server, Local, or Erinn time is shown depends on the last letter used in the optional timeFormat setting.
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
 */
export class ClockTimerDisplay extends TimerDisplay{
    constructor(element, args){
        super();

        // Validate and convert the given parameters into the values used by this class.
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

        // Adds styles and class names to the generated divs
        this.entryStyle = validatedParameters.entryStyle;
        this.timeStyle = validatedParameters.timeStyle;
        this.entryClass = validatedParameters.entryClass;
        this.timeClass = validatedParameters.timeClass;
        
        /**
         * The original arguments provided from the settings element
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
         * The last time in milliseconds since unix epoch the clock updated its contents (to prevent excessive updates)
         * @type {Number}
         */
        this.lastUpdate = 0;
        
        /**
         * The next scheduled update in milliseconds since unix epoch (to deal with timeout inaccuracies causing an early update)
         * @type {Number}
         */
        this.nextUpdate = 0;

        this.updateData = this.#updateData.bind(this);
        this.queueNextUpdate = this.#queueNextUpdate.bind(this);

        this.initializeElements();
        requestAnimationFrame(this.updateData);
    }

     /**
     * Clears the display's element and recreates its contents.
     * 
     * Note: Entries will have no text content until the next {@link ListTimerDisplay.redraw|redraw}. Use  {@link ListTimerDisplay.updateDisplay|this.updateDisplay(this.timerData, true)} to force a redraw.
     */
    initializeElements(){
        // Empty the display's HTML
        $(this.element).empty();
        this.dataElement = null;
        // Container to append all elements at once
        let $elements = $();

        // Sanitize the CSS styles
        function camelCase(str){
            return str.replace(/-([a-z])/gi, function(match, letter){
                return letter.toUpperCase();
            });
        }
        // Entry style
        let entryStyleObj = this.entryStyle.split(';').reduce((accumulator, style) => {
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

        // Split the template at the placeholder
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

        // Append all created elements to the parent element at once
        $(this.element).append($elements);
    }

    /**
     * Queue the next requestAnimationFrame
     */
    #queueNextUpdate(){
        requestAnimationFrame(this.updateData);
    }

    /**
     * Determines if time has changed and if so redraws.
     */
    #updateData(timestamp){
        timestamp = Math.floor(timestamp);
        // Determine the current time
        let currTime = TIME_PAGE_LOAD + timestamp;
        // Update if next scheduled time was reached
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
     * Redraws the HTML contents of this display.
     * This will recalculate what the time should be displaying, so it should only be done if a time has changed.
     * {@link ClockTimerDisplay.updateData|this.updateData} would determine that and call redraw automatically if necessary.
     * 
     * Note: The display should be initialized with {@link ClockTimerDisplay.initializeElements|this.initializeElements} before redrawing. redraw assumes the display's elements already exist.
     */
    redraw(timestamp){
        // Update time
        if(this.dataElement){
            this.dataElement.text(TimerDisplay.formatTimeClock(TIME_PAGE_LOAD + timestamp, this.timeFormat, this.is12hour));
        }
    }

    static #validateParameters(args){
        // Validate all args common to most displays
        let returnObject = TimerDisplay.argValidationAndConversion(args , "clock");
        if(!returnObject) return null;
        
        return returnObject;
    }
}