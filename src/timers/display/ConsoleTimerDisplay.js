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
 * - depth: A number for how many entries the timer should give to this display. The first entry given is the currently active entry in the timer. Default: 1
 * 
 * @param args - The args object created from the settings
 */
export class ConsoleTimerDisplay extends TimerDisplay{
    constructor(args){
        super();

        // Validate and convert the args into the values used by this class.
        let validatedParameters = ConsoleTimerDisplay.#validateParameters(args);
        if(!validatedParameters) return null;

        /**
         * The ID on the HTML element containing the Timer this display will attach to
         * @type {String}
         */
        this.timerId = validatedParameters.timerId

        /**
         * The minimum number of entries the Timer must give to {@link ConsoleTimerDisplay.updateData|updateData}
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
         * @type {Number[]}
         */
        this.timerData = [];

        this.timer.attachDisplay(this);
    }

    /**
     * Handles udpated data from a Timer. Note a data update does not mean the data actually changed since the last update.
     * @param {Number[]} newTimerData - An array with the entry index from the timer's list and its start time as unix epoch. First 2 numbers in this array are for the currently active entry.
     */
    updateData(newTimerData){
        this.updateDisplay(newTimerData, true);
    }

    /**
     * @param {Number[]} newTimerData - An array with the entry index from the timer's list and its start time as unix epoch. First 2 numbers in this array are for the currently active entry.
     * @param {Boolean} forceRedraw - Whether or not to force a redraw even if there is no change in data.
     */
    updateDisplay(newTimerData, forceRedraw){
        // Check if this timer needs to redraw its contents unless forceRedraw is true
        if(!forceRedraw){
            // Check if currently selected entry and the depth has not changed
            if(newTimerData[0] === this.timerData[0] && newTimerData[1] === this.timerData[1] && newTimerData.length === this.timerData.length){
                return;
            }
        }
        this.timerData = newTimerData.slice();

        // Send the raw data to the JavaScript console
        console.log(`Timer ID ${this.timerId} update:`,this.timerData);
    }

    /**
     * Take the settings and turns it into the correct values used by this class, or returns null if a setting is invalid
     * @param {Object} args - The original settings provided
     */
    static #validateParameters(args){
        // Validate all args common to most displays
        let returnObject = TimerDisplay.argValidationAndConversion(args , "console");
        if(!returnObject) return null;
        
        return returnObject;
    }
}