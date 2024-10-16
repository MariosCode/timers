import { parseSettings } from "./utils.js";

// Create timers
$(".make-timer").each(function () {
    const $this = $(this);
    const args = parseSettings($this.children(".settings").html());
    let display;

    // Extract list
    const list = [];
    $this.children("ul, ol").children("li").each(function () {
        list.push($(this).html().trim());
    });

    // Empty the list and change the class.
    $this.empty().removeClass("make-timer").addClass("timer");

    //TODO: assign the display
    //display = new display_type[args.display ? args.display[0] : "list"]($this, args);

    // TODO: create timer object
    //$this.data("timer", new timer_type[args.type[0]](display, args, list));

    console.log("args:");
    console.log(args);
    console.log("list:");
    console.log(list);
});