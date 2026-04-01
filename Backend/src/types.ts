export type Submission = {
  id: number;
  text: string;
  clustered?: boolean;
  clusterId?: string;
};

export type Question = {
  id: number;
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  votesYes: number;
  votesNo: number;
  clusterId: string;
  sourceSubmissionIds: number[];
};

export type Cluster = {
  clusterId: string;
  title: string;
  summary: string;
  submissionIds: number[];
};

export type Store = {
  submissions: Submission[];
  questions: Question[];
  nextSubmissionId: number;
  nextQuestionId: number;
};