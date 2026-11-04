export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

const levels = [
  { level: 1, name: 'New Voice', minimum: 0 },
  { level: 2, name: 'Contributor', minimum: 5 },
  { level: 3, name: 'Local Expert', minimum: 15 },
  { level: 4, name: 'Community Champion', minimum: 30 },
] as const;

export const getProfileProgress = (
  approvedReviews: number,
  readyReports: number,
) => {
  const contributions = approvedReviews + readyReports;
  const currentLevel =
    [...levels].reverse().find((item) => contributions >= item.minimum) ??
    levels[0];
  const nextLevel = levels.find((item) => item.minimum > contributions);

  return {
    approvedReviews,
    readyReports,
    contributions,
    level: currentLevel.level,
    levelName: currentLevel.name,
    nextLevel: nextLevel
      ? {
          level: nextLevel.level,
          name: nextLevel.name,
          contributionsRequired: nextLevel.minimum,
          contributionsRemaining: nextLevel.minimum - contributions,
        }
      : null,
  };
};

export const getAchievements = (
  approvedReviews: number,
  readyReports: number,
): Achievement[] => [
  {
    id: 'first-review',
    name: 'First Voice',
    description: 'Get your first review approved.',
    unlocked: approvedReviews >= 1,
  },
  {
    id: 'five-reviews',
    name: 'Local Voice',
    description: 'Get 5 reviews approved.',
    unlocked: approvedReviews >= 5,
  },
  {
    id: 'ten-reviews',
    name: 'Trusted Reviewer',
    description: 'Get 10 reviews approved.',
    unlocked: approvedReviews >= 10,
  },
  {
    id: 'first-report',
    name: 'Report Explorer',
    description: 'Complete your first area report.',
    unlocked: readyReports >= 1,
  },
  {
    id: 'five-reports',
    name: 'Area Analyst',
    description: 'Complete 5 area reports.',
    unlocked: readyReports >= 5,
  },
  {
    id: 'community-researcher',
    name: 'Community Researcher',
    description: 'Get 5 reviews approved and complete 5 area reports.',
    unlocked: approvedReviews >= 5 && readyReports >= 5,
  },
];
