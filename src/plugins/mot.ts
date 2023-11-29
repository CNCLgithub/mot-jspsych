import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";
import anime from 'animejs';

const info = <const>{
    name: "MOT",
    parameters: {
        scene: {
            // BOOL, STRING, INT, FLOAT, FUNCTION, KEY, KEYS, SELECT, HTML_STRING,
            // IMAGE, AUDIO, VIDEO, OBJECT, COMPLEX
            type: ParameterType.STRING,
            description: "The json-serialized string encoding motion frames." +
                " The string should decode into an array of arrays, where the first" +
                " dimension denotes the number of time steps, and the second dimension" +
                " denotes the state for each object.",
        },
        targets: {
            type: ParameterType.INT,
            description: "The first N objects in `scene` are denoted as targets."
        },
        object_class: {
            type: ParameterType.STRING,
            description: "The css class describing object appearance.",
        },
        target_class: {
            type: ParameterType.STRING,
            description: "The css class describing target appearance.",
        },
        display_size: {
            type: ParameterType.INT,
            description: "The size in pixels of the (square) display.",
        },
        step_dur: {
            type: ParameterType.FLOAT,
            default: 41.67,
            description: "Duration of a single step in the motion phase (in ms).",
        },
        premotion_dur: {
            type: ParameterType.FLOAT,
            default: 3000.0,
            description: "The duration of the pre-motion phase (in ms).",
        },
        response_dur: {
            type: ParameterType.FLOAT,
            default: Infinity,
            description: "The duration of the response phase (in ms).",
        },
        target_designation: {
            type: ParameterType.BOOL,
            default: true,
            description: "Collect target designations",
        },
        effort_dial: {
            type: ParameterType.BOOL,
            default: false,
            description: "Display and collect responses from a dynamic effort dial.",
        },
        world_scale: {
            type: ParameterType.FLOAT,
            default: 1.0,
            description: "Scaling factor for object trajectories.",
        },
    },
};

type Info = typeof info;

/**
 * **MOT**
 *
 * Track objects with your mind!
 *
 * @author Mario Belledonne
 * @see {@link https://DOCUMENTATION_URL DOCUMENTATION LINK TEXT}
 */
class MOTPlugin implements JsPsychPlugin<Info> {
    static info = info;

    constructor(private jsPsych: JsPsych) { }

    trial(display_element: HTMLElement, trial: TrialType<Info>) {
        /**
            * SETUP
            */

        // VARIABLE DECLARATIONS
        const state = JSON.parse(trial.scene);
        const n_objects = state[0].length;
        const obj_elems = Array<HTMLElement>(n_objects);
        const selected = Array<Boolean>(n_objects);
        let mot_prompt: HTMLElement;
        const effort_dial: Array<Float32Array<2>> = [];
        let start_time: number = 0.0;
        const tot_dur = trial.step_dur * state.length;
        const world_to_display = trial.display_size / trial.world_scale;
        const obj_dim = 40.0 * world_to_display;
        const screen_width = document.getElementsByTagName('body')[0].offsetWidth;
        // audio for effort dial
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const gain = audioCtx.createGain();
        const oscillator = audioCtx.createOscillator();

        // ELEMENTS
        let mot_el = document.createElement("div");
        mot_el.className = "mot-div";
        mot_el.style = `width:${trial.display_size}px;height:${trial.display_size}px`;
        display_element.appendChild(mot_el);

        // mot prompt
        if (trial.target_designation) {
            mot_prompt = document.createElement("div");
            mot_prompt.className = "jspsych-top";
            // mot_prompt.className = "mot-prompt";
            mot_prompt.style = "color:white";
            mot_prompt.innerHTML = `Please select ${trial.targets} objects`;
            display_element.appendChild(mot_prompt);
        }

        // initialize animation timeline
        let tl = anime.timeline({
            easing: 'linear',
            autoplay: false,
        });

        // add prompt at end of animation
        tl.complete = () => {
            // effort dial
            if (trial.effort_dial) {
                document.removeEventListener("mousemove", update_effort_dial);
                oscillator.stop();
                gain.disconnect(audioCtx.destination);
            }


            // viz prompt
            if (trial.target_designation) {
                mot_prompt.style = "color:black";
            } else {
                allow_next();
            }
            // effort keyboarevents should termineate on their own
        };

        const t_pos = (xy: Array<number>) => {
            let [x, y] = xy;
            // from center coordinates to div top-left corner
            let tx = x * world_to_display; // -400 -> -250px
            // adjust by object radius
            tx *= 0.95 // if ds = 500px, range from [-230, +230]
            // from center coordinates to div top-left corner
            let ty = (-(y / trial.world_scale) + 0.5) * (trial.display_size);
            // adjust by object radius
            ty *= 0.95 // if ds = 500px, range from [0, 460]
            return ([tx, ty]);
        };

        // populate scene with objects
        for (let i = 0; i < obj_elems.length; i++) {
            const css_cls = (i < trial.targets) ? trial.target_class : trial.object_class
            const obj_el = document.createElement("span");
            obj_el.className = css_cls;
            obj_el.style = `width:${obj_dim}px;height:${obj_dim}px`;
            obj_el.id = `obj_${i}`;
            // optionally add object selection
            if (trial.target_designation) {
                obj_el.addEventListener("click", () => {
                    if (tl.completed) {
                        selected[i] = !(selected[i]);
                        obj_el.className = selected[i] ?
                            trial.target_class : trial.object_class;
                        // after a click - check if enough objects are selected
                        after_response();
                    }
                });
            }
            // store info
            mot_el.appendChild(obj_el);
            obj_elems[i] = obj_el;
            selected[i] = false;
            // initial positoins of objects
            let [x, y] = t_pos(state[0][i].slice(0, 2));
            tl.set(obj_elems[i], {
                translateX: x,
                translateY: y,
                // scale: trial.display_size / trial.world_scale,
            });
        }

        // create next button
        // enabled after motion, optionally after enough selections
        var btn_el: HTMLButtonElement = document.createElement("button");
        btn_el.className = "jspsych-btn";
        btn_el.id = "resp_btn";
        btn_el.disabled = true;
        btn_el.style = "margin:10px";
        btn_el.innerHTML = "Next"
        btn_el.addEventListener("click", (_) => { end_trial(); });
        display_element.appendChild(btn_el);

        // pre-motion phase
        // indicate targets
        this.jsPsych.pluginAPI.setTimeout(() => {
            // hide targets
            for (let i = 0; i < trial.targets; i++) {
                obj_elems[i].className = trial.object_class;
            }
            // mark animation start time
            start_time = performance.now();
            // add effort dial
            if (trial.effort_dial) {
                const real = new Float32Array(2);
                const imag = new Float32Array(2);
                real[0] = 0.05;
                imag[0] = 0.1;
                real[1] = 0.75;
                imag[1] = 0.2;
                const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: true });

                // oscillator.type = "custom";
                oscillator.setPeriodicWave(wave);

                // oscillator.type = "sine";

                oscillator.frequency.value = 300.0;
                // oscillator.connect(audioCtx.destination);
                oscillator.connect(gain).connect(audioCtx.destination);
                gain.gain.value = 0.8;
                gain.gain.setValueAtTime(1, audioCtx.currentTime);
                const stopTime = audioCtx.currentTime + (tot_dur / 1000.0);
                gain.gain.setTargetAtTime(0, stopTime - 0.100, .025);
                oscillator.start();
                // Get new mouse pointer coordinates when mouse is moved
                // then set new gain and pitch values
                document.addEventListener("mousemove", update_effort_dial);

            }
            // start animation
            tl.play();
        }, trial.premotion_dur);

        // motion phase
        for (let i = 0; i < n_objects; i++) {
            let i_pos = state.map(frame => t_pos(frame[i].slice(0, 2)));
            tl.add({
                targets: obj_elems[i],
                translateX: i_pos.map(f => ({
                    value: f[0],
                    duration: trial.step_dur
                })),
                translateY: i_pos.map(f => ({
                    value: f[1],
                    duration: trial.step_dur
                })),
                // motion begins at end of `premotion_dur`
            }, 0);
        }


        // target designation phase
        // `after_response` is called whenever an object is clicked.
        // if enough objects are selected, the `next` button will appear.
        const after_response = () => {
            if (tl.completed) {
                // check for minimum number of selections
                if (selected.filter(Boolean).length >= trial.targets) {
                    allow_next();
                } else {
                    disable_next();
                }
            }
        };

        // called by clicking the next button
        const end_trial = () => {
            // TODO: save selection timings
            var trial_data = {
                selected_objects: selected,
                effort_dial_responses: effort_dial,
            };
            display_element.innerHTML = "";
            console.log(trial_data);
            // end trial
            this.jsPsych.finishTrial(trial_data);
        };


        // called by `after_response`
        const allow_next = () => {
            btn_el.disabled = false;
            // btn_el.style.display = "block";
        };

        const disable_next = () => {
            btn_el.disabled = true;
            // btn_el.style.display = "none";
        };


        const update_effort_dial = (e: MouseEvent) => {
            const dial_value: number = (e.pageX / screen_width).clamp(0.0, 1.0)
            const freq: number = dial_value * 400.0 + 200.00
            const dt = performance.now() - start_time;
            oscillator.frequency.value = freq;
            if (dt > 0.0 && dt % 10 == 0) {
                const data = new Float32Array(2);
                data[0] = dt;
                data[1] = dial_value;
                effort_dial.push(data);
            }
        };
    }

}

/**
 * Returns a number whose value is limited to the given range.
 *
 * Example: limit the output of this computation to between 0 and 255
 * (x * 255).clamp(0, 255)
 *
 * Borrowed from: https://stackoverflow.com/a/11409944
 *
 * @param {Number} min The lower boundary of the output range
 * @param {Number} max The upper boundary of the output range
 * @returns A number in the range [min, max]
 * @type Number
 */
Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
};

export default MOTPlugin;
