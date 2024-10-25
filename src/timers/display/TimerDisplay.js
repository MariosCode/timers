import { SERVER_TIMEZONE, ERINN_TIME_OFFSET, TIME_PER_ERINN_MINUTE, TIME_PER_ERINN_HOUR, TIME_PER_ERINN_DAY } from '../helper/utils.js';

/**  
 * @class TimerDisplay
 * @classdesc The superclass for all TimerDisplay subclasses.
 */
export class TimerDisplay{
    constructor(){
        
    }

    /**
     * Takes a time in milliseconds since unix epoch. Validates the format and returns the time of day as a string, or null if invalid.
     * 
     * Valid formats:
     * 
     * - h:mm:ss.sssS or h:mm:ss.sssL or h:mm:ssE 
     * - h for hour, m for minute, s for second, .s for milliseconds. If 2 h are used instead of 1, the hour will always be 2 digits (padded with a 0).
     * - minutes, seconds, and milliseconds are optional.
     * - S for time in server's timezone, L for local time, E for Erinn time
     * 
     * If is12hour is true, the returned time will be in 12 hour format with AM/PM afterwards.
     * 
     * @param {Number} milliseconds - Milliseconds since unix epoch
     * @param {String} format - Format to turn the milliseconds into
     * @param {Boolean} is12hour - Format the milliseconds in 12 hour format with AM/PM afterwards
     * @returns {String} - Returns the formatted time as a string
     */
    static formatTimeClock(millisecondsParam, format, is12hour){
        // Validate parameters
        if(!Number.isInteger(millisecondsParam)) return timerDisplayError(`formatTimeClock is Unable to format milliseconds "${millisecondsParam}". Milliseconds must be a whole number.`);
        if(typeof format !== "string") return timerDisplayError(`formatTimeClock is unable to use format "${format}". Format must be a string.`);
        if(format.length < 1) return timerDisplayError(`formatTimeClock is unable to use format "${format}". String length is too short.`);

        // Prepare format
        let validFormatReal = /^(hh|h)(:mm(:ss(\.sss)?)?)?$/;
        let validFormatErinn = /^(hh|h)(:mm(:ss)?)?$/;
        let formatType = format[format.length - 1].toUpperCase();
        format = format.slice(0,-1);

        // Prepare variables for units of time
        let hours = 0; 
        let minutes = 0; 
        let seconds = 0; 
        let milliseconds = 0; 

        // Get units of time for a server time
        if(formatType === 'S'){
            if (!validFormatReal.test(format)) return timerDisplayError(`formatTimeClock is unable to use format "${format}". Invalid format pattern.`);
            let date = new Date(millisecondsParam);
            // Create the formatter in the server's timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: SERVER_TIMEZONE,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
                hour12: false
            });

            // Get the components of the date
            const parts = formatter.formatToParts(date);

            // Extract the components we need
            hours = parseInt(parts.find(p => p.type === 'hour').value);
            minutes = parseInt(parts.find(p => p.type === 'minute').value);
            seconds = parseInt(parts.find(p => p.type === 'second').value);
            milliseconds = parseInt(parts.find(p => p.type === 'fractionalSecond').value);

        // Get units of time for a local time
        }else if(formatType === 'Z'){
            if (!validFormatReal.test(format)) return timerDisplayError(`formatTimeClock is unable to use format "${format}". Invalid format pattern.`);
            let date = new Date(millisecondsParam);
            // Extract units of time from the Date
            hours = date.getHours();
            minutes = date.getMinutes();
            seconds = date.getSeconds();
            milliseconds = date.getMilliseconds();

        // Get units of time for Erinn time
        }else if(formatType === 'E'){
            if (!validFormatErinn.test(format)) return timerDisplayError(`formatTimeClock is unable to use format "${format}". Invalid format pattern.`);
            millisecondsParam += ERINN_TIME_OFFSET;
            // Get time in current day
            millisecondsParam = millisecondsParam % TIME_PER_ERINN_DAY;
            // Extract units of time from the milliseconds
            hours = millisecondsParam % TIME_PER_ERINN_HOUR;
            minutes = millisecondsParam % TIME_PER_ERINN_MINUTE;
            seconds = millisecondsParam % Math.floor(TIME_PER_ERINN_MINUTE/60); // Math.floor for future proofing, code should handle a change in TIME_PER_ERINN_MINUTE without issue
        }else{
            return timerDisplayError(`formatTimeClock is unable to use format "${format}". The last charatcer of the string should be S (Server time), Z (local time), or E (Erinn time).`);
        }

        // Change to 12 hour time
        let period = '';
        if (is12hour) {
            period = hours >= 12 ? ' PM' : ' AM';
            hours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
        }

        // Helper function for padding numbers to 2 or 3 digits
        function pad(number, length = 2) {
            return number.toString().padStart(length, '0');
        }

        // Format each unit of time
        hours = (format.includes('hh') ? `${pad(hours)}` : `${hours}`);
        if(format.includes('mm')){
            if(format.includes(':ss')){
                if(format.includes('.sss')){
                    minutes = `:${pad(minutes)}:`;
                    seconds = `${pad(seconds)}.`;
                    milliseconds = `${pad(milliseconds, 3)}`;
                }else{
                    minutes = `:${pad(minutes)}:`;
                    seconds = `${pad(seconds)}`;
                    milliseconds = ``;
                }
            }else{
                minutes = `:${pad(minutes)}`;
                seconds = ``;
                milliseconds = ``;
            }
        }else{
            minutes = ``;
            seconds = ``;
            milliseconds = ``;
        }

        return `${hours}${minutes}${seconds}${milliseconds}${period}`;
    }

    /**
     * Takes milliseconds duration. Validates the format and returns the duration of time as a string, or null if invalid.
     * 
     * verbose will use english words. Example: d:h:m:sS with hideAll0 and verbose could be "12 days, 5 hours, 59 seconds".
     * 
     * hideLeading0 will hide the 0 values at the beginning of the string. For example "0:0:40:0" would instead be "40:0".
     * 
     * hideAll0 will hide all 0 values throughout the string. For example "0 days, 40 hours, 0 minutes, 10 seconds" would instead be "40 hours, 10 seconds".
     * 
     * Valid formats:
     * 
     * - d:h:m:s.sS or d:h:m:s.sL or d:h:m:sE
     * - All letters are optional.
     * - Multiple letters can be used to set a minimum number of digits (padded with 0s)
     * - S and L are identical here and return realtime. E returns Erinn time.
     * 
     * @param {Number} milliseconds - Milliseconds duration
     * @param {String} format - Format to turn the milliseconds into
     * @param {Boolean} verbose - Format using english words
     * @param {Boolean} hideLeading0 - Hide the 0 values at the beginning of the string
     * @param {Boolean} hideAll0 - Hide all 0 values throughout the string
     * @returns {String} - Returns the formatted time as a string
     */
    static formatTimeDuration(milliseconds, format, verbose = false, hideLeading0 = false, hideAll0 = false){
        // Validate parameters
        if(!Number.isInteger(milliseconds)) timerDisplayError(`formatTimeDuration is Unable to format milliseconds "${milliseconds}". Milliseconds must be a whole number.`);

    }
}