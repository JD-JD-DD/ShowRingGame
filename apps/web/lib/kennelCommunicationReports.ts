export const KENNEL_COMMUNICATION_REPORT_REASONS = [
  { value: "HARASSMENT", label: "Harassment" },
  { value: "HATE_SPEECH", label: "Hate speech" },
  { value: "SPAM", label: "Spam" },
  { value: "SCAM", label: "Scam" },
  { value: "THREAT", label: "Threat" },
  { value: "OTHER", label: "Other" },
] as const;

export const MAX_KENNEL_REPORT_DETAIL_LENGTH = 2000;

export type KennelCommunicationReportReason =
  (typeof KENNEL_COMMUNICATION_REPORT_REASONS)[number]["value"];
