export interface ClusterCandidate {
  clusterId: string;
  theme: string;
  summary: string;
  submissionIds: number[];
  keywords: string[];
}

export interface GeneratedQuestion {
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
}

export interface ClusteredSubmissionInput {
  id: number;
  text: string;
}