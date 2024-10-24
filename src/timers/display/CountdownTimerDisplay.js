import { TimerDisplay } from "./TimerDisplay.js";
import { Timer } from "../timer/Timer.js";

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
 *  - timeFormat: How to format the duration of time displayed. The number of letters is the minimum digit count (padded with 0s). See {@link TimerDisplay.formatTime} Default: h:mm:ssS
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
 */
export class CountdownTimerDisplay extends TimerDisplay{
    /**
     * Constructor for {@link CountdownTimerDisplay}
     * @param args - The args object created from the element with the "settings" class
     */
    constructor(args){
        super();

        // Validate and convert the given parameters into the values used by this class.
        let validatedParameters = CountdownTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return null;

        /**
         * The ID of the Timer to attach this display to
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
            // Check if the currently selected entry and the depth has not changed
            if(newTimerData[0][0] === this.timerData[0][0] && newTimerData[0][1] === this.timerData[0][1]){
                // Currently selected entry has not changed. Check if times need to be updated.
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
        if(!('timer' in args)) return timerDisplayError('Countdown type timer displays need to have "timer" setting set to a timer element\'s id.');
        if(args.timer.length > 1) return timerDisplayError('Timer displays can not have multiple timers attached.');
        if($(`#${args.timer}`).length < 0) return timerDisplayError(`Countdown type timer displays need to have "timer" setting set to a valid timer element\'s id. Could not find element with id "${args.timer}".`);
        if( !( $($(`#${args.timer}`)[0]).data('timer') instanceof Timer ) ) return timerDisplayError(`Failed to attach to timer due to the provided timer not being an instance of Timer or its subclasses.`);

        // 1 Timer provided and it is valid. Store it to attach later.
        let timerId = args.timer;
        let timer = $($(`#${args.timer}`)[0]).data('timer');

        // Validate depth. 1 minimum.
        let depth = Number(args.depth) ? Math.max(Number(args.depth), 1) : 1;

        return {timerId, depth, timer};
    }
}