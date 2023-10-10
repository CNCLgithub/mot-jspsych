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
    var obj_elems = Array<HTMLElement>(n_objects);
    let selected = Array<Boolean>(n_objects);

    // initialize animation timeline
    let tl = anime.timeline({
      easing: 'linear',
      autoplay: false,
    });

    // add prompt at end of animation
    tl.complete = () => {
      let mot_prompt = document.createElement("span");
      mot_prompt.className = "mot-prompt";
      mot_prompt.innerHTML = `Please select ${trial.targets}`;
      display_element.appendChild(mot_prompt);
    }

    // populate scene with objects
    for (let i=0; i<obj_elems.length; i++) {
      const css_cls = (i < trial.targets) ? trial.target_class : trial.object_class
      const obj_el = document.createElement("span");
      // const obj_i = i;
      obj_el.className = css_cls;
      obj_el.id = `obj_${i}`;
      obj_el.addEventListener("click", () => {
        console.log("object click");
        console.log(anime.running);
        console.log(tl);
        if (tl.completed) {
          selected[i] = !(selected[i]);
          obj_el.className = selected[i] ?
            trial.target_class : trial.object_class;
          // after a click - check if enough objects are selected
          after_response();
        }
      });
      // store info
      display_element.appendChild(obj_el);
      obj_elems[i] = obj_el;
      selected[i] = false;
      // initial positoins of objects
      let [x, y] = state[0][i];
      tl.set(obj_elems[i], {
        translateX: x / 2.0,
        translateY: y / 2.0,
        // translateX: `${(x / 800.0)}%`,
        // translateY: `${(y / 800.0)}%`,
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
      for (let i = 0; i < trial.targets; i++) {
        obj_elems[i].className = trial.object_class;
      }
      tl.play();
    }, trial.premotion_dur);

    // motion phase
    for (let i = 0; i < n_objects; i++) {
      tl.add({
        targets: obj_elems[i],
        translateX: state.map(s => ({value: s[i][0]/2, duration: trial.step_dur})),
        translateY: state.map(s => ({value: s[i][1]/2, duration: trial.step_dur})),
        // motion begins at end of `premotion_dur`
      }, 0);
    }

    // response phase
    // `after_response` is called whenever an object is clicked.
    // if enough objects are selected, the `next` button will appear.
    const after_response = () => {
      console.log(selected);
      let selections = selected.filter(Boolean);
      console.log(selections);
      if (tl.completed &&
        selections.length >= trial.targets) {
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
