import { TimerDisplay } from "./TimerDisplay.js";
import { Timer } from "../timer/Timer.js";

/**  
 * @class ListTimerDisplay
 * @classdesc Takes output from a Timer and prints it to HTML based on settings. Lists times that the entries will take place.
 * 
 * The following settings are required in an element with the class "settings":
 * 
 *  - timer: The ID of the timer to receive updates from
 * 
 * Optionally in settings, a list timer display may have the following:
 * 
 *  - depth: A number for how many entries to show. The first entry given is the currently active entry in the timer. Default: 1
 *  - timeFormat: How to format any time displayed by this timer display. The number of letters is the minimum digit count (padded with 0s). Ends with a S for server time, E for Erinn time, L for local time. See {@link TimerDisplay.formatTime} Default: h:mm:ssS
 *  - 12hour: true or false. If true, time is displayed in 12 hour format with a space and AM/PM at the end. Default: false
 *  - entryFormat: How to format each entry of the display. %v for entry's value and %t for entry's time. For example: {The next event is %v at %t.} Default: {%t %v}
 *  - entryStyle: Adds the given style to each outer div containing the entry's value, time, and additional text from entryFormat.
 *  - valueStyle: Adds the given style to each div containing the entry's value.
 *  - timeStyle: Adds the given style to each div containing the entry's time.
 *  - entryClass: Adds the given CSS class name to each outer div containing the entry's value, time, and additional text from entryFormat.
 *  - valueClass: Adds the given CSS class name to each div containing the entry's value.
 *  - timeClass: Adds the given CSS class name to each div containing the entry's time.
 *  - startAtEntry: Displays entries starting at this entry number. Useful when stringing multiple displays together for more control over styling. Default: 1
 *  - endAtEntry: Displays entries ending at this entry number. Useful when stringing multiple displays together for more control over styling. Default: Equal to the depth
 */
export class ListTimerDisplay extends TimerDisplay{
    /**
     * Constructor for {@link ListTimerDisplay}
     * @param args - The args object created from the element with the "settings" class
     */
    constructor(element, args){
        super();

        // Validate and convert the given parameters into the values used by this class.
        let validatedParameters = ListTimerDisplay.#validateParameters(args);
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
         * The format to use for the displayed time. Example: "h:mm:ssS"
         * @type {String}
         */
        this.timeFormat = validatedParameters.timeFormat;

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

        this.initializeElements();
        this.timer.attachDisplay(this);
    }

    /**
     * Handles udpated data from a Timer. Note a data update does not mean the data actually changed since the last update.
     * @param {Number[][]} newTimerData - 2D array with the entry index from the timer's list and its start time as unix epoch. First entry in this array is the currently active entry.
     */
    updateData(newTimerData){
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
        if(newTimerData.length < this.depth) return timerDisplayError('List type timer display failed an update due to invalid timerData length.'); 
        // Check if this timer needs to redraw its contents unless forceRedraw is true or the display has no timer data stored
        if(!forceRedraw && this.timerData.length > 0){
            // Check if the currently selected entry has not changed
            if(newTimerData[0][0] === this.timerData[0][0] && newTimerData[0][1] === this.timerData[0][1]){
                // Currently selected entry has not changed. For a list display, there is no need to update HTML or update this.timerData
                return;
            }
        }
        // There is a new active entry or forceRedraw was true.
        // Store the updated data
        this.timerData = newTimerData.slice();

        // Redraw the display on the next animation frame if a redraw isn't already queued
        if(this.redrawID === null){
            this.redrawID = requestAnimationFrame(() => this.redraw());
        }
    }

    /**
     * Redraws the HTML contents of this display.
     * This will recalculate what each entry time and value should be displaying, so it should only be done if a time or value has changed.
     * {@link ListTimerDisplay.updateData|this.updateData} would determine that and call redraw automatically if necessary.
     * 
     * Note: The display should be initialized with {@link ListTimerDisplay.initializeElements|initializeElements} before redrawing. redraw assumes the display's elements already exist.
     */
    redraw(){
        // Loop through all entries
        for(let i = 0; i < this.depth; i++){
            // Update time
            if(this.dataElements[i*2]){
                this.dataElements[i*2].text(TimerDisplay.formatTimeClock(this.timerData[i][1], this.timeFormat, this.is12hour));
            }
            // Update entry value
            if(this.dataElements[i*2 + 1]){
                this.dataElements[i*2 + 1].text(this.timer.list[this.timerData[i][0]]);
            }
        }
        // allow queueing a new redraw
        this.redrawID = null;
    }

    /**
     * Clears the display's element and recreates its contents.
     * 
     * Note: Entries will have no text content until the next {@link ListTimerDisplay.redraw|redraw}. Use  {@link ListTimerDisplay.updateDisplay|updateDisplay(this.timerData, true)} to force a redraw.
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
                accumulator[key.trim()] = value.trim();
            }
            return accumulator;
        }, {});

        // Value style
        let valueStyleObj = this.valueStyle.split(';').reduce((accumulator, style) => {
            let [key, value] = style.split(':');
            if (key && value) {
                // A whitelist could be applied here to control which CSS styles are permitted
                accumulator[key.trim()] = value.trim();
            }
            return accumulator;
        }, {});

        // Time style
        let timeStyleObj = this.timeStyle.split(';').reduce((accumulator, style) => {
            let [key, value] = style.split(':');
            if (key && value) {
                // A whitelist could be applied here to control which CSS styles are permitted
                accumulator[key.trim()] = value.trim();
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
        // Validate timer
        if(!('timer' in args)) return timerDisplayError('List type timer displays need to have "timer" setting set to a timer element\'s id.');
        if(args.timer.length > 1) return timerDisplayError('Timer displays can not have multiple timers attached.');
        if($(`#${args.timer[0]}`).length < 0) return timerDisplayError(`List type timer displays need to have "timer" setting set to a valid timer element\'s id. Could not find element with id "${args.timer}".`);
        if( !( $($(`#${args.timer[0]}`)[0]).data('timer') instanceof Timer ) ) return timerDisplayError(`Failed to attach to timer due to the provided timer not being an instance of Timer or its subclasses.`);

        // 1 Timer provided and it is valid. Store it to attach later.
        let timerId = args.timer[0];
        let timer = $($(`#${args.timer[0]}`)[0]).data('timer');

        // Validate depth. 1 minimum.
        let depth = 1;
        if('depth' in args){
            if(args.depth.length > 1) return timerDisplayError('Timer displays can not have more than 1 depth.');
            if(!Number.isInteger(Number(args.depth[0]))) return timerDisplayError('depth must be a whole number.');
            depth = Math.max(Number(args.depth[0]), depth);
        }

        // Validate time format
        // Default time format
        let timeFormat = 'h:mm:ssS';
        if('timeFormat' in args){
            if(args.timeFormat.length > 1) return timerDisplayError('Timer displays can not have more than 1 timeFormat.');

            timeFormat = args.timeFormat[0];
            // Valid patterns
            let validFormatReal = /^(hh|h)(:mm(:ss(\.sss)?)?)?$/;
            let validFormatErinn = /^(hh|h)(:mm(:ss)?)?$/;
            // Get last letter in time format
            let formatType = timeFormat[timeFormat.length - 1].toUpperCase();

            // Validate pattern
            if(formatType === 'S' || formatType === 'L'){
                if (!validFormatReal.test(timeFormat.slice(0,-1))) return timerDisplayError(`timeFormat "${timeFormat}" is an invalid format pattern.`);
            }else if(formatType === 'E'){
                if (!validFormatErinn.test(timeFormat.slice(0,-1))) return timerDisplayError(`timeFormat "${timeFormat}" is an invalid format pattern.`);
            }else{
                return timerDisplayError('timeFormat must end in S (Server time), L (local time), or E (Erinn time).');
            }

            // timeFormat is valid
            timeFormat = args.timeFormat[0];
        }

        // Validate 12hour
        let is12hour = false;
        if('12hour' in args){
            if(args['12hour'].length > 1) return timerDisplayError('12hour can not have more than 1 value.');
            if(args['12hour'][0].toLowerCase() === 'false') is12hour = false;
            else if(args['12hour'][0].toLowerCase() === 'true') is12hour = true;
            else return timerDisplayError('12hour must be true or false.');
        }

        // Validate entryFormat
        let entryFormat = '%t %v';
        if('entryFormat' in args){
            if(args.entryFormat.length > 1) return timerDisplayError('entryFormat can not have more than 1 value.');
            if(args.entryFormat[0].split('%t').length > 2) return timerDisplayError('entryFormat can not have more than 1 instance of "%t".');
            if(args.entryFormat[0].split('%v').length > 2) return timerDisplayError('entryFormat can not have more than 1 instance of "%v".');
            entryFormat = args.entryFormat[0];
        }

        // Validate styles and classes
        let entryStyle = '';
        let valueStyle = '';
        let timeStyle = '';
        let entryClass = '';
        let valueClass = '';
        let timeClass = '';
        if('entryStyle' in args) entryStyle = args.entryStyle.join(';');
        if('valueStyle' in args) valueStyle = args.valueStyle.join(';');
        if('timeStyle' in args) timeStyle = args.timeStyle.join(';');
        if('entryClass' in args) entryClass = args.entryClass.join(' ');
        if('valueClass' in args) valueClass = args.valueClass.join(' ');
        if('timeClass' in args) timeClass = args.timeClass.join(' ');

        // Validate startAtEntry and endAtEntry
        let startAtEntry = 1;
        let endAtEntry = depth;
        if('startAtEntry' in args){
            if(args.startAtEntry.length > 1) return timerDisplayError('startAtEntry can not have more than 1 value.');
            if(!Number.isInteger(Number(args.startAtEntry[0]))) return timerDisplayError('startAtEntry must be a whole number.');
            startAtEntry = Math.max(Number(args.startAtEntry[0]), 1);
        }
        if('endAtEntry' in args){
            if(args.endAtEntry.length > 1) return timerDisplayError('endAtEntry can not have more than 1 value.');
            if(!Number.isInteger(Number(args.endAtEntry[0]))) return timerDisplayError('endAtEntry must be a whole number.');
            endAtEntry = Math.min(Number(args.endAtEntry[0]), depth);
        }
        
        return {timerId, depth, timer, timeFormat, is12hour, entryFormat, entryStyle, valueStyle, timeStyle, entryClass, valueClass, timeClass, startAtEntry, endAtEntry};
    }
}