import { readdir } from "fs/promises";
import pc from "picocolors";
import prompts from "prompts";
import * as semver from "semver";
import { CliCompilerHost } from "../core/cli/types.js";
import { installTypeSpecDependencies } from "../core/install.js";
import { createDiagnostic } from "../core/messages.js";
import { getBaseFileName, getDirectoryPath } from "../core/path-utils.js";
import { CompilerHost, Diagnostic, NoTarget, SourceFile } from "../core/types.js";
import { MANIFEST } from "../manifest.js";
import { readUrlOrPath } from "../utils/misc.js";
import { getTypeSpecCoreTemplates } from "./core-templates.js";
import { validateTemplateDefinitions, ValidationResult } from "./init-template-validate.js";
import { EmitterTemplate, InitTemplate, InitTemplateLibrarySpec } from "./init-template.js";
import {
  isFileSkipGeneration,
  makeScaffoldingConfig,
  normalizeLibrary,
  scaffoldNewProject,
} from "./scaffold.js";

export interface InitTypeSpecProjectOptions {
  templatesUrl?: string;
  template?: string;
}

export async function initTypeSpecProject(
  host: CliCompilerHost,
  directory: string,
  options: InitTypeSpecProjectOptions = {},
) {
  if (!(await confirmDirectoryEmpty(directory))) {
    return;
  }

  const folderName = getBaseFileName(directory);

  // Download template configuration and prompt user to select a template
  // No validation is done until one has been selected
  const typeSpecCoreTemplates = await getTypeSpecCoreTemplates(host);
  const result =
    options.templatesUrl === undefined
      ? (typeSpecCoreTemplates as LoadedTemplate)
      : await downloadTemplates(host, options.templatesUrl);
  const templateName = options.template ?? (await promptTemplateSelection(result.templates));

  // Validate minimum compiler version for non built-in templates
  if (
    result !== typeSpecCoreTemplates &&
    !(await validateTemplate(result.templates[templateName], result))
  ) {
    return;
  }

  const template = result.templates[templateName] as InitTemplate;
  if (template.description) {
    // eslint-disable-next-line no-console
    console.log(template.description);
  }
  const { name, includeGitignore } = await prompts([
    {
      type: "text",
      name: "name",
      message: `Project name`,
      initial: folderName,
    },
    {
      type: "confirm",
      name: "includeGitignore",
      message: "Do you want to generate a .gitignore file?",
      initial: true,
    },
  ]);

  const libraries = await selectLibraries(template);
  const emitters = await selectEmitters(template);
  const parameters = await promptCustomParameters(template);
  const scaffoldingConfig = makeScaffoldingConfig(template, {
    baseUri: result.baseUri,
    libraries,
    name,
    directory,
    folderName,
    parameters,
    includeGitignore,
    emitters,
  });

  await scaffoldNewProject(host, scaffoldingConfig);
  const projectJsonCreated = !isFileSkipGeneration(
    "package.json",
    scaffoldingConfig.template.files ?? [],
  );

  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(pc.green("Project created successfully."));

  if (projectJsonCreated) {
    // eslint-disable-next-line no-console
    console.log(pc.green("Installing dependencies..."));
    await installTypeSpecDependencies(host, directory);
  }

  if (Object.values(emitters).some((emitter) => emitter.message !== undefined)) {
    // eslint-disable-next-line no-console
    console.log(pc.yellow("\nPlease review the following messages from emitters:"));

    for (const key of Object.keys(emitters)) {
      if (emitters[key].message) {
        // eslint-disable-next-line no-console
        console.log(`  ${key}: \n\t${emitters[key].message}`);
      }
    }
  }
}

async function promptCustomParameters(template: InitTemplate): Promise<Record<string, any>> {
  if (!template.inputs) {
    return {};
  }

  const promptList = [...Object.entries(template.inputs)].map(([name, input]) => {
    return {
      name,
      type: input.type,
      message: input.description,
      initial: input.initialValue,
    };
  });
  return await prompts(promptList);
}

async function isDirectoryEmpty(directory: string) {
  try {
    const files = await readdir(directory);
    return files.length === 0;
  } catch {
    return true;
  }
}

async function confirmDirectoryEmpty(directory: string) {
  if (await isDirectoryEmpty(directory)) {
    return true;
  }

  return confirm(
    `Folder '${directory}' is not empty. Are you sure you want to initialize a new project here?`,
  );
}

async function confirm(message: string): Promise<boolean> {
  const { confirm } = await prompts({
    name: "confirm",
    type: "confirm",
    message,
    initial: true,
  });
  return confirm;
}

export interface LoadedTemplate {
  readonly baseUri: string;
  readonly templates: Record<string, InitTemplate>;
  readonly file: SourceFile;
}
async function downloadTemplates(host: CompilerHost, url: string): Promise<LoadedTemplate> {
  let file: SourceFile;
  try {
    file = await readUrlOrPath(host, url);
  } catch (e: any) {
    throw new InitTemplateError([
      createDiagnostic({
        code: "init-template-download-failed",
        target: NoTarget,
        format: { url: url, message: e.message },
      }),
    ]);
  }

  let json: unknown;
  try {
    json = JSON.parse(file.text);
  } catch (e: any) {
    throw new InitTemplateError([
      createDiagnostic({
        code: "init-template-invalid-json",
        target: NoTarget,
        format: { url: url, message: e.message },
      }),
    ]);
  }

  return { templates: json as any, baseUri: getDirectoryPath(file.path), file };
}

async function promptTemplateSelection(templates: Record<string, any>): Promise<string> {
  const { templateName } = await prompts({
    type: "select",
    name: "templateName",
    message: "Please select a template",
    choices: Object.entries(templates).map(([id, template]) => {
      return {
        value: id,
        description: template.description,
        title:
          template.title +
          `\tmin compiler ver: ${
            template.compilerVersion ? template.compilerVersion : "-not specified-"
          }`,
      };
    }),
  });

  const template = templates[templateName];
  if (!template) {
    throw new Error(`Unexpected error: Cannot find template ${templateName}`);
  }

  return templateName;
}

async function validateTemplate(template: any, loaded: LoadedTemplate): Promise<boolean> {
  // After selection, validate the template definition
  const currentCompilerVersion = MANIFEST.version;
  let validationResult: ValidationResult;
  // 1. If current version > compilerVersion, proceed with strict validation
  if (
    template.compilerVersion === undefined ||
    semver.gte(currentCompilerVersion, template.compilerVersion)
  ) {
    validationResult = validateTemplateDefinitions(template, loaded.file, true);

    // 1.1 If strict validation fails, try relaxed validation
    if (!validationResult.valid) {
      validationResult = validateTemplateDefinitions(template, loaded.file, false);
    }
  } else {
    // 2. if version mis-match or none specified, warn and prompt user to continue or not
    const confirmationMessage = `The template you selected is designed for tsp version ${template.compilerVersion}. You are currently using tsp version ${currentCompilerVersion}.`;
    if (
      await confirm(
        `${confirmationMessage} The project created may not be correct. Do you want to continue?`,
      )
    ) {
      // 2.1 If user choose to continue, proceed with relaxed validation
      validationResult = validateTemplateDefinitions(template, loaded.file, false);
    } else {
      return false;
    }
  }

  // 3. If even relaxed validation fails, still prompt user to continue or not
  if (!validationResult.valid) {
    logDiagnostics(validationResult.diagnostics);

    return await confirm(
      "Template schema failed. The project created may not be correct. Do you want to continue?",
    );
  }
  return true;
}

async function selectEmitters(template: InitTemplate): Promise<Record<string, EmitterTemplate>> {
  if (!template.emitters) {
    return {};
  }

  const promptList = [...Object.entries(template.emitters)].map(([name, emitter]) => {
    return {
      title: name,
      description: emitter.description,
      selected: emitter.selected ?? false,
    };
  });

  const { emitters } = await prompts({
    type: "multiselect",
    name: "emitters",
    message: "Select emitters?",
    choices: promptList,
  });

  const selectedEmitters = [...Object.entries(template.emitters)].filter((_, index) =>
    emitters.includes(index),
  );

  return Object.fromEntries(selectedEmitters);
}

async function selectLibraries(template: InitTemplate): Promise<InitTemplateLibrarySpec[]> {
  if (template.libraries === undefined || template.libraries.length === 0) {
    return [];
  }

  const libraryChoices = template.libraries.map((x) => ({
    ...normalizeLibrary(x),
    description: "",
  }));

  const { libraries } = await prompts({
    type: "multiselect",
    name: "libraries",
    message: "Update the libraries?",
    choices: libraryChoices.map((x) => {
      return {
        title: x.name,
        description: x.description,
        value: x,
        selected: true,
      };
    }),
    initial: template.libraries as any,
  });

  return libraries;
}

/**
 * Error thrown when init template acquisition fails or template is invalid.
 *
 * Contains diagnostics that can be logged to the user.
 */
export class InitTemplateError extends Error {
  constructor(public diagnostics: readonly Diagnostic[]) {
    super();
  }
}

function logDiagnostics(diagnostics: readonly Diagnostic[]): void {
  diagnostics.forEach((diagnostic) => {
    // eslint-disable-next-line no-console
    console.log(diagnostic.message);
  });
}
