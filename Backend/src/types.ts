export type Submission = {
  id: number;
  text: string;
  createdAt: number;
  clustered?: boolean;
  clusterId?: string;
};

export type Cluster = {
  id: string;
  title: string;
  summary: string;
  submissionIds: number[];
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

export type Store = {
  submissions: Submission[];
  clusters: Cluster[];
  questions: Question[];
  counters: {
    submissionId: number;
    questionId: number;
  };
};