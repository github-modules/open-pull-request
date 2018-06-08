import * as Octokit from '@octokit/rest';
interface Options {
    owner: string;
    repo: string;
    forker: string;
    title: string;
    body: string;
    commitMessage: string;
    newBranchName?: string;
    filename: string;
    transform: (filename: string, content: string) => string;
}
export declare function openPullRequest(opts: Options): Promise<Octokit.AnyResponse>;
export {};
