/** Default copy when the host has not set custom labels (still records yes/no in the API). */
export const DEFAULT_VOTE_YES_LABEL = "Interested";
export const DEFAULT_VOTE_NO_LABEL = "Not interested";

export type VoteButtonCopy = {
  yes: string;
  no: string;
  yesChosen: string;
  noChosen: string;
};

export function voteButtonCopy(q: {
  yesButtonLabel?: string;
  noButtonLabel?: string;
}): VoteButtonCopy {
  const yes = (q.yesButtonLabel?.trim() || DEFAULT_VOTE_YES_LABEL).slice(0, 48);
  const no = (q.noButtonLabel?.trim() || DEFAULT_VOTE_NO_LABEL).slice(0, 48);
  return {
    yes,
    no,
    yesChosen: `You chose: ${yes}`,
    noChosen: `You chose: ${no}`,
  };
}
