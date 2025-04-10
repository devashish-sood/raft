import {
  handleClientMessage,
  isBusinessMsg,
  isProtoMsg,
  toFollower,
} from "./follower";
import { toLeader } from "./leader";
import { Constants } from "./util/constants";
import { ProtoMessage } from "./util/message-schemas";
import {
  Candidate,
  Follower,
  FollowerRole,
  Leader,
  LeaderRole,
  Replica,
} from "./util/types";

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

function handleMessages(candidate: Candidate, electInterval: NodeJS.Timeout) {
  return new Promise<Leader | Follower>((resolve, _) => {
    const msgHandler = (msg: Buffer) => {
      const parsedMessage = JSON.parse(msg.toString("utf-8"));
      const cleanupandResolve = (val: Leader | Follower) => {
        candidate.config.socket.off("message", msgHandler);
        clearTimeout(electInterval);
        resolve(val);
      };
      if (isBusinessMsg(parsedMessage)) {
        handleClientMessage(candidate, parsedMessage);
      } else if (isProtoMsg(parsedMessage)) {
        handleProtoMessage(candidate, parsedMessage, cleanupandResolve);
      }
    };

    candidate.config.socket.on("message", msgHandler);
  });
}

function sendVoteRequests(candidate: Candidate): void {
  candidate.config.others.forEach((neighbor) => {
    // construct vote request message
    // send vote request message
    // TODO: incomplete
  });
}

async function runCandidate(candidate: Candidate): Promise<Replica> {
  const electInterval = setInterval(() => {
    candidate = toCandidate(candidate);
  }, candidate.electionTimeout);

  return handleMessages(candidate, electInterval);
}

function handleProtoMessage(
  candidate: Candidate,
  msg: ProtoMessage,
  resolve: any,
): void {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      if (msg.term >= candidate.currentTerm) {
        //once the code for processing an AA message is return, here we need to return a follower that has processed one of those messages, instead of just the newly created follower
        resolve(toFollower(candidate, msg.term, msg.src));
      }
      break;
    case Constants.VOTEREQUEST:
      //
      if (msg.term > candidate.currentTerm)
        //same paradigm here, so perhaps a better design is to send the raw message and have it loaded up in a message queue somehow to be read from.
        resolve(toFollower(candidate, msg.term, undefined));
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
