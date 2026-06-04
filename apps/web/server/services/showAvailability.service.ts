export type ShowEntryStatus =
  | "NOT_OPEN"
  | "OPEN"
  | "CLOSED"
  | "JUDGING"
  | "RESULTS_PUBLISHED"
  | "CANCELLED";

export type ShowEntryAvailability = {
  entryStatus: ShowEntryStatus;
  canEnter: boolean;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  message: string;
};

type ClusterLike = {
  status: string;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
};

type ShowDayLike = {
  status: string;
  scheduledEpoch: number;
};

type BlockLike = {
  status: string;
  startEpoch: number;
  showDay: {
    status: string;
    scheduledEpoch: number;
    cluster: ClusterLike;
  };
};

function statusMessage(status: ShowEntryStatus): string {
  switch (status) {
    case "NOT_OPEN":
      return "Entries are not open for this show.";
    case "OPEN":
      return "Entries are open for this show.";
    case "CLOSED":
      return "Entries have closed for this show.";
    case "JUDGING":
      return "Judging is underway for this show.";
    case "RESULTS_PUBLISHED":
      return "Results have been published for this show.";
    case "CANCELLED":
      return "This show has been cancelled.";
  }
}

function availability(args: {
  entryStatus: ShowEntryStatus;
  cluster: ClusterLike;
}): ShowEntryAvailability {
  return {
    entryStatus: args.entryStatus,
    canEnter: args.entryStatus === "OPEN",
    entryOpenEpoch: args.cluster.entryOpenEpoch,
    entryCloseEpoch: args.cluster.entryCloseEpoch,
    message: statusMessage(args.entryStatus),
  };
}

// Stored cluster/day/block statuses are persisted workflow snapshots. Use this
// helper to compute the live player-facing entry state from the canonical epoch
// window first, then layer terminal or in-progress statuses on top.
export function getShowEntryAvailability(args: {
  cluster: ClusterLike;
  currentEpoch: number;
  hasJudgingActivity?: boolean;
}): ShowEntryAvailability {
  const { cluster, currentEpoch, hasJudgingActivity = false } = args;

  if (cluster.status === "CANCELLED") {
    return availability({ entryStatus: "CANCELLED", cluster });
  }

  if (cluster.status === "COMPLETE") {
    return availability({ entryStatus: "RESULTS_PUBLISHED", cluster });
  }

  if (hasJudgingActivity) {
    return availability({ entryStatus: "JUDGING", cluster });
  }

  if (currentEpoch < cluster.entryOpenEpoch) {
    return availability({ entryStatus: "NOT_OPEN", cluster });
  }

  if (currentEpoch < cluster.entryCloseEpoch) {
    return availability({ entryStatus: "OPEN", cluster });
  }

  return availability({ entryStatus: "CLOSED", cluster });
}

export function getShowDayEntryAvailability(args: {
  cluster: ClusterLike;
  showDay: ShowDayLike;
  currentEpoch: number;
  hasJudgingActivity?: boolean;
}): ShowEntryAvailability {
  const { cluster, showDay, currentEpoch, hasJudgingActivity = false } = args;

  if (showDay.status === "CANCELLED") {
    return availability({ entryStatus: "CANCELLED", cluster });
  }

  if (showDay.status === "RESULTS_PUBLISHED") {
    return availability({ entryStatus: "RESULTS_PUBLISHED", cluster });
  }

  if (showDay.status === "JUDGING" || hasJudgingActivity) {
    return availability({ entryStatus: "JUDGING", cluster });
  }

  const clusterAvailability = getShowEntryAvailability({
    cluster,
    currentEpoch,
    hasJudgingActivity,
  });

  if (!clusterAvailability.canEnter) {
    return clusterAvailability;
  }

  if (currentEpoch >= showDay.scheduledEpoch) {
    return availability({ entryStatus: "CLOSED", cluster });
  }

  return clusterAvailability;
}

export function getShowBlockEntryAvailability(args: {
  block: BlockLike;
  currentEpoch: number;
  hasJudgingActivity?: boolean;
}): ShowEntryAvailability {
  const { block, currentEpoch, hasJudgingActivity = false } = args;

  if (block.status === "CANCELLED") {
    return availability({
      entryStatus: "CANCELLED",
      cluster: block.showDay.cluster,
    });
  }

  if (block.status === "RESULTS_PUBLISHED") {
    return availability({
      entryStatus: "RESULTS_PUBLISHED",
      cluster: block.showDay.cluster,
    });
  }

  if (block.status === "JUDGING" || hasJudgingActivity) {
    return availability({
      entryStatus: "JUDGING",
      cluster: block.showDay.cluster,
    });
  }

  const dayAvailability = getShowDayEntryAvailability({
    cluster: block.showDay.cluster,
    showDay: block.showDay,
    currentEpoch,
    hasJudgingActivity,
  });

  if (!dayAvailability.canEnter) {
    return dayAvailability;
  }

  if (currentEpoch >= block.startEpoch) {
    return availability({
      entryStatus: "CLOSED",
      cluster: block.showDay.cluster,
    });
  }

  return dayAvailability;
}
