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
  };
}

async function runCandidate(candidate: Candidate): Promise<Replica> {
  return Promise.race([
    requestVotes(candidate),
    setTimeout(candidate.electionTimeout, toCandidate(candidate)),
  ]);
}

async function requestVotes(candidate: Candidate): Promise<Follower | Leader> {
  const votes: string[] = [];
  return new Promise<Follower | Leader>((resolve, _) => {
    candidate.config.socket.on("message", (msg) => {
      const parsedMessage = JSON.parse(msg.toString("utf-8"));
      if (isBusinessMsg(parsedMessage)) {
        handleClientMessage(candidate, parsedMessage);
      } else if (isProtoMsg(parsedMessage)) {
        handleProtoMessage(candidate, parsedMessage, votes, resolve);
      }
    });
  });
}

function handleProtoMessage(
  candidate: Candidate,
  msg: ProtoMessage,
  votes: string[],
  resolve: (value: Follower | Leader | PromiseLike<Follower | Leader>) => void
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
        votes.push(msg.src);

        if (votes.length >= Math.ceil(candidate.config.others.length / 2)) {
          resolve(toLeader(candidate));
        }
      }
      break;
  }
}

export { toCandidate, runCandidate };
