/**
 * Represents a single choice in a user-interactive lesson.
 */
export interface Choice {
  message: string;
  next: number; // Corresponds to the index of the next lesson in the `lessons` array
}

/**
 * Represents a standard lesson (no choices).
 * This type of lesson does NOT have user choices.
 */
export interface StandardLesson {
  speaker: string; // Allows any speaker
  message: string;
  choices?: never; // Explicitly ensures 'choices' property does not exist
  end?: boolean; // Optional flag to indicate the end of the module
}

/**
 * Represents a user-interactive lesson (with choices).
 * This type of lesson MUST have a 'choices' array.
 */
export interface UserLesson {
  speaker: "user"; // Based on data, only 'user' has choices
  message: string;
  choices: Choice[];
  end?: never; // A user lesson does not end the module directly
}

/**
 * A lesson can be either a user interaction (with choices) or a standard message (no choices).
 * This is a discriminated union. TypeScript will check for 'UserLesson' first.
 * - If 'choices' is present, it must be a 'UserLesson' (and speaker must be 'user').
 * - If 'choices' is absent, it's a 'StandardLesson' (and speaker can be any string).
 */
export type Lesson = UserLesson | StandardLesson;

/**
 * Represents a single training module, containing its metadata and lessons.
 */
export interface Module {
  name: string;
  description: string;
  lessons: Lesson[];
}

/**
 * The root type for the entire data structure, mapping module IDs (e.g., "Module 1A")
 * to their corresponding Module object.
 */
export type Modules = {
  [moduleId: string]: Module;
};

// Example usage:
// const trainingData: Modules = { ... your JSON data ... };
