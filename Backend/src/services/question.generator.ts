type Cluster = {
  id: string;
  submissions: { id: string; text: string }[];
  keywords: string[];
};

function pickMainTheme(keywords: string[]): string {
  return keywords.slice(0, 3).join(" ");
}

export function generateQuestion(cluster: Cluster) {
  const theme = pickMainTheme(cluster.keywords);

  return {
    id: cluster.id,
    title: `How should society address ${theme}?`,
    description: `${cluster.submissions.length} people raised concerns related to ${theme}.`,
    submissions: cluster.submissions.map(s => s.text),
    votes: { yes: 0, no: 0 }
  };
}