import {
  handleClientMessage,
  isBusinessMsg,
  isProtoMsg,
  toFollower,
} from "./follower";
import { toLeader } from "./leader";
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
    votes: [],
  };
}

function resetCandidate(replica: Candidate): void {
  replica.currentTerm = replica.currentTerm + 1;
  replica.votes = [];
}

async function runCandidate(candidate: Candidate): Promise<Replica> {
  const electionTimeout = setInterval(() => {
    resetCandidate(candidate);
    // Transition to a new state or take appropriate action
  }, candidate.electionTimeout);
  return requestVotes(candidate);
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
  resolve: (value: Follower | Leader | PromiseLike<Follower | Leader>) => void,
): void {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      if (msg.term >= candidate.currentTerm) {
        //once the code for processing an AA message is return, here we need to return a follower that has processed one of those messages, instead of just the newly created follower
        resolve(toFollower(candidate, msg.term, msg.src));
      }
      break;
    case Constants.VOTEREQUEST:
      if (msg.term > candidate.currentTerm)
        //same paradigm here, so perhaps a better design is to send the raw message and have it loaded up in a message queue somehow to be read from.
        [resolve(toFollower(candidate, msg.term))];
      break;
    case Constants.VOTERESPONSE:
      if (msg.voteGranted) {
        candidate.votes.push(msg.src);

        if (
          candidate.votes.length >=
          Math.ceil(candidate.config.others.length / 2)
        ) {
          resolve(toLeader(candidate));
        }
      }
      break;
  }
}

export { toCandidate, runCandidate };
