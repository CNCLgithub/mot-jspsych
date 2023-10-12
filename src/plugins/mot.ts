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
    slider: {
      type: ParameterType.BOOL,
      default: false,
      description: "Display and collect responses from a dynamic effort slider.",
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

    // parse scene json
    let state = JSON.parse(trial.scene);
    let n_objects = state[0].length;
    let obj_elems = Array<HTMLElement>(n_objects);
    let selected = Array<Boolean>(n_objects);
    let kb_events: Array<number> = [];
    let start_time: number = 0.0;

    // add scene border
    let mot_el = document.createElement("div");
    mot_el.className = "mot-div";
    display_element.appendChild(mot_el);

    // initialize animation timeline
    let tl = anime.timeline({
      easing: 'linear',
      autoplay: false,
    });

    // add prompt at end of animation
    tl.complete = () => {
      //disable keyboard
      this.jsPsych.pluginAPI.cancelKeyboardResponse(effort_kb);
      // ensure that `mot-div` is solid
      anime.set(mot_el, { borderColor: '#000000' });
      let mot_prompt = document.createElement("span");
      mot_prompt.className = "mot-prompt";
      mot_prompt.innerHTML = `Please select ${trial.targets}`;
      display_element.appendChild(mot_prompt);
    };

    const t_pos = (xy: Array<number>) => {
      let [x, y] = xy;
      // from center coordinates to div top-left corner
      let tx = (x / 800) * trial.display_size;
      // adjust by object radius
      tx *= 0.92 // if ds = 500px, range from [-230, +230]
      // tx += 0.05 * trial.display_size; // 40px / 800px
      // from center coordinates to div top-left corner
      let ty = (-(y / 800) + 0.5) * (trial.display_size);
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
      console.log("start_time", start_time);
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
    let effort_kb = this.jsPsych.pluginAPI.getKeyboardResponse({
      callback_function: () => {
        if (start_time > 0){
          let rt = performance.now() - start_time;
          let last_rt = kb_events.length == 0 ? 0 : kb_events[kb_events.length - 1];
          if ((rt - last_rt) > 200) {
            kb_events.push(rt);
            anime({
              targets: mot_el,
              borderColor: ['#000000', '#FFFFFF'],
              easing: 'easeInOutSine',
              duration: 100,
              direction: 'alternate',
              loop: 6,
            });
          }
        }
      },
      valid_responses: [' '],
      rt_method: 'performance',
      persist: true,
      allow_held_key: true,
    });

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
        kb_rts : kb_events,
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
