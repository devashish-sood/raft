import { Constants } from "./util/constants";
import { Candidate, Follower, Leader, Replica } from "./util/types";
import { setTimeout } from "timers/promises";

function toCandidate(replica: Follower | Candidate): Candidate {
  return {
    ...follower,
    currentTerm: follower.currentTerm + 1,
    role: Constants.CANDIDATE,
    votedFor: follower.config.id
  };
}

async function runCandidate(candidate: Candidate): Promise<Replica> {
  return Promise.race([
    requestVotes(candidate), 
    setTimeout(candidate.electionTimeout, toCandidate(candidate))
  ]) 
}

async function requestVotes(candidate) {
  
}

export {toCandidate}