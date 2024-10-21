import { TimerDisplay } from "./TimerDisplay.js";
import { Timer } from "../timer/Timer.js";

/**  
 * @class ConsoleTimerDisplay
 * @classdesc Takes output from a Timer and prints it to the JavaScript console.
 * 
 * This class should be instantiated using {@link ConsoleTimerDisplay.createInstance}.
 */
export class ConsoleTimerDisplay extends TimerDisplay{
    // Prevent the use of the constructor so this class can only be created with ConsoleTimerDisplay.createInstance
    static _allowConstructor = false;

    /**
     * Private constructor to prevent direct instantiation.  
     * Use {@link ConsoleTimerDisplay.createInstance} to create an instance.  
     * 
     * @param {Object} obj - Object containing all parameters
     * @param {Object} obj.args - The args object created from the element with the "settings" class
     * @param {Object} obj.timerId - The ID on the HTML element containing the Timer to attach this display to
     * @param {Object} obj.depth - The minimum number of scheduled items the Timer must give to {@link ConsoleTimerDisplay.updateData|updateData}
     * @param {Object} obj.timer - The Timer instance this display is attached to
     * @returns 
     */
    constructor({args, timerId, depth, timer}){
        if(!ConsoleTimerDisplay._allowConstructor) return timerError(`ConsoleTimerDisplay must be instantiated with ConsoleTimerDisplay.createInstance() instead of new ConsoleTimerDisplay()`);
        ConsoleTimerDisplay._allowConstructor = false;
        
        super();

        this.args = args;
        this.timerId = timerId;
        this.depth = depth;
        this.timer = timer;

        timer.attachDisplay(this);
    }

    static createInstance(args){
        // Validate and convert the given parameters into the values used by this class.
        let validatedParameters = this.#validateParameters(args);
        if(!validatedParameters) return null;

        let timerId = validatedParameters.timerId
        let depth = validatedParameters.depth
        let timer = validatedParameters.timer;

        ConsoleTimerDisplay._allowConstructor = true;
        return new ConsoleTimerDisplay({args, timerId, depth, timer});
    }

    updateData(timerData){
        console.log(`Timer ID ${this.timerId} update:`,timerData);
    }

    static #validateParameters(args){
        if(!('timer' in args)) return timerDisplayError('Console type timer displays need to have "timer" setting set to a timer element\'s id.');
        if($(`#${args.timer}`).length < 0) return timerDisplayError(`Console type timer displays need to have "timer" setting set to a valid timer element\'s id. Could not find element with id "${args.timer}".`);
        if( !( $($(`#${args.timer}`)[0]).data('timer') instanceof Timer ) ) return timerDisplayError(`Failed to attach to timer due to the provided timer not being an instance of Timer or its subclasses.`);

        let timerId = args.timer;
        let depth = Number(args.depth) ? Number(args.depth) : 2;
        let timer = $($(`#${args.timer}`)[0]).data('timer');

        return {timerId, depth, timer};
    }
}