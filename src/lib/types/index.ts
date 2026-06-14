import type { IssueStance } from "@/lib/types/issue-tags";

export type { IssueStance, IssueTagPreference } from "@/lib/types/issue-tags";

export type Chamber = "house" | "senate" | "state";

export interface Representative {
  bioguideId: string;
  /** Open States ocd-person id for state legislators. */
  personId?: string | null;
  fullName: string;
  chamber: Chamber;
  /** State House (lower) or Senate (upper) when chamber is "state". */
  stateLegislativeChamber?: "lower" | "upper" | null;
  party: string | null;
  photoUrl: string | null;
  state: string;
  district: string | null;
  officePhone?: string | null;
  officialWebsite?: string | null;
}

export interface DistrictLookupResult {
  congressionalDistrict: string;
  state: string;
  stateHouseDistrict?: string | null;
  stateSenateDistrict?: string | null;
  ocdDivisionId: string | null;
  lookupZip: string | null;
  representatives: Representative[];
  source: "geocodio" | "civiq" | "congress.gov" | "demo";
  /** True when state legislators were appended via Open States people.geo */
  stateLegislatorsIncluded?: boolean;
}

export interface DemographicsInput {
  birthYear?: number | null;
  educationLevel?: string | null;
  incomeBracket?: string | null;
  hasChildren?: boolean | null;
}

export interface ReflectionScoreResult {
  score: number;
  confidence: "low" | "moderate" | "strong";
  votesAnalyzed: number;
  message: string;
  aligned: VoteAlignmentItem[];
  diverged: VoteAlignmentItem[];
  /** All votes used in the score (when requested). */
  scoredVotes?: VoteAlignmentItem[];
}

export type AlignmentSource = "auto" | "manual";

export interface VoteAlignmentItem {
  voteId: string;
  billId: string;
  title: string;
  summary: string | null;
  /** Roll-call context when no CRS summary is available. */
  voteContext: string | null;
  question: string | null;
  votedAt: string;
  vote: "Yea" | "Nay" | "Not Voting" | "Present";
  issueSlug: string;
  userStance: IssueStance;
  /** Effective alignment used in the score (may be manually overridden). */
  aligned: boolean;
  /** Alignment from issue tags + roll-call vote only. */
  autoAligned: boolean;
  alignmentSource: AlignmentSource;
}

export interface UserIssueTag {
  slug: string;
  label: string;
  weight: number;
  stance: IssueStance;
}
