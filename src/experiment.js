/**
 * @title object tracking
 * @description Track moving targets
 * @version 0.1.1
 *
 * @assets assets/
 */

// You can import stylesheets (.scss or .css).
import "../styles/main.scss";
// Plugins
import PreloadPlugin from "@jspsych/plugin-preload";
import FullscreenPlugin from "@jspsych/plugin-fullscreen";
import SurveyTextPlugin from "@jspsych/plugin-survey-text";
import SurveyMultiChoicePlugin from "@jspsych/plugin-survey-multi-choice";
import ExternalHtmlPlugin from "@jspsych/plugin-external-html";
// import VirtualChinrestPlugin from '@jspsych/plugin-virtual-chinrest';
import InstructionsPlugin from "@jspsych/plugin-instructions";
import HTMLButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import HTMLSliderResponsePlugin from "@jspsych/plugin-html-slider-response";
import MOTPlugin from "./plugins/mot.ts";
import { initJsPsych } from "jspsych";
// Prolific variables
const PROLIFIC_URL = 'https://app.prolific.com/submissions/complete?cc=CVJWVV8A';
// Trials
import examples from '../assets/examples.json';
import dataset from '../assets/dataset.json';
import trial_list from '../assets/trial_list.json';

// Define global experiment variables
// REVIEW: add more examples?
const EXAMPLE_TRIAL = examples[0].positions;
const N_TRIALS = trial_list.length;
// const TIME_PER_TRIAL = dataset[0].positions.length / 24;
var EXP_DURATION = 15 //  5 + (2.0 * TIME_PER_TRIAL) * N_TRIALS / 60.0; // in minutes
const MOT_DIM = 600; // pixels
// const STIM_DEG = 10;
// const PIXELS_ER_UNIT = MOT_DIM / STIM_DEG;
var CHINREST_SCALE = 1.0; // to adjust pixel dimensions
// Debug Variables
const SKIP_PROLIFIC_ID = false;
const SKIP_INSTRUCTIONS = false;
// const SKIP_PROLIFIC_ID = true;
// const SKIP_INSTRUCTIONS = true;


function gen_trial(jspsych,
    trial_id,
    positions,
    reverse = false,
    targets = true,
    effort_dial = true,
    effort_slider = true
) {

    if (reverse) {
        positions = positions.toReversed();
    }

    const display_size = MOT_DIM * CHINREST_SCALE;

    const tracking = {
        type: MOTPlugin,
        scene: JSON.stringify(positions),
        targets: 4,
        object_class: "mot-distractor",
        target_class: "mot-target",
        display_size: display_size,
        target_designation: targets,
        effort_dial: effort_dial,
        world_scale: 800.0, // legacy datasets are +- 400 units
        premotion_dur: 4000.0,
    };

    const sub_tl = [tracking];

    if (effort_slider) {
        sub_tl.push({
            type: HTMLSliderResponsePlugin,
            stimulus: `<div style="width:${display_size}px;">` +
                `<p>How effortful was tracking?</p></div>`,
            require_movement: true,
            labels: ['None', 'Somewhat', 'A lot']
        });
    }

    const tl = {
        timeline: sub_tl,
        data: {
            trial_id: trial_id,
            reversed: reverse,
            targets: targets,
            effort_dial: effort_dial,
            effort_slider: effort_slider
        }
    };
    return (tl);
};

/**
 * This function will be executed by jsPsych Builder and is expected to run the jsPsych experiment
 *
 * @type {import("jspsych-builder").RunFunction}
 */
export async function run({ assetPaths, input = {}, environment, title, version }) {

    const jsPsych = initJsPsych({
        show_progress_bar: true,
        on_finish: () => {
            if (typeof jatos !== 'undefined') {
                // in jatos environment
                jatos.endStudyAndRedirect(PROLIFIC_URL, jsPsych.data.get().json());
            } else {
                return jsPsych;
            };
        }
    });

    const timeline = [];

    // Consent
    timeline.push({
        type: ExternalHtmlPlugin,
        // HACK: This could change based on file names under `assets`
        url: assetPaths.misc[0],
        cont_btn: 'start',
        check_fn: function() {
            if (document.getElementById('consent_checkbox').checked) {
                return true;
            } else {
                alert('You must tick the checkbox to continue with the study.')
            }
        }
    });

    // Prolific ID
    if (!SKIP_PROLIFIC_ID) {
        timeline.push({
            type: SurveyTextPlugin,
            questions: [{
                prompt: 'Please enter your Prolific ID',
                required: true
            }],
            data: {
                type: "prolific_id",
            }
        });
    };

    // Preload assets
    timeline.push({
        type: PreloadPlugin,
        images: assetPaths.images,
        audio: assetPaths.audio,
        video: assetPaths.video,
    });

    // Welcome screen
    timeline.push({
        type: InstructionsPlugin,
        pages: [
            `<h1>Hi, welcome to our study!</h1><br><br> ` +
            `Please take a moment to adjust your seating so that you can comfortably watch the monitor and use the keyboard/mouse.<br> ` +
            `Feel free to dim the lights as well.  ` +
            `Close the door or do whatever is necessary to minimize disturbance during the experiment. <br> ` +
            `Please also take a moment to silence your phone so that you are not interrupted by any messages mid-experiment. ` +
            `<br><br> ` +
            `Click <b>Next</b> when you are ready to calibrate your display. `,
        ],
        show_clickable_nav: true,
        allow_backward: false,
        data: {
            type: "welcome",
        }
    });

    // Switch to fullscreen
    timeline.push({
        type: FullscreenPlugin,
        fullscreen_mode: true,
    });

    // Virtual chinrest
    // timeline.push({
    //   type: VirtualChinrestPlugin,
    //   blindspot_reps: 3,
    //   resize_units: "deg",
    //   pixels_per_unit: PIXELS_PER_UNIT,
    //   on_finish: function(data) {
    //     CHINREST_SCALE = data.scale_factor;
    //   },
    // });


    const instruct_tl = [];
    instruct_tl.push({
        type: InstructionsPlugin,
        pages: [
            `The study is designed to be <i>challenging</i>. <br> ` +
            ` Sometimes, you'll be certain about what you saw. <br>` +
            `Other times, you won't be -- and this is okay!<br>` +
            `Just give your best guess each time. <br><br>` +
            `Click <b>Next</b> to continue.`,

            `We know it is also difficult to stay focused for so long, especially when you are doing the same` +
            `thing over and over.<br> But remember, the experiment will be all over in less than ${EXP_DURATION} minutes.` +
            ` There are <strong>${N_TRIALS} trials</strong> in this study. <br>` +
            `Please do your best to remain focused! ` +
            ` Your responses will only be useful to us if you remain focused. <br><br>` +
            `Click <b>Next</b> to continue.`,

            "In this task, you will observe a series of objects move on the screen.<br>" +
            "At the beginning of each instance of the task, you will see <b>4</b> of the <b>8</b> " +
            "objects highlighted in <span style='color:blue'>BLUE</span> " +
            `designating them as <span style="color:blue;"><b>targets</b></span>.<br>` +
            "Shortly after, the <span style='color:blue'>BLUE</span> indication will " +
            "dissapear and the objects will begin to move.<br>" +
            "Your main task is to keep track of the targets as they move.<br>" +
            "Click <b>Next</b> to see an example of a dynamic scene with targets.",
        ],
        show_clickable_nav: true,
        // show_page_number: true,
        page_label: "<b>Instructions</b>",
        allow_backward: false,
    });

    instruct_tl.push(gen_trial(jsPsych, 0, EXAMPLE_TRIAL, false, false, false, false));

    instruct_tl.push({
        type: InstructionsPlugin,
        pages: [
            `At the end of each instance of the task, you need to select the <span style="color:blue"><b>4 targets</b></span> <span class="query-object"></span> by clicking on the objects with your mouse.<br>` +
            `If you make a mistake in your selection, you can deselect by clicking on the object again.<br>` +
            `You <b>need</b> to select 4 objects to be able to progress. <br>` +
            `If you lost track of some of the targets, just make your best guess as to which objects are targets.<br>` +
            "Click <b>Next</b> to give it a try.",
        ],
        show_clickable_nav: true,
        // show_page_number: true,
        page_label: "<b>Instructions</b>",
        allow_backward: false,
    });

    instruct_tl.push(gen_trial(jsPsych, 0, EXAMPLE_TRIAL, false, true, false, false));

    instruct_tl.push({
        type: InstructionsPlugin,
        pages: [
            `If while tracking the moving objects, you feel a sense of effort maintaining the target set,` +
            ` please press and hold the <b>SPACEBAR</b> for the duration that you experience the sense of effort.  <br>` +
            `You will not receive feedback from pressing the <b>SPACEBAR</b>. This is intentional<br>` +
            `Additionally, at then end of the trial, please use the presented slider to report the overall amount of ` +
            `effort you experienced for that trial.`,

            `Remember, the <i>main task</i> is to correctly identify the <span style="color:blue"><b>4 targets</b></span>.<br>` +
            `The secondary task is to press <b>SPACEBAR</b> whenever you feel a sense of effort while tracking ` +
            `and to report the overall amount of effort at the end of the trial.<br>` +
            "Click <b>Next</b> to practice.",
        ],
        show_clickable_nav: true,
        // show_page_number: true,
        page_label: "<b>Instructions</b>",
        allow_backward: false,
    });

    instruct_tl.push(gen_trial(jsPsych, 0, EXAMPLE_TRIAL, false));


    // comprehension check
    const comp_check = {
        type: SurveyMultiChoicePlugin,
        preamble: "<h2>Comprehension Check</h2> " +
            "<p> Before beginning the experiment, you must answer a few simple questions to ensure that the instructions are clear." +
            "<br> If you do not answer all questions correctly, you will be returned to the start of the instructions.</p>",
        questions: [{
            prompt: "Which of the following is <b>TRUE</b>",
            name: 'check1',
            options: [
                "A) Before motion, targets are indicated in black",
                "B) The main task is to indicate which objects are targets",
                "C) Objects will disspear throughout the motion phase",
            ],
            required: true
        },
        {
            prompt: " Which of the following statements is <b>FALSE</b>:",
            name: 'check2',
            options: [
                "A) The secondary task is to indicate your sense of effort while tracking",
                "B) You should maintain an arm-length distance from your monitor",
                "C) The objects on the screen remain stationary"
            ],
            required: true
        },
        ],
        randomize_question_order: false,
        on_finish: function(data) {
            const q1 = data.response.check1[0];
            const q2 = data.response.check2[0];
            // both comp checks must pass
            data.correct = (q1 == 'B' && q2 == 'C');
        },
        data: {
            type: "comp_quiz",
        }
    };

    // feedback
    const comp_feedback = {
        type: HTMLButtonResponsePlugin,
        stimulus: () => {
            var last_correct_resp = jsPsych.data.getLastTrialData().values()[0].correct;
            var msg;
            if (last_correct_resp) {
                msg = "<h2><span style='color:green'>You passed the comprehension check!</span>" +
                    "<br>When you're ready, please click <b>Next</b> to begin the study. </h2>";
            } else {
                msg = "<h2><span style='color:red'>You failed to respond <b>correctly</b> to all" +
                    " parts of the comprehension check.</span> <br>Please click <b>Next</b> to revisit the instructions.</h2>"
            }
            return msg
        },
        choices: ['Next'],
        data: {
            // add any additional data that needs to be recorded here
            type: "comp_feedback",
        }
    };

    // `comp_loop`: if answers are incorrect, `comp_check` will be repeated until answers are correct responses
    const comp_loop = {
        timeline: [...instruct_tl, comp_check, comp_feedback],
        loop_function: function(data) {
            // return false if comprehension passes to break loop
            // HACK: changing `timeline` will break this
            const vals = data.values();
            const quiz = vals[vals.length - 2];
            return (!(quiz.correct));
        }
    };

    // add comprehension loop
    if (!SKIP_INSTRUCTIONS) {
        timeline.push(comp_loop);
    };

    // add exp trials with random shuffle, unique per session
    // for (const trial of jsPsych.randomization.shuffle(trial_list)) {
    for (const trial of trial_list) {
        const [tid, reverse] = trial.slice(0, 2);
        const positions = dataset[tid - 1].positions;
        timeline.push(gen_trial(jsPsych, tid, positions, reverse));
    };


    // debriefing
    timeline.push({
        type: SurveyTextPlugin,
        preamble: `<h2><b>Thank you for helping us with our study! ` +
            `This study was designed to be difficult and we value your responses. </b></h2><br><br> ` +
            `Please fill out the (optional) survey below and click <b>Done</b> to complete the experiment. <br> `,
        questions: [
            {
                prompt: 'Did you find yourself using any strategies while performing the task?',
                name: 'Strategy', rows: 5, placeholder: 'None'
            },

            {
                prompt: "Are there any additional comments you'd like to add? ",
                name: 'General', rows: 5, placeholder: 'None'
            }
        ],
        button_label: 'Done'
    });

    await jsPsych.run(timeline);

    // Return the jsPsych instance so jsPsych Builder can access the experiment results (remove this
    // if you handle results yourself, be it here or in `on_finish()`)
    return jsPsych;
}
