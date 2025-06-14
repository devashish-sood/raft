import {
  constructAppendResponse,
  evaluateCandidate,
  handleAEMessage,
  isBusinessMsg,
  isProtoMsg,
  sendRedirect,
  toFollower,
} from "./follower";
import { applyCommits, toLeader } from "./leader";
import { sendMessage } from "./send";
import { Constants } from "./util/constants";
import { ProtoMessage, VoteRequestMessage } from "./util/message-schemas";
import { Candidate, Follower, Leader, Replica } from "./util/types";

function toCandidate(replica: Follower | Candidate): Candidate {
  return {
    ...replica,
    term: replica.term + 1,
    role: Constants.CANDIDATE,
    votedFor: replica.config.id,
    leader: undefined,
    votes: [replica.config.id],
    lastAE: new Date(),
  };
}

function restartElection(candidate: Candidate) {
  candidate.term += 1;
  candidate.votes = [candidate.config.id];
  candidate.votedFor = candidate.config.id;
}

function handleMessages(candidate: Candidate, electInterval: NodeJS.Timeout) {
  return new Promise<Leader | Follower>((resolve, _) => {
    const msgHandler = (msg: Buffer) => {
      //callback for cleaning up listener on replica state change
      const cleanupandResolve = (val: Leader | Follower) => {
        candidate.config.socket.off("message", msgHandler);
        clearInterval(electInterval);
        resolve(val);
      };

      //actual message handler
      const parsedMessage = JSON.parse(msg.toString("utf-8"));
      if (isBusinessMsg(parsedMessage)) {
        sendRedirect(candidate, parsedMessage);
      } else if (isProtoMsg(parsedMessage)) {
        handleProtoMessage(candidate, parsedMessage, cleanupandResolve);
      }
    };

    candidate.config.socket.on("message", msgHandler);
  });
}

async function sendVoteRequests(candidate: Candidate): Promise<void> {
  const lastLogIndex = candidate.log.length - 1;

  await sendMessage(candidate, {
    src: candidate.config.id,
    dst: Constants.BROADCAST,
    leader: candidate.leader ?? Constants.BROADCAST,
    type: Constants.VOTEREQUEST,
    term: candidate.term,
    candidateId: candidate.config.id,
    llogIdx: lastLogIndex,
    llogTerm: lastLogIndex >= 0 ? candidate.log[lastLogIndex].term : 0,
  });
}

async function runCandidate(candidate: Candidate): Promise<Replica> {
  const electInterval = setInterval(async () => {
    await applyCommits(candidate);
    restartElection(candidate);
    console.log("candidate's new term is: ", candidate.term);
    await sendVoteRequests(candidate);
  }, candidate.electionTimeout);

  console.log("candidate's term is: ", candidate.term);
  await sendVoteRequests(candidate);

  return handleMessages(candidate, electInterval);
}

async function handleProtoMessage(
  candidate: Candidate,
  msg: ProtoMessage,
  resolve: any,
): Promise<void> {
  switch (msg.type) {
    case Constants.APPENDENTRIES:
      if (msg.term >= candidate.term) {
        const follower = toFollower(candidate, msg.term);
        handleAEMessage(follower, msg);
        resolve(follower);
      } else {
        await sendMessage(
          candidate,
          constructAppendResponse(candidate, msg, false),
        );
        return;
      }
      break;
    case Constants.VOTEREQUEST:
      if (msg.term > candidate.term) {
        const follower = toFollower(candidate, msg.term);
        await sendMessage(follower, evaluateCandidate(follower, msg));
        console.log("candidate stepping down due to", msg.src);
        resolve(follower);
      }
      break;
    case Constants.VOTERESPONSE:
      if (
        msg.term == candidate.term &&
        msg.voteGranted &&
        !candidate.votes.includes(msg.src)
      ) {
        console.log("vote received: ", msg.src);
        candidate.votes.push(msg.src);
        console.log(candidate.votes);
        if (
          candidate.votes.length >=
          Math.ceil((candidate.config.others.length + 1) / 2)
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
