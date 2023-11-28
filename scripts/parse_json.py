#!/usr/bin/env python3

import os
import json
import argparse
import numpy as np
import polars as pl


def init_dfs():
    performance = pl.DataFrame(
        schema={
            "scene": pl.Int32,
            "reversed": pl.Boolean,
            "order": pl.Int32,
            "td": pl.Float64,
            "uid": pl.Int32,
        }
    )
    effort_slider = pl.DataFrame(
        schema={
            "scene": pl.Int32,
            "reversed": pl.Boolean,
            "order": pl.Int32,
            "effort": pl.Float64,
            "uid": pl.Int32,
        }
    )
    effort_dial = pl.DataFrame(
        schema={
            "scene": pl.Int32,
            "reversed": pl.Boolean,
            "order": pl.Int32,
            "keydown": pl.Float64,
            "keyup": pl.Float64,
            "uid": pl.Int32,
        }
    )
    return (performance, effort_slider, effort_dial)


def parse_subj_data(timeline: dict, idx: int):
    # look for the start of the experimental trials
    exp_start = 0
    for i, step in enumerate(timeline):
        if step.get("type", None) == "comp_quiz" and step.get("correct", False):
            exp_start = i + 2  # two ahead
            break

    timeline = timeline[exp_start:-1]  # last step is the exit page
    performance = {"scene": [], "reversed": [], "order": [], "td": []}
    effort_key = {"scene": [], "reversed": [], "order": [], "keydown": [], "keyup": []}
    effort_slider = {"scene": [], "reversed": [], "order": [], "effort": []}

    for exp_trial in timeline:
        scene = exp_trial.get("trial_id", None)
        reversed = exp_trial.get("reversed", None)
        order = exp_trial.get("trial_index", None)
        target_designations = exp_trial.get("selected_objects", None)
        effort_rating = exp_trial.get("response", None)
        effort_presses = exp_trial.get("effort_dial_responses", None)

        if scene is None:
            continue

        if target_designations is not None:
            td = np.mean(target_designations[:4])
            performance["td"].append(td)
            performance["scene"].append(scene)
            performance["reversed"].append(reversed)
            performance["order"].append(order)

        if effort_rating is not None:
            effort_slider["effort"].append(effort_rating)
            effort_slider["scene"].append(scene)
            effort_slider["reversed"].append(reversed)
            effort_slider["order"].append(order)

        if effort_presses is not None:
            for down, up in zip(effort_presses[0::2], effort_presses[1::2]):
                effort_key["keydown"].append(float(down[1]))
                effort_key["keyup"].append(float(up[1]))
                effort_key["scene"].append(int(scene))
                effort_key["reversed"].append(reversed)
                effort_key["order"].append(order)

    performance["uid"] = idx
    effort_slider["uid"] = idx
    effort_key["uid"] = idx
    return (
        pl.DataFrame(
            performance,
            schema={
                "scene": pl.Int32,
                "reversed": pl.Boolean,
                "order": pl.Int32,
                "td": pl.Float64,
                "uid": pl.Int32,
            },
        ),
        pl.DataFrame(
            effort_slider,
            schema={
                "scene": pl.Int32,
                "reversed": pl.Boolean,
                "order": pl.Int32,
                "effort": pl.Float64,
                "uid": pl.Int32,
            },
        ),
        pl.DataFrame(
            effort_key,
            schema={
                "scene": pl.Int32,
                "reversed": pl.Boolean,
                "order": pl.Int32,
                "keydown": pl.Float64,
                "keyup": pl.Float64,
                "uid": pl.Int32,
            },
        ),
    )


def main():
    parser = argparse.ArgumentParser(
        description="Parses JATOS data",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("dataset", type=str, help="Which scene dataset to use")
    args = parser.parse_args()
    raw = []
    with open(args.dataset, "r") as f:
        for subj in f:
            raw.append(json.loads(subj))

    performance, effort_slider, effort_dial = init_dfs()
    for idx, subj in enumerate(raw):
        (p, s, k) = parse_subj_data(subj, idx)
        print(performance)
        print(p)
        performance.vstack(p, in_place=True)
        effort_slider.vstack(s, in_place=True)
        effort_dial.vstack(k, in_place=True)

    print(performance)
    print(effort_slider)
    print(effort_dial)
    result_out = os.path.dirname(args.dataset)
    perf_out = os.path.basename(args.dataset).replace(".txt", "_performance.csv")
    effort_slider_out = os.path.basename(args.dataset).replace(
        ".txt", "_effort_slider.csv"
    )
    effort_dial_out = os.path.basename(args.dataset).replace(".txt", "_effort_dial.csv")
    performance.write_csv(f"{result_out}/{perf_out}")
    effort_slider.write_csv(f"{result_out}/{effort_slider_out}")
    effort_dial.write_csv(f"{result_out}/{effort_dial_out}")


if __name__ == "__main__":
    main()
