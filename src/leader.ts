import { config } from "process";
import { Constants } from "./util/constants";
import { Candidate, Leader } from "./util/types";

function toLeader(candidate: Candidate): Leader {
  return {
    ...candidate,
    role: Constants.LEADER,
    leader: candidate.config.id,
  };
}

export { toLeader };
