import { RotateTimer } from './timer/RotateTimer.js'
import { ConsoleTimerDisplay } from './display/ConsoleTimerDisplay.js';
import { TimerDisplay } from './display/TimerDisplay.js';
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
    
        //$this.data('timer', new timer_type[args.type[0]](display, args, list));
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
    else return timerDisplayError(`Timer display type "${args.type}" is an unknown display type.`);
}

initializeTimers();