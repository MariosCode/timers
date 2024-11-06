import { TimerDisplay } from "./TimerDisplay.js";
import { Timer } from "../timer/Timer.js";
import { timerDisplayCreationError, timerDisplayError, camelCase } from "../helper/utils.js";

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
 *  - timeFormat: How to format any time displayed by this timer display. The number of letters is the minimum digit count (padded with 0s). Ends with a S for server time, E for Erinn time, L for local time. See {@link TimerDisplay.formatTimeClock} Default: h:mm:ssS
 *  - 12hour: true or false. If true, time is displayed in 12 hour format. Default: false
 *      >- suffix: Used with 12hour. Expects two values. The first value will be placed after the time during the first 12 hours of the day, the second value after. Example: { am}{ pm}
 *  - entryFormat: How to format each entry of the display. %v for entry's value and %t for entry's time. %l#_ and %l to wrap text in that number link from this list item. For example: {The next %l1_event%l is %l2_%v%l at %t.} Default: {%t %v}
 *  - entryStyle: Adds the given style to each outer span containing the entry's value, time, and additional text from entryFormat.
 *  - valueStyle: Adds the given style to each span containing the entry's value.
 *  - timeStyle: Adds the given style to each span containing the entry's time.
 *  - entryClass: Adds the given CSS class name to each outer span containing the entry's value, time, and additional text from entryFormat.
 *  - valueClass: Adds the given CSS class name to each span containing the entry's value.
 *  - timeClass: Adds the given CSS class name to each span containing the entry's time.
 *  - startAtEntry: Displays entries starting at this entry number. Useful when stringing multiple displays together for more control over styling. Default: 1
 *  - endAtEntry: Displays entries ending at this entry number. Useful when stringing multiple displays together for more control over styling. Default: Equal to the depth
 * 
 *  - filter: A filter to apply to data received by a timer. Valid filters are:
 *      >- query: Filter the data supplied by the timer to entries whose value matches one of these query strings.
 *          Note this will make the timer's depth dynamic. It will continue adding entries to its returned data until it reaches this display's depth number of queried entries.
 * 
 * @param args - The args object created from the element with the "settings" class
 */
export class ListTimerDisplay extends TimerDisplay{
    constructor(element, args){
        super();

        // Validate and convert the args into the values used by this class.
        let validatedParameters = ListTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return undefined;

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
         * The minimum number of entries the Timer must give to {@link ListTimerDisplay.updateData|updateData}.
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
         * Whether or not to display the time in 12 hour format
         * @type {Boolean}
         */
        this.is12hour = validatedParameters.is12hour;

        /**
         * Used with 12hour to place text after the time during the first 12 hours of the day
         * @type {String}
         */
        this.suffixam = validatedParameters.suffixam;

        /**
         * Used with 12hour to place text after the time during the last 12 hours of the day
         * @type {String}
         */
        this.suffixpm = validatedParameters.suffixpm;

        /**
         * The format to use for each displayed entry. Example: "{%t %v}"
         * @type {String}
         */
        this.entryFormat = validatedParameters.entryFormat;

        /**
         * The style for the outer span for an entry
         * @type {String}
         */
        this.entryStyle = validatedParameters.entryStyle;
        /**
         * The style for the span containing the entry's value
         * @type {String}
         */
        this.valueStyle = validatedParameters.valueStyle;
        /**
         * The style for the span containing the entry's time
         * @type {String}
         */
        this.timeStyle = validatedParameters.timeStyle;
        /**
         * The class name for the outer span for an entry
         * @type {String}
         */
        this.entryClass = validatedParameters.entryClass;
        /**
         * The class name for the span containing the entry's value
         * @type {String}
         */
        this.valueClass = validatedParameters.valueClass;
        /**
         * The class name for the span containing the entry's time
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

        // Make sure functions provided as callbacks to requestAnimationFrame don't lose "this" context.
        this.redraw = this.#redraw.bind(this);

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
     * Using updated data from a timer, updates properties and queues a redraw of the display's HTML contents if necessary.
     * @param {Number[]} newTimerData - An array with the entry index from the timer's list and its start time as unix epoch. First 2 numbers in this array are for the currently active entry.
     * @param {Boolean} forceRedraw - Whether or not to force a redraw even if there is no change in data.
     */
    updateDisplay(newTimerData, forceRedraw){
        // Cancel if updating display with this data is impossible
        if(newTimerData.length/2 < this.depth) return timerDisplayError(`List type timer display failed an update due to invalid timerData length. Length expected: ${this.depth*2} timerData:`, newTimerData); 
        // Check if this timer needs to redraw its contents unless forceRedraw is true or the display has no timer data stored
        if(!forceRedraw && this.timerData.length > 0){
            // Check if the currently selected entry has not changed
            if(newTimerData[0] === this.timerData[0] && newTimerData[1] === this.timerData[1]){
                // Currently selected entry has not changed. For a list display, there is no need to update HTML or update this.timerData
                return;
            }
        }
        // There is a new active entry, forceRedraw was true, or the active entry has changed.
        // Store the updated data
        this.timerData = newTimerData.slice();

        // Redraw the display on the next animation frame if a redraw isn't already queued
        if(this.redrawID === null){
            this.redrawID = requestAnimationFrame(this.redraw);
        }
    }

    /**
     * Redraws the HTML contents of this display.
     * This is the most CPU intensive part of displays, so it should only be done if an entry has changed.
     * {@link ListTimerDisplay.updateData|this.updateData} would determine that and call redraw itself if necessary.
     * 
     * Note: The display should be initialized with {@link ListTimerDisplay.initializeElements|initializeElements} before redrawing. redraw assumes the display's elements already exist.
     */
    #redraw(){
        // Loop through all entries within startAtEntry and endAtEntry
        for(let i = this.startAtEntry-1; i < this.endAtEntry; i++){
            // Update entry time
            if(this.dataElements[i*2]){
                this.dataElements[i*2].text(TimerDisplay.formatTimeClock(this.timerData[i*2+1], this.timeFormat, this.is12hour, this.suffixam, this.suffixpm));
            }
            // Update entry value
            if(this.dataElements[i*2 + 1]){
                this.dataElements[i*2 + 1].text(this.timer.list[this.timerData[i*2]]);
            }
            // Update entry links
            if(this.linkElements[i].length > 0){
                for(let k = 0; k < this.linkElements[i].length; k++){
                    if(this.timer.listLinks[this.timerData[i*2]][this.linkElements[i][k].data('linkIndex')] != null){
                        this.linkElements[i][k].prop('href', this.timer.listLinks[this.timerData[i*2]][this.linkElements[i][k].data('linkIndex')]);
                    }else{
                        this.linkElements[i][k].prop('href', '#');
                    }
                }
            }
        }
        // Allow queueing a new redraw
        this.redrawID = null;
    }

    /**
     * Clears the display's element and recreates its contents.
     * 
     * Note: Entries will have no text content until the next {@link ListTimerDisplay.redraw|redraw}.
     * 
     * {@link ListTimerDisplay.updateDisplay|this.updateDisplay(this.timerData, true)} can be used to force a redraw.
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

        // Split entryFormat at the placeholders
        let templateParts = this.entryFormat.split(/(%v|%t|%l\d+_|%l)/);

        // Loop through every entry
        for (let i = 0; i < this.depth; i++) {
            // The wrapper for the entry, with entryClass and entryStyle applied
            let $entry = $('<span></span>').addClass(this.entryClass).css(entryStyleObj);

            // Apply startAtEntry and endAtEntry
            if( i + 1 < this.startAtEntry || i + 1 > this.endAtEntry ) $entry.css({display:'none'});
        
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
                    $timePart = $('<span></span>').addClass(this.timeClass).css(timeStyleObj);
                    $currentLink != null ? $currentLink.append($timePart) : $entry.append($timePart);
                // Entry value
                } else if (part === '%v') {
                    $valuePart = $('<span></span>').addClass(this.valueClass).css(valueStyleObj);
                    $currentLink != null ? $currentLink.append($valuePart) : $entry.append($valuePart);
                // Treat other parts as plain text
                } else {
                    $currentLink != null ? $currentLink.append(document.createTextNode(part)) : $entry.append(document.createTextNode(part));
                }
            });
        
            // Add the entry's time and value spans to this.dataElements so they can be updated
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
        let returnObject = TimerDisplay.argValidationAndConversion(args , "list");
        if(!returnObject) return null;
        
        return returnObject;
    }
}