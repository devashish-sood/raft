import {
  handleClientMessage,
  isBusinessMsg,
  isProtoMsg,
  toFollower,
  voteResponse,
} from "./follower";
import { toLeader } from "./leader";
import { sendMessage } from "./send";
import { Constants } from "./util/constants";
import { ProtoMessage, VoteRequestMessage } from "./util/message-schemas";
import { Candidate, Follower, Leader, Replica } from "./util/types";

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

function restartElection(candidate: Candidate) {
  candidate.currentTerm += 1;
  candidate.votes = [];
  candidate.votedFor = candidate.config.id;
}

function handleMessages(candidate: Candidate, electInterval: NodeJS.Timeout) {
  return new Promise<Leader | Follower>((resolve, _) => {
    const msgHandler = (msg: Buffer) => {
      //callback for cleaning up listener on replica state change
      const cleanupandResolve = (val: Leader | Follower) => {
        candidate.config.socket.off("message", msgHandler);
        clearTimeout(electInterval);
        resolve(val);
      };

      //actual message handler
      const parsedMessage = JSON.parse(msg.toString("utf-8"));
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
  const lastLogIndex = candidate.log.length - 1;

  sendMessage(candidate, {
    src: candidate.config.id,
    dst: Constants.BROADCAST,
    leader: candidate.leader ?? Constants.BROADCAST,
    type: Constants.VOTEREQUEST,
    term: candidate.currentTerm,
    candidateId: candidate.config.id,
    llogIdx: lastLogIndex,
    llogTerm: lastLogIndex >= 0 ? candidate.log[lastLogIndex].term : 0,
  });
}

async function runCandidate(candidate: Candidate): Promise<Replica> {
  const electInterval = setInterval(() => {
    restartElection(candidate);
    sendVoteRequests(candidate);
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
        //once the code for processing an AE message is return, here we need to return a follower that has processed one of those messages, instead of just the newly created follower
        resolve(toFollower(candidate, msg.term));
      }
      break;
    case Constants.VOTEREQUEST:
      //
      if (msg.term > candidate.currentTerm) {
        const follower = toFollower(candidate, msg.term);
        sendMessage(follower, voteResponse(follower, msg, true));
        console.log("candidate deferring to", msg.src);
        resolve(follower);
      }
      break;
    case Constants.VOTERESPONSE:
      if (msg.voteGranted) {
        console.log("vote received: ", msg.src);
        candidate.votes.push(msg.src);
        if (
          candidate.votes.length >=
          Math.ceil(candidate.config.others.length / 2)
        ) {
          console.log("leader elected!");
          resolve(toLeader(candidate));
        }
      }
      break;
    default:
      console.log("Received an unexpected message", msg.type, msg);
  }
}

export { toCandidate, runCandidate };
