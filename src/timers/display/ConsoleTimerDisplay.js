import { TimerDisplay } from './TimerDisplay.js';
import { Timer } from '../timer/Timer.js';

/**  
 * @class ConsoleTimerDisplay
 * @classdesc Takes output from a Timer and prints it to the JavaScript console.
 * 
 * The following settings are required in an element with the class "settings":
 * 
 * - timer: The ID of an element with the make-timer class
 * 
 * Optionally in settings, a console timer display may have the following:
 * 
 * - depth: A number for how many entries the timer should give to this display. The first entry given is the currently active entry in the timer. Default: 2
 */
export class ConsoleTimerDisplay extends TimerDisplay{
    /**
     * Constructor for {@link ConsoleTimerDisplay}
     * @param args - The args object created from the element with the "settings" class
     */
    constructor(args){
        super();

        // Validate and convert the given parameters into the properties used by this class.
        let validatedParameters = ConsoleTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return null;

        /**
         * The ID on the HTML element containing the Timer to attach this display to
         * @type {String}
         */
        this.timerId = validatedParameters.timerId

        /**
         * The minimum number of scheduled entries the Timer must give to {@link ConsoleTimerDisplay.updateData|updateData}
         * @type {Number}
         */
        this.depth = validatedParameters.depth

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
        this.updateDisplay(newTimerData, true);
    }

    /**
     * @param {Number[][]} newTimerData - 2D array with the entry index from the timer's list and its start time as unix epoch. First entry in this array is the currently active entry.
     * @param {Boolean} forceRedraw - Whether or not to force a redraw even if there is no change in data.
     * @returns 
     */
    updateDisplay(newTimerData, forceRedraw){
        // Check if this timer needs to redraw its contents unless forceRedraw is true
        if(!forceRedraw){
            // Check if currently selected entry and the depth has not changed
            if(newTimerData[0][0] === this.timerData[0][0] && newTimerData[0][1] === this.timerData[0][1] && newTimerData.length === this.timerData.length){
                return;
            }
        }
        this.timerData = newTimerData.map(individualEntryData => [individualEntryData[0], individualEntryData[1]]);

        // Send the raw data to the JavaScript console
        console.log(`Timer ID ${this.timerId} update:`,this.timerData);
    }

    static #validateParameters(args){
        if(!('timer' in args)) return timerDisplayError('Console type timer displays need to have "timer" setting set to a timer element\'s id.');
        if(args.timer.length > 1) return timerDisplayError('Timer displays can not have multiple timers attached.');
        if($(`#${args.timer}`).length < 0) return timerDisplayError(`Console type timer displays need to have "timer" setting set to a valid timer element\'s id. Could not find element with id "${args.timer}".`);
        if( !( $($(`#${args.timer}`)[0]).data('timer') instanceof Timer ) ) return timerDisplayError(`Failed to attach to timer due to the provided timer not being an instance of Timer or its subclasses.`);

        // 1 Timer provided and it is valid. Store it to attach later.
        let timerId = args.timer;
        let timer = $($(`#${args.timer}`)[0]).data('timer');

        // Validate depth. 1 minimum.
        let depth = Number(args.depth) ? Math.max(Number(args.depth), 1) : 1;

        return {timerId, depth, timer};
    }
}