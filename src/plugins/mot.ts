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

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    /**
     * SETUP
     */

    // VARIABLE DECLARATIONS
    let state = JSON.parse(trial.scene);
    let n_objects = state[0].length;
    let obj_elems = Array<HTMLElement>(n_objects);
    let selected = Array<Boolean>(n_objects);
    let effort_el: HTMLElement;
    let effort_dial = [];
    let start_time: number = 0.0;


    // ELEMENTS
    let mot_el = document.createElement("div");
    mot_el.className = "mot-div";
    display_element.appendChild(mot_el);
    // effort dial
    if (trial.effort_dial) {
      effort_el = document.createElement("div");
      effort_el.className = "hl";
      display_element.appendChild(effort_el);
    }

    // initialize animation timeline
    let tl = anime.timeline({
      easing: 'linear',
      autoplay: false,
    });

    // add prompt at end of animation
    tl.complete = () => {
      // clean up effort dial
      if (trial.effort_dial) {
        effort_el.style.display = 'none';
        document.removeEventListener("mousemove", handle_mouse_move, false);
      }
      // disable effort dial
      let mot_prompt = document.createElement("span");
      mot_prompt.className = "mot-prompt";
      mot_prompt.innerHTML = `Please select ${trial.targets}`;
      display_element.appendChild(mot_prompt);
    };

    const t_pos = (xy: Array<number>) => {
      let [x, y] = xy;
      // from center coordinates to div top-left corner
      let tx = (x / trial.world_scale) * trial.display_size;
      // adjust by object radius
      tx *= 0.92 // if ds = 500px, range from [-230, +230]
      // tx += 0.05 * trial.display_size; // 40px / trial.world_scalepx
      // from center coordinates to div top-left corner
      let ty = (-(y / trial.world_scale) + 0.5) * (trial.display_size);
      // adjust by object radius
      ty *= 0.92 // if ds = 500px, range from [0, 460]
      // ty -= 0.05 * trial.display_size;
      return ([tx, ty]);
    };

    // populate scene with objects
    for (let i=0; i<obj_elems.length; i++) {
      const css_cls = (i < trial.targets) ? trial.target_class : trial.object_class
      const obj_el = document.createElement("span");
      // const obj_i = i;
      obj_el.className = css_cls;
      obj_el.id = `obj_${i}`;
      obj_el.addEventListener("click", () => {
        if (tl.completed) {
          selected[i] = !(selected[i]);
          obj_el.className = selected[i] ?
            trial.target_class : trial.object_class;
          // after a click - check if enough objects are selected
          after_response();
        }
      });
      // store info
      mot_el.appendChild(obj_el);
      obj_elems[i] = obj_el;
      selected[i] = false;
      // initial positoins of objects
      let [x, y] = t_pos(state[0][i].slice(0, 2));
      tl.set(obj_elems[i], {
        translateX: x,
        translateY: y,
        scale: trial.display_size / trial.world_scale,
      });
    }

    // create next button
    // will only appear after enough objects are selected
    var btn_el: HTMLButtonElement = document.createElement("button");
    btn_el.className = "button";
    btn_el.id = "resp_btn";
    btn_el.disabled = true;
    btn_el.style.display = "none";
    btn_el.innerHTML = "Next"
    btn_el.addEventListener("click", (_) => {
      end_trial();
    })
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
      if (trial.effort_dial) {
        // show effort dial
        effort_el.style.display = 'block';
        // effort_el.style.bottom = '5px';
        // effort_el.style
        // add dial event
        document.addEventListener("mousemove", handle_mouse_move,
                                  false);
      }
      // start animation
      tl.play();
    }, trial.premotion_dur);

    // motion phase
    for (let i = 0; i < n_objects; i++) {
      let i_pos = state.map(frame => t_pos(frame[i].slice(0, 2)));
      tl.add({
        targets: obj_elems[i],
        translateX: i_pos.map(f => ({value: f[0],
                                     duration: trial.step_dur})),
        translateY: i_pos.map(f => ({value: f[1],
                                     duration: trial.step_dur})),
        // motion begins at end of `premotion_dur`
      }, 0);
    }

    // effort responses
    const handle_mouse_move = (m: MouseEvent) => {
      let rt = performance.now() - start_time;
      effort_dial.push({
        rt : rt,
        y : m.clientY,
      });
      effort_el.style.transform = `translateY(${m.clientY}px)`;
    };

    // target designation phase
    // `after_response` is called whenever an object is clicked.
    // if enough objects are selected, the `next` button will appear.
    const after_response = () => {
      if (tl.completed &&
        selected.filter(Boolean).length >= trial.targets) {
        allow_next();
      } else {
        disable_next();
      }
    };

    // called by clicking the next button
    const end_trial = () => {
      // data saving
      // TODO: save selection timings
      // TODO: add effort input
      var trial_data = {
        selected_objects: selected,
        selection_timings: "value",
        effort_dial : effort_dial,
      };
      display_element.innerHTML = "";
      // end trial
      this.jsPsych.finishTrial(trial_data);
    };


    // called by `after_response`
    const allow_next = () => {
      btn_el.disabled = false;
      btn_el.style.display = "block";
    };

    const disable_next = () => {
      btn_el.disabled = true;
      btn_el.style.display = "none";
    };
  }

}

export default MOTPlugin;
