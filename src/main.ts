import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { Context } from '@actions/github/lib/context';

type OctoKit = InstanceType<typeof GitHub>;

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  const { workspaces, fallback, token, base_ref, head_ref } = fetchInputs();

  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!base_ref || !head_ref) {
    core.debug(
      `Missing diff args
      base_ref: ${base_ref}
      head_ref: ${head_ref}
      `
    );
    setOutput(fallback, true);
    return;
  }

  const tree = await fetchTree(octokit, context, head_ref);
  debugArray('Tree:', tree);
  const crate_paths = filterTree(tree, workspaces);
  debugArray('Crate paths:', crate_paths);
  const diff = await fetchDiff(octokit, context, base_ref, head_ref);
  debugArray('Changed files:', diff);
  const changed_workspaces = diff
    .map(file => crate_paths.find(crate => file.startsWith(crate)))
    .filter(x => x !== undefined) as string[];
  debugArray('Changed workspaces:', changed_workspaces);
  const workspaces_to_run = [...new Set(changed_workspaces)];
  debugArray('Unique workspaces:', workspaces_to_run);

  if (workspaces_to_run.length === 0) {
    setOutput(fallback, true);
  } else {
    setOutput(workspaces_to_run);
  }
}

async function fetchTree(
  octokit: OctoKit,
  context: Context,
  head_ref: string
): Promise<string[]> {
  // todo: this is limited, we should switch to traversing without the recursive flag
  const root = await octokit.rest.git.getTree({
    ...context.repo,
    tree_sha: head_ref,
    recursive: 'true',
  });

  const tree = root.data.tree.map(x => x.path).filter(x => !!x) as string[];

  return tree;
}

function filterTree(tree: string[], workspaces: string[]): string[] {
  const filtered_tree = tree.filter(x => workspaces.some(w => x.startsWith(w)));
  const crate_paths = filtered_tree
    .filter(x => x.endsWith('Cargo.toml'))
    .map(x => {
      const s = x.split('Cargo.toml')[0];
      return s.substring(0, s.length - 1);
    });
  return crate_paths.sort((a, b) => b.split('/').length - a.split('/').length);
}

async function fetchDiff(
  octokit: OctoKit,
  context: Context,
  base_ref: string,
  head_ref: string
): Promise<string[]> {
  const diff = await octokit.rest.repos.compareCommitsWithBasehead({
    ...context.repo,
    basehead: `${base_ref}...${head_ref}`,
  });

  return diff.data.files?.map(x => x.filename) as string[];
}

function fetchInputs() {
  const token = core.getInput('token');
  if (!token) {
    throw new Error('No Github token provided');
  }

  const workspaces: string[] = JSON.parse(core.getInput('workspaces'));
  if (!workspaces || !Array.isArray(workspaces)) {
    throw new Error('workspaces is not a valid JSON array');
  }

  const fallback_input = core.getInput('fallback');
  let fallback: string[];
  if (!fallback_input) {
    fallback = workspaces;
  } else {
    fallback = JSON.parse(fallback_input);
  }

  // todo: we can fetch these 2 ourselves
  const base_ref = core.getInput('base_ref');
  const head_ref = core.getInput('head_ref');
  return { workspaces, fallback, token, base_ref, head_ref };
}

function setOutput(matrix: string[], fallback = false) {
  const matrix_string = JSON.stringify(matrix);
  console.log(`
    Output:
    matrix: ${matrix_string}
    fallback: ${fallback}
  `);
  core.setOutput('matrix', matrix_string);
  core.setOutput('fallback', fallback);
}

function debugArray(msg: string, arr: any[]) {
  core.debug(msg);
  core.debug(JSON.stringify(arr, undefined, 2));
}

export default run;
