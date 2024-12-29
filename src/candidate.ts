import { handleClientMessage, isBusinessMsg, isProtoMsg } from "./follower";
import { Constants } from "./util/constants";
import { ProtoMessage } from "./util/message-schemas";
import { Candidate, Follower, Leader, Replica } from "./util/types";
import { setTimeout } from "timers/promises";

function toCandidate(replica: Follower | Candidate): Candidate {
  return {
    ...replica,
    currentTerm: replica.currentTerm + 1,
    role: Constants.CANDIDATE,
    votedFor: replica.config.id,
    leader: undefined,
  };
}

async function runCandidate(candidate: Candidate): Promise<Replica> {
  return Promise.race([
    requestVotes(candidate),
    setTimeout(candidate.electionTimeout, toCandidate(candidate)),
  ]);
}

async function requestVotes(candidate: Candidate): Promise<Follower | Leader> {
  return new Promise<Follower | Leader>((resolve, _) => {
    candidate.config.socket.on("message", (msg) => {
      const parsedMessage = JSON.parse(msg.toString("utf-8"));
      if (isBusinessMsg(parsedMessage)) {
        handleClientMessage(candidate, parsedMessage);
      } else if (isProtoMsg(parsedMessage)) {
        handleProtoMessage(candidate, parsedMessage, resolve);
      }
    });
  });
}

function handleProtoMessage(
  candidate: Candidate,
  msg: ProtoMessage,
  resolve: (value: Follower | Leader | PromiseLike<Follower | Leader>) => void
): void {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      break;
    case Constants.VOTEREQUEST:
      break;
    case Constants.VOTERESPONSE:
      break;
  }
}

export { toCandidate, runCandidate };
