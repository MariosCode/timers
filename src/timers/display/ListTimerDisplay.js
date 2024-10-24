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
    constructor(args){
        super();

        // Validate and convert the given parameters into the values used by this class.
        let validatedParameters = ListTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return null;

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
         * The original arguments provided from the settings element
         * @type {Object}
         */
        this.args = args;

        /**
         * Data obtained from the attached timer
         * @type {Number[][]}
         */
        this.timerData = [];

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
     * @param {Number[][]} newTimerData - 2D array with the entry index from the timer's list and its start time as unix epoch. First entry in this array is the currently active entry.
     * @param {Boolean} forceRedraw - Whether or not to force a redraw even if there is no change in data.
     * @returns 
     */
    updateDisplay(newTimerData, forceRedraw){
        // Check if this timer needs to redraw its contents unless forceRedraw is true
        if(!forceRedraw){
            // Check if the currently selected entry has not changed
            if(newTimerData[0][0] === this.timerData[0][0] && newTimerData[0][1] === this.timerData[0][1]){
                // Currently selected entry has not changed. For a list display, there is no need to update HTML or update this.timerData
                return;
            }
        }
        // There is a new active entry or forceRedraw was true.
        // Store the updated data
        this.timerData = newTimerData.slice();

        // Send the raw data to the JavaScript console. TOTO: update the HTML instead
        console.log(`Timer ID ${this.timerId} update:`,this.timerData);
    }

    static #validateParameters(args){
        if(!('timer' in args)) return timerDisplayError('List type timer displays need to have "timer" setting set to a timer element\'s id.');
        if(args.timer.length > 1) return timerDisplayError('Timer displays can not have multiple timers attached.');
        if($(`#${args.timer}`).length < 0) return timerDisplayError(`List type timer displays need to have "timer" setting set to a valid timer element\'s id. Could not find element with id "${args.timer}".`);
        if( !( $($(`#${args.timer}`)[0]).data('timer') instanceof Timer ) ) return timerDisplayError(`Failed to attach to timer due to the provided timer not being an instance of Timer or its subclasses.`);

        // 1 Timer provided and it is valid. Store it to attach later.
        let timerId = args.timer;
        let timer = $($(`#${args.timer}`)[0]).data('timer');

        // Validate depth. 1 minimum.
        let depth = Number(args.depth) ? Math.max(Number(args.depth), 1) : 1;

        return {timerId, depth, timer};
    }
}