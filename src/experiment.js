/**
 * @title object tracking
 * @description Track moving targets
 * @version 0.1.0
 *
 * @assets assets/
 */

// You can import stylesheets (.scss or .css).
import "../styles/main.scss";

import PreloadPlugin from "@jspsych/plugin-preload";
import FullscreenPlugin from "@jspsych/plugin-fullscreen";
// import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import HTMLButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import HTMLSliderResponsePlugin from "@jspsych/plugin-html-slider-response";
import MOTPlugin from "./plugins/mot.ts";
import { initJsPsych } from "jspsych";

// trial list
import trials from '../assets/exp2_probes.json';

/**
 * This function will be executed by jsPsych Builder and is expected to run the jsPsych experiment
 *
 * @type {import("jspsych-builder").RunFunction}
 */
export async function run({ assetPaths, input = {}, environment, title, version }) {
  const jsPsych = initJsPsych();

  const timeline = [];

  // Preload assets
  timeline.push({
    type: PreloadPlugin,
    images: assetPaths.images,
    audio: assetPaths.audio,
    video: assetPaths.video,
  });

  // Welcome screen
  timeline.push({
    type: HTMLButtonResponsePlugin,
    stimulus: "<p>Welcome to object tracking!<p/>",
    choices: ['Next'],
    prompt: "<p>Click `Next` to continue.<p/>"
  });

  // Switch to fullscreen
  // timeline.push({
  //   type: FullscreenPlugin,
  //   fullscreen_mode: true,
  // });

  let scene_parsed = JSON.stringify(trials[1].positions);
  timeline.push({
    type: MOTPlugin,
    scene: scene_parsed,
    targets: 4,
    object_class: "mot-distractor",
    target_class: "mot-target",
    display_size: 500,
    effort_dial: true,
    world_scale: 800.0, // legacy datasets are +- 400 units
  });

  timeline.push({
    type: HTMLSliderResponsePlugin,
    stimulus: `<div style="width:500px;">
        <p>How effortful was tracking?</p>
        </div>`,
    require_movement: true,
    labels: ['None', 'Somewhat', 'A lot']
  });

  await jsPsych.run(timeline);

  // Return the jsPsych instance so jsPsych Builder can access the experiment results (remove this
  // if you handle results yourself, be it here or in `on_finish()`)
  return jsPsych;
}
