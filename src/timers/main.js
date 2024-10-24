import { RotateTimer } from './timer/RotateTimer.js'
import { ConsoleTimerDisplay } from './display/ConsoleTimerDisplay.js';
import { ListTimerDisplay } from './display/ListTimerDisplay.js';
import { CountdownTimerDisplay } from './display/CountdownTimerDisplay.js';
import { parseSettings,
        timerDisplayError
    } from './helper/utils.js';

function initializeTimers(){
    // Setup all the timers
    $('.make-timer').each(function () {
        const $this = $(this);
        // Extract settings as args
        const args = parseSettings($this.children('.settings').html());
        $this.children('.settings').remove();
    
        // Extract list
        const list = [];
        $this.children('ul, ol').children('li').each(function () {
            list.push($(this).html().trim());
        });
    
        // Change the class
        $this.removeClass('make-timer').addClass('timer');

        // Validate the ID
        if(!('id' in args) || args.id.length > 1 || $(`#${args.id[0]}`).length > 0) return timerError('Timers require a single unique id to be given in the settings.');
        let validPattern = /^[A-Za-z_][A-Za-z0-9_\-\.]*$/;
        if(!validPattern.test(args.id[0])) return timerError('Timers require an id that can be used as a valid HTML element id.');
        // Add the ID
        $this.attr("id", args.id[0]); 

        // Create the timer
        $this.data('timer', timerFactory(args, list));
    });

    // Setup all the displays
    $('.make-timer-display').each(function () {
        const $this = $(this);
        // Extract settings as args
        const args = parseSettings($this.children('.settings').html());
        $this.children('.settings').remove();
    
        // Change the class
        $this.removeClass('make-timer-display').addClass('timer-display');
    
        $this.data('display', displayFactory(args));
    });
}

function timerFactory(args, list){
    if(!('type' in args)){
        // Timer type would be required if more Timer classes were created in the future
    }
    return RotateTimer.createInstance(args, list);
}

function displayFactory(args){
    // Perform argument validations required to perform the correct createInstance
    if(!('type' in args)) return timerDisplayError('Timer displays require a type.');
    if(args.type.length > 1) return timerDisplayError('Timer displays can only have one type.');

    args.type[0] = args.type[0].toLowerCase();

    // Return the correct new TimerDisplay instance based on args.type
    if(args.type[0] === 'console') return new ConsoleTimerDisplay(args);
    else if(args.type[0] === 'list') return new ListTimerDisplay(args);
    else if(args.type[0] === 'countdown') return new CountdownTimerDisplay(args);
    else return timerDisplayError(`Timer display type "${args.type}" is an unknown display type.`);
}

initializeTimers();