import { Config } from "@remotion/cli/config";

// Deterministic, high-quality H.264 output for the square hero.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Crisp stills for the poster frame.
Config.setStillImageFormat("png");
