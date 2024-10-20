import { TimerDisplay } from "./TimerDisplay.js";

/**  
 * @class TimerDisplay
 * @classdesc Takes output from a RotationTimer and prints it to the JavaScript console.
 * 
 * This class should be instantiated using {@link ConsoleTimerDisplay.createInstance}.
 */
export class ConsoleTimerDisplay extends TimerDisplay{
    // Prevent the use of the constructor so this class can only be created with ConsoleTimerDisplay.createInstance
    static _allowConstructor = false;

    constructor(){
        if(!ConsoleTimerDisplay._allowConstructor) return timerError(`ConsoleTimerDisplay must be instantiated with ConsoleTimerDisplay.createInstance() instead of new ConsoleTimerDisplay()`);
        ConsoleTimerDisplay._allowConstructor = false;
    }

    static createInstance(){
        ConsoleTimerDisplay._allowConstructor = true;
        return new ConsoleTimerDisplay();
    }
}