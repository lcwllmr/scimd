#!/usr/bin/env node

import commandLineArgs from "command-line-args";
import { runRender } from "./cmd_render.js";
import { runWatch } from "./cmd_watch.js";

const usage = [
  "Usage:",
  "  scimd render <file.md> [-o <output-dir>]",
  "  scimd watch <file.md> [-p <port>]",
].join("\n");

type MainOptions = {
  command?: string;
  _unknown?: string[];
};

let command: string | undefined;
let argv: string[] = [];

try {
  const mainDefinitions = [{ name: "command", defaultOption: true }];
  const mainOptions = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true }) as MainOptions;
  command = mainOptions.command;

  if (command !== "render") {
    if (command !== "watch") {
      throw new Error("Invalid command");
    }
  }

  argv = mainOptions._unknown ?? [];
} catch {
  console.error(usage);
  process.exit(1);
}

if (command === "render") {
  runRender(argv);
} else {
  runWatch(argv);
}
