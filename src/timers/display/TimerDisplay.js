import { SERVER_TIMEZONE, ERINN_TIME_OFFSET, TIME_PER_ERINN_MINUTE, TIME_PER_ERINN_HOUR, TIME_PER_ERINN_DAY, timerDisplayError, timerDisplayCreationError } from '../helper/utils.js';
import { Timer } from '../timer/Timer.js'

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
     * @param {Number} millisecondsParam - Milliseconds since unix epoch
     * @param {String} format - Format to turn the milliseconds into
     * @param {Boolean} is12hour - Format the milliseconds in 12 hour format with AM/PM afterwards
     * @returns {String} - Returns the formatted time as a string
     */
    static formatTimeClock(millisecondsParam, format, is12hour){
        // Validate parameters
        if(!Number.isInteger(millisecondsParam)) return timerDisplayError(`formatTimeClock is Unable to format milliseconds "${millisecondsParam}". Milliseconds must be a whole number.`);
        if(typeof format !== "string") return timerDisplayError(`formatTimeClock is unable to use format "${format}". Format must be a string.`);
        if(format.length < 2) return timerDisplayError(`formatTimeClock is unable to use format "${format}". String length is too short.`);

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
        }else if(formatType === 'L'){
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
            return timerDisplayError(`formatTimeClock is unable to use format "${format}". The last character of the string should be S (Server time), L (local time), or E (Erinn time).`);
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
     * @param {Number} millisecondsParam - Milliseconds duration
     * @param {String} format - Format to turn the milliseconds into
     * @param {Boolean} verbose - Format using english words
     * @param {Boolean} hideLeading0 - Hide the 0 values at the beginning of the string
     * @param {Boolean} hideAll0 - Hide all 0 values throughout the string
     * @returns {String} - Returns the formatted time as a string
     */
    static formatTimeDuration(millisecondsParam, format, verbose = false, hideLeading0 = false, hideAll0 = false){
        // Validate parameters
        if(!Number.isInteger(millisecondsParam)) return timerDisplayError(`formatTimeDuration is Unable to format milliseconds "${millisecondsParam}". Milliseconds must be a whole number.`);
        if(typeof format !== "string") return timerDisplayError(`formatTimeDuration is unable to use format "${format}". Format must be a string.`);
        if(format.length < 2) return timerDisplayError(`formatTimeDuration is unable to use format "${format}". String length is too short.`);

        // Prepare format
        let validFormatReal = /^(?:([d]+)(?::|$|\.([s]+)$))?(?:([h]+)(?::|$|\.([s]+)$))?(?:([m]+)(?::|$|\.([s]+)$))?([s]+)?(?:\.([s]+)$)?$/i;
        let validFormatErinn = /^(?:([d]+)(?::|$))?(?:([h]+)(?::|$))?(?:([m]+)(?::|$))?([s]+$)?$/i;
        let formatType = format[format.length - 1].toUpperCase();
        format = format.slice(0,-1);

        // Prepare variables for units of time. Use -1 for units of time not being used.
        let days = -1;
        let hours = -1;
        let minutes = -1;
        let seconds = -1;
        let milliseconds = -1;

        // Prepare variables for keeping track of the parts of the format.
        let daysPart = false;
        let hoursPart = false;
        let minutesPart = false;
        let secondsPart = false;
        let millisecondsPart = false;

        // Helper function for padding numbers
        function pad(number, length) {
            return number.toString().padStart(length, '0');
        }

        // Get units of time for a real time
        if(formatType === 'S' || formatType === 'L'){
            if (!validFormatReal.test(format)) return timerDisplayError(`formatTimeDuration is unable to use format "${format}". Invalid format pattern.`);
            // Extract parts from the format. Use false if the format does not use that unit of time.
            let match = format.match(validFormatReal);
            daysPart = match[1] || false;
            hoursPart = match[3] || false;
            minutesPart = match[5] || false;
            secondsPart = match[7] || false;
            millisecondsPart = match[8] || match[6] || match[4] || match[2] || false;

            // Put miliseconds from the parameter into the units of time created previously.
            if(daysPart){
                days = pad(Math.floor(millisecondsParam/86400000), daysPart.length);
                millisecondsParam = millisecondsParam%86400000;
            }
            if(hoursPart){
                hours = pad(Math.floor(millisecondsParam/3600000), hoursPart.length);
                millisecondsParam = millisecondsParam%3600000;
            }
            if(minutesPart){
                minutes = pad(Math.floor(millisecondsParam/60000), minutesPart.length);
                millisecondsParam = millisecondsParam%60000;
            }
            if(secondsPart){
                seconds = pad(Math.floor(millisecondsParam/1000), secondsPart.length);
                millisecondsParam = millisecondsParam%1000;
            }
            if(millisecondsPart){
                milliseconds = pad(Math.floor(millisecondsParam), millisecondsPart.length);
            }

        // Get units of time for Erinn time
        }else if(formatType === 'E'){
            if (!validFormatErinn.test(format)) return timerDisplayError(`formatTimeDuration is unable to use format "${format}". Invalid format pattern.`);
            // Extract parts from the format. Use false if the format does not use that unit of time.
            let match = format.match(validFormatErinn);
            daysPart = match[1] || false;
            hoursPart = match[2] || false;
            minutesPart = match[3] || false;
            secondsPart = match[4] || false;

            // Put miliseconds from the parameter into the units of time created previously.
            if(daysPart){
                days = pad(Math.floor(millisecondsParam/TIME_PER_ERINN_DAY), daysPart.length);
                millisecondsParam = millisecondsParam%TIME_PER_ERINN_DAY;
            }
            if(hoursPart){
                hours = pad(Math.floor(millisecondsParam/TIME_PER_ERINN_HOUR), hoursPart.length);
                millisecondsParam = millisecondsParam%TIME_PER_ERINN_HOUR;
            }
            if(minutesPart){
                minutes = pad(Math.floor(millisecondsParam/TIME_PER_ERINN_MINUTE), minutesPart.length);
                millisecondsParam = millisecondsParam%TIME_PER_ERINN_MINUTE;
            }
            if(secondsPart){
                seconds = pad(Math.floor(millisecondsParam/Math.floor(TIME_PER_ERINN_MINUTE/60)), secondsPart.length);
            }
        }else{
            return timerDisplayError(`formatTimeClock is unable to use format "${format}". The last character of the string should be S (Server time), L (local time), or E (Erinn time).`);
        }

        // Units of time are formatted. Now apply hideLeading0
        if(hideLeading0){
            if(days === -1 || Number(days) === 0){
                days = -1;
                if(hours === -1 || Number(hours) === 0){
                    hours = -1;
                    if(minutes === -1 || Number(minutes) === 0){
                        minutes = -1;
                        if(seconds === -1 || Number(seconds) === 0){
                            seconds = -1;
                            if(milliseconds === -1 || Number(milliseconds) === 0){
                                milliseconds = -1;
                            }
                        }
                    }
                }
            }
        }

        // Apply hideAll0
        if(hideAll0){
            if(milliseconds === 0) milliseconds = -1;
            if(seconds === 0) seconds = -1;
            if(minutes === 0) minutes = -1;
            if(hours === 0) hours = -1;
            if(days === 0) days = -1;
            
        }

        // If everything has become -1, set the lowest tracked unit of time to 0
        if(days === -1 && hours === -1 && minutes === -1 && seconds === -1 && milliseconds === -1){
            (millisecondsPart ? milliseconds = pad(0,millisecondsPart.length) : (secondsPart ? seconds = pad(0,secondsPart.length) : (minutesPart ? minutes = pad(0,minutesPart.length) : (hoursPart ? hours = pad(0,hoursPart.length) : days = pad(0,daysPart.length)))));
        }

        // Format each unit of time
        // Final formatted days
        if(days !== -1){
            if(hours !== -1 || minutes !== -1 || seconds !== -1){
                days = `${days}${(verbose ? ' Days, ' : ':')}`;
            }else if(milliseconds !== -1){
                days = `${days}${(verbose ? ' Days, ' : '.')}`;
            }
        }else{
            days = '';
        }
        // Final formatted hours
        if(hours !== -1){
            if(minutes !== -1 || seconds !== -1){
                hours = `${hours}${(verbose ? ' Hours, ' : ':')}`;
            }else if(milliseconds !== -1){
                hours = `${hours}${(verbose ? ' Hours, ' : '.')}`;
            }
        }else{
            hours = '';
        }
        // Final formatted minutes
        if(minutes !== -1){
            if(seconds !== -1){
                minutes = `${minutes}${(verbose ? ' Minutes, ' : ':')}`;
            }else if(milliseconds !== -1){
                minutes = `${minutes}${(verbose ? ' Minutes, ' : '.')}`;
            }
        }else{
            minutes = '';
        }
        // Final formatted seconds
        if(seconds !== -1){
            if(milliseconds !== -1){
                seconds = `${seconds}${(verbose ? ' Seconds, ' : '.')}`;
            }
        }else{
            seconds = '';
        }
        // Final formatted milliseconds
        if(milliseconds !== -1){
            milliseconds = `${milliseconds}${(verbose ? ' Milliseconds' : '')}`;
        }else{
            milliseconds = '';
        }

        return `${days}${hours}${minutes}${seconds}${milliseconds}`;
    }

    static argValidationAndConversion(args, displayType){
        // Make displayType not case sensitive by making it all lower case
        displayType = displayType.toLowerCase();

        // Validate timer id
        if(!('timer' in args)) return timerDisplayCreationError('"timer" setting is not set to a timer element\'s id.');
        if(args.timer.length > 1) return timerDisplayCreationError('"timer" setting should only have 1 value.');
        if($(`#${args.timer}`).length < 0) return timerDisplayCreationError(`"timer" setting must be set to a valid timer element\'s id. Could not find element with id "${args.timer}".`);
        if( !( $($(`#${args.timer}`)[0]).data('timer') instanceof Timer ) ) return timerDisplayCreationError(`Failed to attach to a timer due to the provided "timer" element id not being an element with an instance of Timer or its subclasses.`);

        // 1 Timer provided and it is valid. Store it to attach later.
        let timerId = args.timer;
        let timer = $($(`#${args.timer}`)[0]).data('timer');

        // Validate depth. 1 is default and minimum across all displays.
        let depth = 1;
        if('depth' in args){
            if(args.depth.length > 1) return timerDisplayCreationError('Timer displays can not have more than 1 depth.');
            if(!Number.isInteger(Number(args.depth[0]))) return timerDisplayCreationError('depth must be a whole number.');
            depth = Math.max(Number(args.depth[0]), depth);
        }

        // Console type displays do not need any more args.
        if(displayType === "console"){
            return {timerId, depth, timer};
        }

        // All other displays need more.
        // Validate time format
        // Default time format
        let timeFormat = 'h:mm:ssS';
        if(displayType === 'list') timeFormat = 'h:mm:ssS'; // Change this to change default for list displays
        if(displayType === 'countdown') timeFormat = 'h:mm:ssS'; // Change this to change default for countdown displays
        if('timeFormat' in args){
            if(args.timeFormat.length > 1) return timerDisplayCreationError('Timer displays can not have more than 1 timeFormat.');

            timeFormat = args.timeFormat[0];
            // Valid patterns
            let validFormatReal = /^(hh|h)(:mm(:ss(\.sss)?)?)?$/;
            let validFormatErinn = /^(hh|h)(:mm(:ss)?)?$/;
            // For countdown displays and any other display using a duration of time, use different patterns
            if(displayType === 'countdown'){
                validFormatReal = /^(?:([d]+)(?::|$|\.([s]+)$))?(?:([h]+)(?::|$|\.([s]+)$))?(?:([m]+)(?::|$|\.([s]+)$))?([s]+)?(?:\.([s]+)$)?$/;
                validFormatErinn = /^(?:([d]+)(?::|$))?(?:([h]+)(?::|$))?(?:([m]+)(?::|$))?([s]+$)?$/;
            }
            // Get last letter in time format
            let formatType = timeFormat[timeFormat.length - 1].toUpperCase();

            // Validate pattern
            if(formatType === 'S' || formatType === 'L'){
                if (!validFormatReal.test(timeFormat.slice(0,-1))) return timerDisplayCreationError(`timeFormat "${timeFormat}" is an invalid format pattern.`);
            }else if(formatType === 'E'){
                if (!validFormatErinn.test(timeFormat.slice(0,-1))) return timerDisplayCreationError(`timeFormat "${timeFormat}" is an invalid format pattern.`);
            }else{
                return timerDisplayCreationError('timeFormat must end in S (Server time), L (local time), or E (Erinn time).');
            }

            // timeFormat is valid
            timeFormat = args.timeFormat[0];
        }

        // Validate entryFormat
        let entryFormat = '%t %v';
        if('entryFormat' in args){
            if(args.entryFormat.length > 1) return timerDisplayCreationError('entryFormat can not have more than 1 value.');
            if(args.entryFormat[0].split('%t').length > 2) return timerDisplayCreationError('entryFormat can not have more than 1 instance of "%t".');
            if(args.entryFormat[0].split('%v').length > 2) return timerDisplayCreationError('entryFormat can not have more than 1 instance of "%v".');
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
            if(args.startAtEntry.length > 1) return timerDisplayCreationError('startAtEntry can not have more than 1 value.');
            if(!Number.isInteger(Number(args.startAtEntry[0]))) return timerDisplayCreationError('startAtEntry must be a whole number.');
            // Must be at least 1, at most depth
            startAtEntry =  Math.min( Math.max(Number(args.startAtEntry[0]), 1) , depth );
        }
        if('endAtEntry' in args){
            if(args.endAtEntry.length > 1) return timerDisplayCreationError('endAtEntry can not have more than 1 value.');
            if(!Number.isInteger(Number(args.endAtEntry[0]))) return timerDisplayCreationError('endAtEntry must be a whole number.');
            // Must be at least startAtEntry, at most depth
            endAtEntry = Math.min( Math.max(Number(args.endAtEntry[0]), startAtEntry) , depth );
        }

        return {timerId, depth, timer, timeFormat, entryFormat, entryStyle, valueStyle, timeStyle, entryClass, valueClass, timeClass, startAtEntry, endAtEntry};
    }
}