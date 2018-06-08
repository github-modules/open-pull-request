require('dotenv-safe').load()

import * as Octokit from '@octokit/rest'
import * as assert from 'assert'

const octokit = new Octokit()

interface Options {
  owner: string
  repo: string
  forker: string
  title: string
  body: string
  commitMessage: string
  newBranchName?: string // optional
  filename: string
  // transform: (filename: string, content: string) => any
  transform: (filename: string, content: string) => string
}

export async function openPullRequest (opts: Options) {
  assert(process.env.GH_TOKEN, 'process.env.GH_TOKEN must be set')
  assert(opts.owner, 'owner is required')
  assert(opts.repo, 'repo is required')
  assert(opts.forker, 'forker is required')
  assert(opts.title, 'title is required')
  assert(opts.body, 'body is required')
  assert(opts.commitMessage, 'commitMessage is required')
  assert(opts.newBranchName, 'newBranchName is required')
  assert(opts.filename, 'filename is required')
  assert(opts.transform, 'transform is required')

  octokit.authenticate({ type: 'token', token: process.env.GH_TOKEN })

  const {
    owner,
    repo,
    forker,
    title,
    body,
    commitMessage,
    newBranchName,
    filename,
    transform
  } = opts

  await octokit.repos.fork({ owner, repo, organization: forker })

  // Emulate probot's convenience function
  const context = {
    repo: (obj) => ({ owner: forker, repo, ...obj })
  }

  // Get the current master's sha
  const sha = await octokit.gitdata.getReference(context.repo({
    ref: 'heads/master'
  }))

  // Get the tree associated with master
  const tree = await octokit.gitdata.getTree(
    context.repo({ tree_sha: sha.data.object.sha })
  )

  const content = await octokit.repos.getContent(context.repo({
    path: filename,
    ref: 'heads/master'
  }))

  // Modify the file
  // const newFile = transform(filename, content)

  // Create a new blob
  const blob = await octokit.gitdata.createBlob(context.repo({
    content: 'newFile'
  }))

  // Create new tree
  const newTree = await octokit.gitdata.createTree(context.repo({
    tree: [{
      path: filename,
      sha: blob.data.sha,
      mode: '100644',
      type: 'blob'
    }],
    base_tree: tree.data.sha
  }))

  // Create a commit and a reference using the new tree
  const newCommit = await octokit.gitdata.createCommit(context.repo({
    message: commitMessage,
    parents: [sha.data.object.sha],
    tree: newTree.data.sha
  }))

  await octokit.gitdata.createReference(context.repo({
    ref: `refs/heads/${newBranchName}`,
    sha: newCommit.data.sha
  }))

  const pullRequest = await octokit.pullRequests.create(context.repo({
    owner,
    title,
    body,
    // For cross-repository pull requests in the same network,
    // namespace head with a user like this: username:branch.
    head: `${forker}:${newBranchName}`,
    base: 'master'
  }))

  return pullRequest
}
